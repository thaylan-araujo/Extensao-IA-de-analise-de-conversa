import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createInvitationAndSendEmail } from "../../../lib/invitations/create";
import {
  findAuthUserByEmail,
  getActorContext,
  invitationRoleSchema,
  jsonError
} from "./_helpers";

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: invitationRoleSchema
});

export async function POST(request: NextRequest | Request) {
  const parsed = createInvitationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Dados do convite inválidos.", 400);
  }

  const context = await getActorContext(request);
  if ("error" in context) {
    return context.error;
  }

  const { actor } = context;
  const email = parsed.data.email.toLowerCase();
  const role = parsed.data.role;
  const existingUser = await findAuthUserByEmail(actor.admin, email);

  if (existingUser) {
    const { data: existingProfile } = await actor.admin
      .from("profiles")
      .select("organization_id, status")
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingProfile?.status === "active") {
      return jsonError("Já é membro da equipe.", 409);
    }
  }

  const { count: pendingCount } = await actor.admin
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", actor.organizationId)
    .eq("status", "pending");

  if ((pendingCount ?? 0) >= 20) {
    return jsonError("Limite de convites pendentes atingido.", 429);
  }

  const { data: organization } = await actor.admin
    .from("organizations")
    .select("name")
    .eq("id", actor.organizationId)
    .single();

  const result = await createInvitationAndSendEmail({
    admin: actor.admin,
    email,
    invitedBy: actor.user.id,
    organizationId: actor.organizationId,
    organizationName: organization?.name ?? "sua organização",
    role
  });

  if ("errorCode" in result) {
    if (result.errorCode === "duplicate") {
      return jsonError("Convite pendente já existe. Reenvie o convite.", 409);
    }

    return jsonError("Não foi possível criar o convite.", 500);
  }

  return NextResponse.json(
    {
      invitation: result.invitation,
      token: result.token
    },
    { status: 201 }
  );
}
