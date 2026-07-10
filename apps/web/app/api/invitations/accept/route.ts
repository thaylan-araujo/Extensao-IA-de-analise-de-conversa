import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "../../../../lib/supabase/admin";
import { hashToken } from "../../../../lib/invitations/token";
import { findAuthUserByEmail, jsonError } from "../_helpers";

const acceptInvitationSchema = z.object({
  fullName: z.string().trim().min(2),
  password: z.string().min(8),
  token: z.string().min(20)
});

export async function POST(request: NextRequest | Request) {
  const parsed = acceptInvitationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Dados do cadastro inválidos.", 400);
  }

  const admin = createAdminClient();
  const tokenHash = hashToken(parsed.data.token);
  const { data: invitation } = await admin
    .from("invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("status", "pending")
    .maybeSingle();

  if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
    return jsonError("Convite inválido ou expirado.", 410);
  }

  const existingUser = await findAuthUserByEmail(admin, invitation.email);
  let profile:
    | {
        full_name: string;
        organization_id: string;
        removed_at: string | null;
        role: "advogado" | "gestor" | "super_admin";
        status: "active" | "removed";
        user_id: string;
      }
    | null = null;

  if (existingUser) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (
      existingProfile?.organization_id === invitation.organization_id &&
      existingProfile.status === "removed"
    ) {
      const { error: updateUserError } = await admin.auth.admin.updateUserById(
        existingUser.id,
        {
          ban_duration: "none",
          password: parsed.data.password,
          user_metadata: { full_name: parsed.data.fullName }
        }
      );

      if (updateUserError) {
        return jsonError("Não foi possível reativar a conta.", 500);
      }

      const { data: reactivatedProfile, error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: parsed.data.fullName,
          removed_at: null,
          role: invitation.role,
          status: "active"
        })
        .eq("user_id", existingUser.id)
        .select("*")
        .single();

      if (profileError) {
        return jsonError("Não foi possível reativar o perfil.", 500);
      }

      profile = reactivatedProfile;
    } else {
      return jsonError("Este e-mail já pertence a uma organização.", 409);
    }
  } else {
    const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
      email: invitation.email,
      email_confirm: true,
      password: parsed.data.password,
      user_metadata: { full_name: parsed.data.fullName }
    });

    if (userError || !createdUser.user) {
      return jsonError("Não foi possível criar a conta.", 500);
    }

    const { data: createdProfile, error: profileError } = await admin
      .from("profiles")
      .insert({
        full_name: parsed.data.fullName,
        organization_id: invitation.organization_id,
        role: invitation.role,
        status: "active",
        user_id: createdUser.user.id
      })
      .select("*")
      .single();

    if (profileError) {
      return jsonError("Não foi possível criar o perfil.", 500);
    }

    profile = createdProfile;
  }

  const { data: acceptedInvitation, error: invitationError } = await admin
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)
    .select("*")
    .single();

  if (invitationError) {
    return jsonError("Não foi possível concluir o convite.", 500);
  }

  return NextResponse.json({ invitation: acceptedInvitation, profile });
}
