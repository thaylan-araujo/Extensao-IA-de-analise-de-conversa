import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "../../../lib/supabase/server";

function errorRedirect(origin: string) {
  return NextResponse.redirect(
    new URL("/recuperar-senha?erro=link-invalido", origin)
  );
}

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/nova-senha";
  }

  return next;
}

export async function GET(request: NextRequest | Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || type !== "recovery") {
    return errorRedirect(url.origin);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery"
  });

  if (error) {
    return errorRedirect(url.origin);
  }

  return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), url.origin));
}
