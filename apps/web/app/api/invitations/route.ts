import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { renderInviteEmail } from "../../../lib/email/templates/invite";
import { sendEmail } from "../../../lib/email";
import { generateInviteToken } from "../../../lib/invitations/token";
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

const INVITE_EXPIRES_IN_DAYS = 7;

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
  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: invitation, error } = await actor.admin
    .from("invitations")
    .insert({
      email,
      expires_at: expiresAt,
      invited_by: actor.user.id,
      organization_id: actor.organizationId,
      role,
      token_hash: tokenHash
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    return jsonError("Convite pendente já existe. Reenvie o convite.", 409);
  }

  if (error) {
    return jsonError("Não foi possível criar o convite.", 500);
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/convite/${token}`;
  const emailContent = renderInviteEmail({
    expiresInDays: INVITE_EXPIRES_IN_DAYS,
    inviteUrl,
    organizationName: organization?.name ?? "sua organização"
  });

  await sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html
  });

  return NextResponse.json(
    {
      invitation,
      token: process.env.EMAIL_DRIVER === "resend" ? undefined : token
    },
    { status: 201 }
  );
}
