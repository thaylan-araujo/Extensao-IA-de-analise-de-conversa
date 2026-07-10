import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getActorContext, invitationIdFrom, jsonError } from "../_helpers";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
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
  const { data: invitation, error } = await actor.admin
    .from("invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("organization_id", actor.organizationId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error || !invitation) {
    return jsonError("Convite pendente não encontrado.", 404);
  }

  return NextResponse.json({ invitation });
}
