import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database, Json } from "@copiloto/shared";

import { createAdminClient } from "../lib/supabase/admin";

const hasHostedSupabaseSecrets =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = "senha-de-teste-123";
const AUDIT_ACTION = "reader.kill_switch.toggled";

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

async function callGet(token: string | null) {
  const { GET } = await import("../app/api/admin/settings/route");

  return GET(
    new Request("http://localhost:3000/api/admin/settings", {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
  );
}

async function callPost(body: unknown, token: string | null) {
  const { POST } = await import("../app/api/admin/settings/route");

  return POST(await jsonRequest("/api/admin/settings", body, bearer(token)));
}

async function readReaderEnabled(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "reader_enabled")
    .single();

  if (error) {
    throw error;
  }

  return data.value;
}

type SeededUser = {
  accessToken: string;
  email: string;
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
    userId: created.user.id
  };
}

async function auditRowsFor(
  admin: ReturnType<typeof createAdminClient>,
  actorUserId: string
) {
  const { data } = await admin
    .from("audit_log")
    .select("action, actor_user_id, details")
    .eq("action", AUDIT_ACTION)
    .eq("actor_user_id", actorUserId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

describe.skipIf(!hasHostedSupabaseSecrets)(
  "kill-switch global via /api/admin/settings contra o hosted (D-15 / EXT-05)",
  () => {
    let admin: ReturnType<typeof createAdminClient>;
    let orgId: string;
    let superAdmin: SeededUser;
    let gestor: SeededUser;
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      admin = createAdminClient();

      const { data: organization, error: orgError } = await admin
        .from("organizations")
        .insert({ name: `Elite Juris Kill-Switch Teste ${Date.now()}` })
        .select("id")
        .single();

      if (orgError || !organization) {
        throw orgError ?? new Error("Could not create test organization");
      }

      orgId = organization.id;

      [superAdmin, gestor] = await Promise.all([
        seedUser(admin, {
          fullName: "Super Admin Kill-Switch",
          organizationId: orgId,
          prefix: "super-admin-ks",
          role: "super_admin"
        }),
        seedUser(admin, {
          fullName: "Gestor Kill-Switch",
          organizationId: orgId,
          prefix: "gestor-ks",
          role: "gestor"
        })
      ]);

      createdUserIds.push(superAdmin.userId, gestor.userId);

      // Estado inicial conhecido: a suíte parte de leitura ligada.
      await admin
        .from("app_settings")
        .update({ value: true as Json })
        .eq("key", "reader_enabled");
    }, 120_000);

    afterAll(async () => {
      // NUNCA deixar o kill-switch acionado após a suíte (restauração obrigatória).
      await admin
        .from("app_settings")
        .update({ value: true as Json })
        .eq("key", "reader_enabled");

      await admin
        .from("audit_log")
        .delete()
        .eq("action", AUDIT_ACTION)
        .in("actor_user_id", createdUserIds.length > 0 ? createdUserIds : ["-"]);

      if (orgId) {
        await admin.from("organizations").delete().eq("id", orgId);
      }

      for (const userId of createdUserIds) {
        await admin.auth.admin.deleteUser(userId).catch(() => null);
      }
    }, 120_000);

    it("teste 1: GET como super-admin retorna 200 com o estado atual da flag", async () => {
      const response = await callGet(superAdmin.accessToken);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ reader_enabled: true });
    }, 30_000);

    it("teste 2: POST desliga a leitura, persiste false em app_settings e grava auditoria", async () => {
      const response = await callPost({ reader_enabled: false }, superAdmin.accessToken);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.reader_enabled).toBe(false);

      // A flag efetivamente virou false no banco.
      expect(await readReaderEnabled(admin)).toBe(false);

      // Cada acionamento gera linha de auditoria com o novo valor.
      const auditRows = await auditRowsFor(admin, superAdmin.userId);

      expect(auditRows).toHaveLength(1);

      const details = auditRows[0]?.details as { reader_enabled?: boolean } | null;

      expect(details?.reader_enabled).toBe(false);
    }, 30_000);

    it("teste 3: POST como gestor recebe 403 em pt-BR e o valor no banco não muda", async () => {
      const response = await callPost({ reader_enabled: true }, gestor.accessToken);
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(typeof payload.error).toBe("string");
      expect(payload.error).toContain("super-admin");

      // O valor segue false (do teste 2): gestor não escreve a flag.
      expect(await readReaderEnabled(admin)).toBe(false);

      // Nenhuma auditoria em nome do gestor.
      expect(await auditRowsFor(admin, gestor.userId)).toHaveLength(0);
    }, 30_000);

    it("teste 4: POST com body inválido (sem reader_enabled booleano) recebe 400", async () => {
      const missingField = await callPost({}, superAdmin.accessToken);

      expect(missingField.status).toBe(400);

      const wrongType = await callPost({ reader_enabled: "sim" }, superAdmin.accessToken);

      expect(wrongType.status).toBe(400);

      // Body inválido não altera o banco.
      expect(await readReaderEnabled(admin)).toBe(false);
    }, 30_000);

    it("teste 5: POST religa a leitura — round-trip completo com nova linha de auditoria", async () => {
      const response = await callPost({ reader_enabled: true }, superAdmin.accessToken);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.reader_enabled).toBe(true);
      expect(await readReaderEnabled(admin)).toBe(true);

      const auditRows = await auditRowsFor(admin, superAdmin.userId);

      expect(auditRows).toHaveLength(2);

      const details = auditRows[1]?.details as { reader_enabled?: boolean } | null;

      expect(details?.reader_enabled).toBe(true);

      // GET reflete o estado restaurado.
      const getResponse = await callGet(superAdmin.accessToken);
      const getPayload = await getResponse.json();

      expect(getPayload).toEqual({ reader_enabled: true });
    }, 30_000);
  }
);
