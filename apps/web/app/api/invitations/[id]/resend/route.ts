import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { renderInviteEmail } from "../../../../../lib/email/templates/invite";
import { sendEmail } from "../../../../../lib/email";
import { generateInviteToken } from "../../../../../lib/invitations/token";
import { getActorContext, invitationIdFrom, jsonError } from "../../_helpers";

const INVITE_EXPIRES_IN_DAYS = 7;
const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const parsedParams = routeParamsSchema.safeParse({
    id: await invitationIdFrom(request, context)
  });

  if (!parsedParams.success) {
    return jsonError("Convite não encontrado.", 404);
  }
  const invitationId = parsedParams.data.id;

  const actorContext = await getActorContext(request);
  if ("error" in actorContext) {
    return actorContext.error;
  }

  const { actor } = actorContext;
  const { data: existing } = await actor.admin
    .from("invitations")
    .select("*")
    .eq("id", invitationId)
    .eq("organization_id", actor.organizationId)
    .eq("status", "pending")
    .maybeSingle();

  if (!existing) {
    return jsonError("Convite pendente não encontrado.", 404);
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
    .update({ expires_at: expiresAt, token_hash: tokenHash })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) {
    return jsonError("Não foi possível reenviar o convite.", 500);
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/convite/${token}`;
  const emailContent = renderInviteEmail({
    expiresInDays: INVITE_EXPIRES_IN_DAYS,
    inviteUrl,
    organizationName: organization?.name ?? "sua organização"
  });

  await sendEmail({
    to: invitation.email,
    subject: emailContent.subject,
    html: emailContent.html
  });

  return NextResponse.json({
    invitation,
    token: process.env.EMAIL_DRIVER === "resend" ? undefined : token
  });
}
