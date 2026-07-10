import type { Database, UserRole } from "@copiloto/shared";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "../../../lib/supabase/server";
import { getSupabaseBrowserEnv } from "../../../lib/supabase/env";

export const invitationRoleSchema = z.enum(["advogado", "gestor"]);

type AppSupabase = SupabaseClient<Database>;

export type ActorContext = {
  admin: ReturnType<typeof createAdminClient>;
  organizationId: string;
  profile: {
    full_name: string;
    organization_id: string;
    role: UserRole;
    status: "active" | "removed";
    user_id: string;
  };
  supabase: AppSupabase;
  user: { id: string; email?: string };
};

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: NextRequest | Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

async function createRequestSupabase(request: NextRequest | Request) {
  const token = bearerToken(request);

  if (!token) {
    return createServerSupabaseClient();
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

export async function getActorContext(request: NextRequest | Request) {
  const supabase = await createRequestSupabase(request);
  const token = bearerToken(request);
  const {
    data: { user }
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();

  if (!user) {
    return { error: jsonError("Faça login para continuar.", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, organization_id, full_name, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return { error: jsonError("Seu acesso não está ativo.", 403) };
  }

  if (profile.role !== "gestor" && profile.role !== "super_admin") {
    return { error: jsonError("Apenas gestor pode gerenciar convites.", 403) };
  }

  return {
    actor: {
      admin: createAdminClient(),
      organizationId: profile.organization_id,
      profile,
      supabase,
      user: { id: user.id, email: user.email }
    } satisfies ActorContext
  };
}

export async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );

    if (user || data.users.length < 1000) {
      return user ?? null;
    }

    page += 1;
  }
}

export async function invitationIdFrom(
  request: Request,
  context?: { params?: Promise<{ id: string }> | { id?: string } }
) {
  const params = context?.params ? await context.params : null;

  if (params?.id) {
    return params.id;
  }

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const index = segments.indexOf("invitations");

  return index >= 0 ? segments[index + 1] : undefined;
}
