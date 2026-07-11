import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "../../../lib/supabase/server";

function errorRedirect(origin: string) {
  return NextResponse.redirect(
    new URL("/recuperar-senha?erro=link-invalido", origin)
  );
}

function safeNextPath(next: string | null) {
  // Barra invertida é normalizada para "/" pelo parser de URL do navegador
  // (WHATWG): "/\evil.example" vira "//evil.example" — open redirect (CR-01).
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return "/nova-senha";
  }

  return next;
}

export async function GET(request: NextRequest | Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));

  // Fluxo do template personalizado: link carrega token_hash + type=recovery.
  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery"
    });

    if (error) {
      return errorRedirect(url.origin);
    }

    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  // Fluxo do template PADRÃO do Supabase (plano Free sem SMTP próprio não aceita
  // template custom): o /auth/v1/verify da Supabase redireciona para cá com ?code=.
  // Trocamos o code por sessão (PKCE) — mesmo resultado do verifyOtp acima.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return errorRedirect(url.origin);
    }

    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  return errorRedirect(url.origin);
}
