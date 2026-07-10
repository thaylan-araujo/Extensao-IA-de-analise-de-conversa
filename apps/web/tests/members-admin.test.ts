import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@copiloto/shared";

import { createAdminClient } from "../lib/supabase/admin";

const hasHostedSupabaseSecrets =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = "senha-de-teste-123";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`;
}

function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function tokenClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    }
  );
}

async function jsonRequest(path: string, body: unknown, init?: RequestInit) {
  return new Request(`http://localhost:3000${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    method: init?.method ?? "POST",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function bearer(token: string | null): RequestInit {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

async function deleteMember(userId: string, accessToken: string | null) {
  const { DELETE } = await import("../app/api/members/[userId]/route");

  return DELETE(
    new Request(`http://localhost:3000/api/members/${userId}`, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      method: "DELETE"
    }),
    { params: Promise.resolve({ userId }) }
  );
}

type SeededUser = {
  accessToken: string;
  email: string;
  refreshToken: string;
  userId: string;
};

async function seedUser(
  admin: ReturnType<typeof createAdminClient>,
  options: {
    fullName: string;
    organizationId: string;
    prefix: string;
    role: "advogado" | "gestor" | "super_admin";
  }
): Promise<SeededUser> {
  const email = uniqueEmail(options.prefix);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: PASSWORD
  });

  if (createError || !created.user) {
    throw createError ?? new Error(`Could not create user ${email}`);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    full_name: options.fullName,
    organization_id: options.organizationId,
    role: options.role,
    status: "active",
    user_id: created.user.id
  });

  if (profileError) {
    throw profileError;
  }

  const { data: session, error: signInError } = await anonClient().auth.signInWithPassword({
    email,
    password: PASSWORD
  });

  if (signInError || !session.session) {
    throw signInError ?? new Error(`Could not sign in ${email}`);
  }

  return {
    accessToken: session.session.access_token,
    email,
    refreshToken: session.session.refresh_token,
    userId: created.user.id
  };
}

