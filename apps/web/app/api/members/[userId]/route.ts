import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { logAudit } from "../../../../lib/audit";
import { getActorContext, jsonError } from "../../invitations/_helpers";

const userIdSchema = z.string().uuid();

// Ban de longa duração (~100 anos): usuário banido não recebe novos tokens
// (refresh falha), e o unban da reativação D-12 já existe no accept do 01-05.
const REMOVAL_BAN_DURATION = "876000h";

export async function DELETE(
  request: NextRequest | Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId: rawUserId } = await context.params;
  const parsedUserId = userIdSchema.safeParse(rawUserId);

  if (!parsedUserId.success) {
    return jsonError("Membro não encontrado.", 404);
  }

  const actorContext = await getActorContext(request, {
    forbiddenMessage: "Apenas gestor pode remover membros."
  });

  if ("error" in actorContext) {
    return actorContext.error;
  }

  const { actor } = actorContext;
  const userId = parsedUserId.data;

  if (userId === actor.user.id) {
    return jsonError("Você não pode remover a si mesmo.", 400);
  }

  const { data: target } = await actor.admin
    .from("profiles")
    .select("user_id, organization_id, full_name, role, status")
    .eq("user_id", userId)
    .maybeSingle();

  // 404 também para cross-org: não revelar existência de membros de outras orgs.
  const isSameOrg = target?.organization_id === actor.organizationId;
  const isSuperAdmin = actor.profile.role === "super_admin";

  if (!target || target.status !== "active" || (!isSameOrg && !isSuperAdmin)) {
    return jsonError("Membro não encontrado.", 404);
  }

  if (target.role === "gestor") {
    const { count: activeGestores } = await actor.admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", target.organization_id)
      .eq("role", "gestor")
      .eq("status", "active");

    if ((activeGestores ?? 0) <= 1) {
      return jsonError(
        "Não é possível remover o último gestor ativo da organização.",
        400
      );
    }
  }

  // Soft-removal (D-11): NUNCA delete de profiles/auth.users — histórico preservado.
  const { data: removedProfile, error: removeError } = await actor.admin
    .from("profiles")
    .update({
      removed_at: new Date().toISOString(),
      status: "removed"
    })
    .eq("user_id", userId)
    .select("user_id, organization_id, full_name, role, status, removed_at")
    .single();

  if (removeError || !removedProfile) {
    return jsonError("Não foi possível remover o membro.", 500);
  }

  // Revogação imediata de sessões (D-11 / Assumption A5):
  // `auth.admin.signOut(jwt)` exige o JWT do próprio usuário — indisponível no
  // servidor. O ban bloqueia o grant de refresh tokens (sessão morre no refresh),
  // e o RLS por lookup em profiles já nega leituras imediatamente, sem refresh.
  const { error: banError } = await actor.admin.auth.admin.updateUserById(userId, {
    ban_duration: REMOVAL_BAN_DURATION
  });

  if (banError) {
    console.error("[members] failed to ban removed user:", banError.message);
  }

  await logAudit({
    action: "member.removed",
    actorUserId: actor.user.id,
    details: {
      target_full_name: target.full_name,
      target_role: target.role,
      target_user_id: userId
    },
    organizationId: target.organization_id
  });

  return NextResponse.json({ profile: removedProfile });
}
