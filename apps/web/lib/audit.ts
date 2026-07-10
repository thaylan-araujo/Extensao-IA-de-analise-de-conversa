import type { Json } from "@copiloto/shared";

import { createAdminClient } from "./supabase/admin";

type LogAuditInput = {
  action: string;
  actorUserId: string | null;
  details?: Json;
  organizationId?: string | null;
};

/**
 * Registra uma ação sensível em audit_log via service_role.
 * A tabela não tem policy de escrita para authenticated (by design do 01-02):
 * apenas o servidor grava, apenas super_admin lê.
 */
export async function logAudit({
  action,
  actorUserId,
  details,
  organizationId
}: LogAuditInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    action,
    actor_user_id: actorUserId,
    details: details ?? null,
    organization_id: organizationId ?? null
  });

  if (error) {
    // Auditoria não deve derrubar a operação principal, mas o rastro é observável.
    console.error(`[audit] failed to log ${action}:`, error.message);
  }
}
