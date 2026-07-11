import type { Database, UserRole } from "@copiloto/shared";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseBrowserEnv } from "./env";

const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/recuperar-senha",
  "/nova-senha",
  "/convite",
  "/auth",
  "/sem-acesso"
];

function startsWithRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTE_PREFIXES.some((route) => startsWithRoute(pathname, route));
}

function isAdminRoute(pathname: string) {
  return startsWithRoute(pathname, "/admin");
}

export function decideRedirect(
  role: UserRole | null | undefined,
  pathname: string
): string | null {
  if (!role) {
    return isPublicRoute(pathname) ? null : "/login";
  }

  if (role === "advogado") {
    return isPublicRoute(pathname) ? null : "/sem-acesso";
  }

  if (role === "gestor" && isAdminRoute(pathname)) {
    return "/";
  }

  return null;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cookiesToApply: Parameters<typeof response.cookies.set>[] = [];
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          cookiesToApply.push([name, value, options]);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  // O papel vem das claims do JWT (injetadas pelo custom_access_token_hook).
  // getUser() retorna o registro do usuário SEM as claims do hook — usar
  // getClaims(), que valida o token e expõe app_metadata.user_role (D-07).
  const { data: claimsData } = await supabase.auth.getClaims();
  const appMetadata = claimsData?.claims?.app_metadata as
    | { user_role?: UserRole }
    | undefined;
  const role = appMetadata?.user_role;
  const redirectTo = decideRedirect(role, request.nextUrl.pathname);

  if (!redirectTo) {
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = redirectTo;
  redirectUrl.search = "";

  const redirectResponse = NextResponse.redirect(redirectUrl);
  cookiesToApply.forEach((cookie) => {
    redirectResponse.cookies.set(...cookie);
  });

  return redirectResponse;
}
