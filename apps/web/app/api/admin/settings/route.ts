import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { logAudit } from "../../../../lib/audit";
import { getActorContext, jsonError } from "../../invitations/_helpers";

// D-15: kill-switch global da leitura do WhatsApp — flag única em
// app_settings (key = 'reader_enabled'), escrita restrita a super-admin.
const updateSettingsSchema = z.object({
  reader_enabled: z.boolean()
});

async function requireSuperAdmin(request: NextRequest | Request) {
  const context = await getActorContext(request, {
    forbiddenMessage: "Apenas super-admin pode controlar a leitura."
  });

  if ("error" in context) {
    return context;
  }

  if (context.actor.profile.role !== "super_admin") {
    return { error: jsonError("Apenas super-admin pode controlar a leitura.", 403) };
  }

  return context;
}

export async function GET(request: NextRequest | Request) {
  const context = await requireSuperAdmin(request);
  if ("error" in context) {
    return context.error;
  }

  const { data: setting, error } = await context.actor.supabase
    .from("app_settings")
    .select("value")
    .eq("key", "reader_enabled")
    .maybeSingle();

  if (error || !setting) {
    return jsonError("Não foi possível ler o estado da leitura.", 500);
  }

  return NextResponse.json({ reader_enabled: setting.value === true });
}

export async function POST(request: NextRequest | Request) {
  const parsed = updateSettingsSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return jsonError("Dados da configuração inválidos.", 400);
  }

  const context = await requireSuperAdmin(request);
  if ("error" in context) {
    return context.error;
  }

  const { actor } = context;
  const { reader_enabled } = parsed.data;

  // Escrita sob RLS: a policy "super admins manage settings" autoriza a
  // sessão do super-admin — service_role desnecessário aqui.
  const { data: updated, error: updateError } = await actor.supabase
    .from("app_settings")
    .update({ value: reader_enabled, updated_at: new Date().toISOString() })
    .eq("key", "reader_enabled")
    .select("value")
    .single();

  if (updateError || !updated) {
    return jsonError("Não foi possível alterar a leitura.", 500);
  }

  // T-02-17: todo acionamento do kill-switch fica na trilha de auditoria.
  await logAudit({
    action: "reader.kill_switch.toggled",
    actorUserId: actor.user.id,
    details: { reader_enabled }
  });

  return NextResponse.json({ reader_enabled: updated.value === true });
}
