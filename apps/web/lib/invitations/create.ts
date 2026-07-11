import type { Database, UserRole } from "@copiloto/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { renderInviteEmail } from "../email/templates/invite";
import { sendEmail } from "../email";
import { generateInviteToken } from "./token";

export const INVITE_EXPIRES_IN_DAYS = 7;

type CreateInvitationInput = {
  admin: SupabaseClient<Database>;
  email: string;
  invitedBy: string;
  organizationId: string;
  organizationName: string;
  role: Exclude<UserRole, "super_admin">;
};

/**
 * Mecânica única de convite (D-03): token de 32 bytes, hash SHA-256 no banco,
 * validade de 7 dias e e-mail com o link /convite/[token]. Usada tanto pelo
 * gestor (convite de membro) quanto pelo super-admin (convite do primeiro gestor).
 */
export async function createInvitationAndSendEmail({
  admin,
  email,
  invitedBy,
  organizationId,
  organizationName,
  role
}: CreateInvitationInput) {
  const normalizedEmail = email.toLowerCase();
  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: invitation, error } = await admin
    .from("invitations")
    .insert({
      email: normalizedEmail,
      expires_at: expiresAt,
      invited_by: invitedBy,
      organization_id: organizationId,
      role,
      token_hash: tokenHash
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    return { errorCode: "duplicate" as const };
  }

  if (error || !invitation) {
    return { errorCode: "insert_failed" as const };
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/convite/${token}`;
  const emailContent = renderInviteEmail({
    expiresInDays: INVITE_EXPIRES_IN_DAYS,
    inviteUrl,
    organizationName
  });

  await sendEmail({
    to: normalizedEmail,
    subject: emailContent.subject,
    html: emailContent.html
  });

  return {
    invitation,
    token: process.env.EMAIL_DRIVER === "resend" ? undefined : token
  };
}
