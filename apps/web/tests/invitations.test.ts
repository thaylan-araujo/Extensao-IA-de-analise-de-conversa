import { describe, expect, it } from "vitest";

import { generateInviteToken, hashToken } from "../lib/invitations/token";

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
  it("creates a pending invitation for 7 days with lowercase email", async () => {
    const { POST } = await import("../app/api/invitations/route");
    const request = await jsonRequest("/api/invitations", {
      email: uniqueEmail("create").toUpperCase(),
      role: "advogado"
    });

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

    await POST(await jsonRequest("/api/invitations", { email, role: "advogado" }));
    const response = await POST(
      await jsonRequest("/api/invitations", { email, role: "advogado" })
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
      await jsonRequest("/api/invitations", { email, role: "advogado" })
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
        token: "invalid-token",
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
      await jsonRequest("/api/invitations", { email, role: "advogado" })
    );
    const created = await createResponse.json();

    const response = await resendInvitation(
      await jsonRequest(`/api/invitations/${created.invitation.id}/resend`, {}, {})
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
      await jsonRequest("/api/invitations", { email, role: "advogado" })
    );
    const created = await createResponse.json();

    const response = await DELETE(
      await jsonRequest(`/api/invitations/${created.invitation.id}`, {}, { method: "DELETE" })
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
    const email = uniqueEmail("reactivate");
    const createResponse = await createInvitation(
      await jsonRequest("/api/invitations", { email, role: "advogado" })
    );
    const created = await createResponse.json();

    const response = await acceptInvitation(
      await jsonRequest("/api/invitations/accept", {
        token: created.token,
        fullName: "Pessoa Reativada",
        password: "senha-nova-123"
      })
    );

    expect(response.status).toBe(200);
  });
});
