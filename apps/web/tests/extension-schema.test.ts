import { createClient } from "@supabase/supabase-js";
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

describe.skipIf(!hasHostedSupabaseSecrets)(
  "extension sync schema against hosted Supabase",
  () => {
    let admin: ReturnType<typeof createAdminClient>;
    let lawyer: ReturnType<typeof tokenClient>;
    let orgId: string;
    let lawyerUserId: string;
    let conversationId: string;
    const waChatId = `sync-chat-${Date.now()}`;

    beforeAll(async () => {
      admin = createAdminClient();

      // Organização e advogado descartáveis via service role — NÃO usa credenciais seed.
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ name: `Escritório Sync Teste ${Date.now()}` })
        .select("id")
        .single();

      if (orgError || !org) {
        throw orgError ?? new Error("Could not create disposable org");
      }

      orgId = org.id;

      const email = uniqueEmail("advogado-sync");
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: PASSWORD
      });

      if (createError || !created.user) {
        throw createError ?? new Error(`Could not create user ${email}`);
      }

      lawyerUserId = created.user.id;

      const { error: profileError } = await admin.from("profiles").insert({
        full_name: "Advogado Sync",
        organization_id: orgId,
        role: "advogado",
        status: "active",
        user_id: lawyerUserId
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

      lawyer = tokenClient(session.session.access_token);
    }, 120_000);

    afterAll(async () => {
      // Cascade limpa profiles/conversations/messages/reader_status da org descartável.
      if (orgId) {
        await admin.from("organizations").delete().eq("id", orgId);
      }

      if (lawyerUserId) {
        await admin.auth.admin.deleteUser(lawyerUserId).catch(() => null);
      }
    }, 120_000);

    it("upsert de conversation por (profile_id, wa_chat_id): segundo upsert atualiza em vez de duplicar", async () => {
      const { data: first, error: firstError } = await lawyer
        .from("conversations")
        .upsert(
          {
            contact_name: "Lead Sync",
            organization_id: orgId,
            profile_id: lawyerUserId,
            wa_chat_id: waChatId
          },
          { onConflict: "profile_id,wa_chat_id" }
        )
        .select("id")
        .single();

      expect(firstError).toBeNull();
      expect(first?.id).toBeTruthy();

      conversationId = first!.id;

      // Reabrir o mesmo chat: mesma linha, contact_name atualizado (policy UPDATE nova).
      const { data: second, error: secondError } = await lawyer
        .from("conversations")
        .upsert(
          {
            contact_name: "Lead Sync Editado",
            organization_id: orgId,
            profile_id: lawyerUserId,
            wa_chat_id: waChatId
          },
          { onConflict: "profile_id,wa_chat_id" }
        )
        .select("id, contact_name")
        .single();

      expect(secondError).toBeNull();
      expect(second?.id).toBe(conversationId);
      expect(second?.contact_name).toBe("Lead Sync Editado");

      const { count } = await lawyer
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", lawyerUserId)
        .eq("wa_chat_id", waChatId);

      expect(count).toBe(1);
    });

    it("upsert duplicado de messages com ignoreDuplicates mantém count 1 (EXT-04)", async () => {
      const batch = [
        {
          content: "Olá, preciso de um advogado",
          conversation_id: conversationId,
          from_me: false,
          kind: "text",
          organization_id: orgId,
          sender: "lead",
          sent_at: new Date().toISOString(),
          wa_message_id: "wamid-integration-1"
        }
      ];

      // Mesmo lote enviado DUAS vezes — reprocessar a tela não duplica.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { error } = await lawyer.from("messages").upsert(batch, {
          ignoreDuplicates: true,
          onConflict: "conversation_id,wa_message_id"
        });

        expect(error).toBeNull();
      }

      const { count } = await lawyer
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .eq("wa_message_id", "wamid-integration-1");

      expect(count).toBe(1);
    });

    it("app_settings.reader_enabled está semeado como true no hospedado (D-15)", async () => {
      const { data, error } = await lawyer
        .from("app_settings")
        .select("value")
        .eq("key", "reader_enabled")
        .single();

      expect(error).toBeNull();
      expect(data?.value).toBe(true);
    });
  }
);
