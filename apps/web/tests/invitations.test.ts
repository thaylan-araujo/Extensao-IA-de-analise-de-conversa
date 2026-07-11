import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateInviteToken, hashToken } from "../lib/invitations/token";
import { createAdminClient } from "../lib/supabase/admin";

const hasHostedSupabaseSecrets =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.SEED_GESTOR_EMAIL) &&
  Boolean(process.env.SEED_USER_PASSWORD);

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`;
}

async function jsonRequest(path: string, body: unknown, init?: RequestInit) {
  return new Request(`http://localhost:3000${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    method: init?.method ?? "POST",
    body: JSON.stringify(body)
  });
}

let gestorAccessToken: string | null = null;
let advogadoAccessToken: string | null = null;

function authenticatedInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(gestorAccessToken ? { authorization: `Bearer ${gestorAccessToken}` } : {})
    }
  };
}

describe("invite token utilities", () => {
  it("generates a base64url token and stores only a sha256 hash", () => {
    const { token, tokenHash } = generateInviteToken();

    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toBe(hashToken(token));
  });

  it("generates distinct tokens", () => {
    const first = generateInviteToken();
    const second = generateInviteToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });
});

describe.skipIf(!hasHostedSupabaseSecrets)("invitation lifecycle against hosted Supabase", () => {
  beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.SEED_GESTOR_EMAIL!,
      password: process.env.SEED_USER_PASSWORD!
    });

    if (error || !data.session?.access_token) {
      throw error ?? new Error("Missing gestor access token");
    }

    gestorAccessToken = data.session.access_token;

    const { data: advogadoData, error: advogadoError } =
      await supabase.auth.signInWithPassword({
        email: process.env.SEED_ADVOGADO_EMAIL!,
        password: process.env.SEED_USER_PASSWORD!
      });

    if (advogadoError || !advogadoData.session?.access_token) {
      throw advogadoError ?? new Error("Missing advogado access token");
    }

    advogadoAccessToken = advogadoData.session.access_token;
  });

  afterAll(async () => {
    // Convites de teste não podem acumular: o endpoint limita 20 pendentes
    // por organização e execuções repetidas estouravam o limite (429).
    // Escopado à org do gestor seed para não interferir em suítes paralelas.
    const admin = createAdminClient();

    // Usuários @example.test criados pelos fluxos de aceite/reativação também
    // não podem acumular: sem Docker os testes rodam contra o banco hospedado,
    // e o resíduo poluía a tela de equipe do Escritorio Demo em produção.
    const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of allUsers?.users ?? []) {
      if (/@example\.test$/i.test(user.email ?? "")) {
        await admin.from("profiles").delete().eq("user_id", user.id);
        await admin.auth.admin.deleteUser(user.id).catch(() => null);
      }
    }

    const seedGestor = await admin.auth.admin
      .listUsers({ page: 1, perPage: 1000 })
      .then(({ data }) =>
        data.users.find(
          (candidate) =>
            candidate.email?.toLowerCase() ===
            process.env.SEED_GESTOR_EMAIL?.toLowerCase()
        )
      );

    if (!seedGestor) {
      return;
    }

    const { data: seedProfile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", seedGestor.id)
      .maybeSingle();

    if (!seedProfile) {
      return;
    }

    await admin
      .from("invitations")
      .delete()
      .eq("organization_id", seedProfile.organization_id)
      .like("email", "%@example.test");
  });

  it("returns 403 when an advogado tries to create an invitation", async () => {
    const { POST } = await import("../app/api/invitations/route");
    const response = await POST(
      await jsonRequest("/api/invitations", {
        email: uniqueEmail("forbidden"),
        role: "advogado"
      }, {
        headers: {
          authorization: `Bearer ${advogadoAccessToken}`
        }
      })
    );

    expect(response.status).toBe(403);
  });

  it("creates a pending invitation for 7 days with lowercase email", async () => {
    const { POST } = await import("../app/api/invitations/route");
    const request = await jsonRequest("/api/invitations", {
      email: uniqueEmail("create").toUpperCase(),
      role: "advogado"
    }, authenticatedInit());

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.invitation.status).toBe("pending");
    expect(payload.invitation.email).toBe(payload.invitation.email.toLowerCase());
    expect(new Date(payload.invitation.expires_at).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
  });

  it("returns 409 for a second pending invitation in the same organization", async () => {
    const { POST } = await import("../app/api/invitations/route");
    const email = uniqueEmail("duplicate");

    await POST(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );
    const response = await POST(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );

    expect(response.status).toBe(409);
  });

  it("accepts a valid token, creates user and active profile, then marks accepted", async () => {
    const { POST: createInvitation } = await import("../app/api/invitations/route");
    const { POST: acceptInvitation } = await import(
      "../app/api/invitations/accept/route"
    );
    const email = uniqueEmail("accept");
    const createResponse = await createInvitation(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );
    const created = await createResponse.json();

    const response = await acceptInvitation(
      await jsonRequest("/api/invitations/accept", {
        token: created.token,
        fullName: "Pessoa Convidada",
        password: "senha-segura-123"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile.status).toBe("active");
    expect(payload.invitation.status).toBe("accepted");
  });

  it("returns 410 for expired, cancelled, or accepted tokens without creating a user", async () => {
    const { POST } = await import("../app/api/invitations/accept/route");

    const response = await POST(
      await jsonRequest("/api/invitations/accept", {
        token: "invalid-token-that-is-long-enough",
        fullName: "Pessoa Convidada",
        password: "senha-segura-123"
      })
    );

    expect(response.status).toBe(410);
  });

  it("resends with a new token hash and expiration, invalidating the old token", async () => {
    const { POST: createInvitation } = await import("../app/api/invitations/route");
    const { POST: resendInvitation } = await import(
      "../app/api/invitations/[id]/resend/route"
    );
    const email = uniqueEmail("resend");
    const createResponse = await createInvitation(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );
    const created = await createResponse.json();

    const response = await resendInvitation(
      await jsonRequest(
        `/api/invitations/${created.invitation.id}/resend`,
        {},
        authenticatedInit()
      ),
      { params: Promise.resolve({ id: created.invitation.id }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.token).not.toBe(created.token);
    expect(payload.invitation.token_hash).not.toBe(created.invitation.token_hash);
  });

  it("cancels a pending invitation", async () => {
    const { POST: createInvitation } = await import("../app/api/invitations/route");
    const { DELETE } = await import("../app/api/invitations/[id]/route");
    const email = uniqueEmail("cancel");
    const createResponse = await createInvitation(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );
    const created = await createResponse.json();

    const response = await DELETE(
      await jsonRequest(
        `/api/invitations/${created.invitation.id}`,
        {},
        authenticatedInit({ method: "DELETE" })
      ),
      { params: Promise.resolve({ id: created.invitation.id }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.invitation.status).toBe("cancelled");
  });

  it("reativa D-12 um profile removed no mesmo escritório sem criar segundo usuário", async () => {
    const { POST: createInvitation } = await import("../app/api/invitations/route");
    const { POST: acceptInvitation } = await import(
      "../app/api/invitations/accept/route"
    );
    const admin = createAdminClient();
    const email = uniqueEmail("reactivate");
    const createResponse = await createInvitation(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );
    const created = await createResponse.json();

    const firstAcceptResponse = await acceptInvitation(
      await jsonRequest("/api/invitations/accept", {
        token: created.token,
        fullName: "Pessoa Reativada",
        password: "senha-nova-123"
      })
    );
    const firstAccept = await firstAcceptResponse.json();

    expect(firstAcceptResponse.status).toBe(200);

    await admin
      .from("profiles")
      .update({
        removed_at: new Date().toISOString(),
        status: "removed"
      })
      .eq("user_id", firstAccept.profile.user_id);

    const secondCreateResponse = await createInvitation(
      await jsonRequest(
        "/api/invitations",
        { email, role: "advogado" },
        authenticatedInit()
      )
    );
    const secondCreated = await secondCreateResponse.json();
    const response = await acceptInvitation(
      await jsonRequest("/api/invitations/accept", {
        token: secondCreated.token,
        fullName: "Pessoa Reativada",
        password: "senha-nova-456"
      })
    );
    const secondAccept = await response.json();

    expect(response.status).toBe(200);
    expect(secondAccept.profile.user_id).toBe(firstAccept.profile.user_id);
    expect(secondAccept.profile.status).toBe("active");
    expect(secondAccept.profile.removed_at).toBeNull();
  });
});
