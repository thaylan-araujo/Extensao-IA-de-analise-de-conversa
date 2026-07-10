import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "advogado") {
    redirect("/sem-acesso");
  }

  const [{ data: organization }, { count: activeMembers }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "active")
  ]);

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">Painel do gestor</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          {organization?.name ?? "Organização"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Acompanhe a equipe e prepare a base para os diagnósticos das conversas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-600">Membros ativos</p>
          <p className="mt-3 text-4xl font-semibold">{activeMembers ?? 0}</p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-600">Equipe</p>
          <Link
            className="mt-3 inline-flex rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            href="/equipe"
          >
            Ver equipe
          </Link>
        </article>
      </div>
    </section>
  );
}
