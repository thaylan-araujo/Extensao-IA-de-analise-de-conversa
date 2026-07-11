import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "advogado") {
    redirect("/sem-acesso");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <Link className="text-base font-semibold text-zinc-950" href="/">
              Copiloto Jurídico
            </Link>
            <p className="mt-1 text-sm text-zinc-600">
              {organization?.name ?? "Organização"} · {profile.full_name}
            </p>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link className="text-zinc-700 hover:text-emerald-700" href="/">
              Painel
            </Link>
            <Link className="text-zinc-700 hover:text-emerald-700" href="/equipe">
              Equipe
            </Link>
            {profile.role === "super_admin" ? (
              <Link className="text-zinc-700 hover:text-emerald-700" href="/admin">
                Admin
              </Link>
            ) : null}
            <form action="/auth/signout" method="post">
              <button
                className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-100"
                type="submit"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
