import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { logAudit } from "../../../../lib/audit";
import { createInvitationAndSendEmail } from "../../../../lib/invitations/create";
import { getActorContext, jsonError } from "../../invitations/_helpers";

// D-04: cadastro mínimo — SOMENTE nome do escritório e e-mail do gestor.
// CNPJ/faturamento são da Fase 6.
const createOrganizationSchema = z.object({
  gestorEmail: z.string().email(),
  organizationName: z.string().trim().min(2)
});

async function requireSuperAdmin(request: NextRequest | Request) {
  const context = await getActorContext(request, {
    forbiddenMessage: "Apenas super-admin pode gerenciar organizações."
  });

  if ("error" in context) {
    return context;
  }

  if (context.actor.profile.role !== "super_admin") {
    return { error: jsonError("Apenas super-admin pode gerenciar organizações.", 403) };
  }

  return context;
}

export async function POST(request: NextRequest | Request) {
  const parsed = createOrganizationSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return jsonError("Dados da organização inválidos.", 400);
  }

  const context = await requireSuperAdmin(request);
  if ("error" in context) {
    return context.error;
  }

  const { actor } = context;
  const { gestorEmail, organizationName } = parsed.data;

  const { data: organization, error: organizationError } = await actor.admin
    .from("organizations")
    .insert({ name: organizationName })
    .select("id, name, created_at")
    .single();

  if (organizationError || !organization) {
    return jsonError("Não foi possível criar a organização.", 500);
  }

  // D-03: o primeiro gestor entra pelo MESMO fluxo de convite do 01-05 —
  // nenhuma senha temporária circula.
  const result = await createInvitationAndSendEmail({
    admin: actor.admin,
    email: gestorEmail,
    invitedBy: actor.user.id,
    organizationId: organization.id,
    organizationName: organization.name,
    role: "gestor"
  });

  if ("errorCode" in result) {
    // Não deixar organização órfã sem convite de gestor.
    await actor.admin.from("organizations").delete().eq("id", organization.id);
    return jsonError("Não foi possível criar o convite do gestor.", 500);
  }

  await logAudit({
    action: "org.created",
    actorUserId: actor.user.id,
    details: { name: organization.name },
    organizationId: organization.id
  });
  await logAudit({
    action: "gestor.invited",
    actorUserId: actor.user.id,
    details: { email: gestorEmail.toLowerCase() },
    organizationId: organization.id
  });

  return NextResponse.json(
    {
      invitation: result.invitation,
      organization,
      token: result.token
    },
    { status: 201 }
  );
}

export async function GET(request: NextRequest | Request) {
  const context = await requireSuperAdmin(request);
  if ("error" in context) {
    return context.error;
  }

  const { actor } = context;
  const [{ data: organizations }, { data: profiles }, { data: invitations }] =
    await Promise.all([
      actor.admin
        .from("organizations")
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      actor.admin.from("profiles").select("organization_id, status"),
      actor.admin.from("invitations").select("organization_id, status")
    ]);

  const result = (organizations ?? []).map((organization) => ({
    ...organization,
    activeMembers: (profiles ?? []).filter(
      (profile) =>
        profile.organization_id === organization.id && profile.status === "active"
    ).length,
    pendingInvites: (invitations ?? []).filter(
      (invitation) =>
        invitation.organization_id === organization.id &&
        invitation.status === "pending"
    ).length
  }));

  return NextResponse.json({ organizations: result });
}