describe.skipIf(!hasHostedSupabaseSecrets)(
  "member removal and super-admin provisioning against hosted Supabase",
  () => {
    let admin: ReturnType<typeof createAdminClient>;
    let orgAId: string;
    let orgBId: string;
    let adminOrgId: string;
    let gestorA: SeededUser;
    let gestorB: SeededUser;
    let advogadoA: SeededUser;
    let advogadoA2: SeededUser;
    let superAdmin: SeededUser;
    const createdOrgIds: string[] = [];
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      admin = createAdminClient();

      async function createOrg(name: string) {
        const { data, error } = await admin
          .from("organizations")
          .insert({ name })
          .select("id")
          .single();

        if (error || !data) {
          throw error ?? new Error(`Could not create org ${name}`);
        }

        createdOrgIds.push(data.id);
        return data.id;
      }

      orgAId = await createOrg(`Escritório Teste A ${Date.now()}`);
      orgBId = await createOrg(`Escritório Teste B ${Date.now()}`);
      adminOrgId = await createOrg(`Elite Juris Teste ${Date.now()}`);

      [gestorA, gestorB, advogadoA, advogadoA2, superAdmin] = await Promise.all([
        seedUser(admin, {
          fullName: "Gestor A",
          organizationId: orgAId,
          prefix: "gestor-a",
          role: "gestor"
        }),
        seedUser(admin, {
          fullName: "Gestor B",
          organizationId: orgBId,
          prefix: "gestor-b",
          role: "gestor"
        }),
        seedUser(admin, {
          fullName: "Advogado A",
          organizationId: orgAId,
          prefix: "advogado-a",
          role: "advogado"
        }),
        seedUser(admin, {
          fullName: "Advogado A2",
          organizationId: orgAId,
          prefix: "advogado-a2",
          role: "advogado"
        }),
        seedUser(admin, {
          fullName: "Super Admin Teste",
          organizationId: adminOrgId,
          prefix: "super-admin",
          role: "super_admin"
        })
      ]);

      createdUserIds.push(
        gestorA.userId,
        gestorB.userId,
        advogadoA.userId,
        advogadoA2.userId,
        superAdmin.userId
      );
    }, 120_000);

    afterAll(async () => {
      // Best-effort cleanup: orgs cascade profiles/invitations/conversations.
      for (const orgId of createdOrgIds) {
        await admin.from("audit_log").delete().eq("organization_id", orgId);
        await admin.from("organizations").delete().eq("id", orgId);
      }

      for (const userId of createdUserIds) {
        await admin.auth.admin.deleteUser(userId).catch(() => null);
      }
    }, 120_000);

    it("teste 1: gestor remove advogado — soft-removal preserva o usuário no auth (D-11)", async () => {
      const response = await deleteMember(advogadoA.userId, gestorA.accessToken);

      expect(response.status).toBe(200);

      const { data: profile } = await admin
        .from("profiles")
        .select("status, removed_at")
        .eq("user_id", advogadoA.userId)
        .single();

      expect(profile?.status).toBe("removed");
      expect(profile?.removed_at).not.toBeNull();

      // Histórico preservado: o usuário NÃO é deletado do auth.
      const { data: authUser, error } = await admin.auth.admin.getUserById(
        advogadoA.userId
      );

      expect(error).toBeNull();
      expect(authUser.user?.id).toBe(advogadoA.userId);

      // Auditoria da remoção.
      const { data: auditRows } = await admin
        .from("audit_log")
        .select("action, actor_user_id, organization_id")
        .eq("organization_id", orgAId)
        .eq("action", "member.removed");

      expect(auditRows?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(auditRows?.[0]?.actor_user_id).toBe(gestorA.userId);
    });

    it("teste 2: acesso morre imediatamente — token antigo lê 0 linhas sem refresh e o refresh é revogado (Pitfall 4 / A5)", async () => {
      // Token emitido ANTES da remoção do teste 1, sem novo login.
      const staleClient = tokenClient(advogadoA.accessToken);

      const [{ data: orgs }, { data: conversations }] = await Promise.all([
        staleClient.from("organizations").select("id"),
        staleClient.from("conversations").select("id")
      ]);

      expect(orgs ?? []).toHaveLength(0);
      expect(conversations ?? []).toHaveLength(0);

      // Refresh token revogado: usuário banido não recebe novos tokens.
      const { data: refreshed, error: refreshError } = await anonClient().auth.refreshSession({
        refresh_token: advogadoA.refreshToken
      });

      expect(refreshError).not.toBeNull();
      expect(refreshed.session).toBeNull();
    });

    it("teste 3: gestor de outra org recebe 404; advogado recebe 403", async () => {
      const crossOrgResponse = await deleteMember(
        advogadoA2.userId,
        gestorB.accessToken
      );

      expect([403, 404]).toContain(crossOrgResponse.status);
      expect(crossOrgResponse.status).toBe(404);

      const advogadoResponse = await deleteMember(
        gestorA.userId,
        advogadoA2.accessToken
      );

      expect(advogadoResponse.status).toBe(403);

      const { data: untouched } = await admin
        .from("profiles")
        .select("status")
        .eq("user_id", advogadoA2.userId)
        .single();

      expect(untouched?.status).toBe("active");
    });

    it("regras de proteção: auto-remoção e último gestor ativo são bloqueados (400)", async () => {
      const selfResponse = await deleteMember(gestorA.userId, gestorA.accessToken);

      expect(selfResponse.status).toBe(400);

      // gestorB é o único gestor ativo da org B — nem o super-admin pode removê-lo.
      const lastGestorResponse = await deleteMember(
        gestorB.userId,
        superAdmin.accessToken
      );

      expect(lastGestorResponse.status).toBe(400);

      const { data: gestorBProfile } = await admin
        .from("profiles")
        .select("status")
        .eq("user_id", gestorB.userId)
        .single();

      expect(gestorBProfile?.status).toBe("active");
    });

    it("teste 4: D-12 ponta a ponta — removido é reconvidado, aceita e volta a active com o MESMO user_id", async () => {
      const { POST: createInvitation } = await import("../app/api/invitations/route");
      const { POST: acceptInvitation } = await import(
        "../app/api/invitations/accept/route"
      );

      const createResponse = await createInvitation(
        await jsonRequest(
          "/api/invitations",
          { email: advogadoA.email, role: "advogado" },
          bearer(gestorA.accessToken)
        )
      );
      const created = await createResponse.json();

      expect(createResponse.status).toBe(201);

      const acceptResponse = await acceptInvitation(
        await jsonRequest("/api/invitations/accept", {
          token: created.token,
          fullName: "Advogado A Reativado",
          password: "senha-reativada-123"
        })
      );
      const accepted = await acceptResponse.json();

      expect(acceptResponse.status).toBe(200);
      expect(accepted.profile.user_id).toBe(advogadoA.userId);
      expect(accepted.profile.status).toBe("active");
      expect(accepted.profile.removed_at).toBeNull();
    });

    it("teste 5: POST /api/admin/organizations — super_admin cria org + convite de gestor com auditoria; gestor comum recebe 403", async () => {
      const { POST } = await import("../app/api/admin/organizations/route");
      const gestorEmail = uniqueEmail("gestor-provisionado");
      const organizationName = `Escritório Provisionado ${Date.now()}`;

      const response = await POST(
        await jsonRequest(
          "/api/admin/organizations",
          { organizationName, gestorEmail },
          bearer(superAdmin.accessToken)
        )
      );
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.organization.name).toBe(organizationName);

      createdOrgIds.push(payload.organization.id);

      // Convite pendente de gestor criado pelo MESMO mecanismo do 01-05 (D-03).
      const { data: invitation } = await admin
        .from("invitations")
        .select("email, role, status")
        .eq("organization_id", payload.organization.id)
        .single();

      expect(invitation?.email).toBe(gestorEmail.toLowerCase());
      expect(invitation?.role).toBe("gestor");
      expect(invitation?.status).toBe("pending");

      // Toda ação de super-admin auditada (quem, o quê, qual organização).
      const { data: auditRows } = await admin
        .from("audit_log")
        .select("action, actor_user_id")
        .eq("organization_id", payload.organization.id);

      const actions = (auditRows ?? []).map((row) => row.action);

      expect(actions).toContain("org.created");
      expect(actions).toContain("gestor.invited");
      expect(
        (auditRows ?? []).every((row) => row.actor_user_id === superAdmin.userId)
      ).toBe(true);

      // D-03 provado: o convite do admin é aceito pelo MESMO fluxo /convite/[token].
      const { POST: acceptInvitation } = await import(
        "../app/api/invitations/accept/route"
      );
      const acceptResponse = await acceptInvitation(
        await jsonRequest("/api/invitations/accept", {
          token: payload.token,
          fullName: "Gestor Provisionado",
          password: "senha-gestor-123"
        })
      );
      const accepted = await acceptResponse.json();

      expect(acceptResponse.status).toBe(200);
      expect(accepted.profile.role).toBe("gestor");
      expect(accepted.profile.organization_id).toBe(payload.organization.id);

      createdUserIds.push(accepted.profile.user_id);

      // Gestor comum não provisiona organizações.
      const forbiddenResponse = await POST(
        await jsonRequest(
          "/api/admin/organizations",
          {
            organizationName: "Escritório Não Autorizado",
            gestorEmail: uniqueEmail("nao-autorizado")
          },
          bearer(gestorA.accessToken)
        )
      );

      expect(forbiddenResponse.status).toBe(403);
    });
  }
);
