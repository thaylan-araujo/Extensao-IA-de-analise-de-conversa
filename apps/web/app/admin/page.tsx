import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";
import { CreateOrgForm } from "./create-org-form";
import { KillSwitchToggle } from "./kill-switch-toggle";

// D-14: rótulos de saúde da leitura por advogado (ok/drift/broken).
const readerStatusLabels: Record<string, { className: string; label: string }> = {
  broken: { className: "text-red-700", label: "Quebrada" },
  drift: { className: "text-amber-600", label: "Drift de seletor" },
  ok: { className: "text-emerald-700", label: "Leitura OK" }
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Guarda dupla (além do gate do proxy): checagem server-side de super_admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active" || profile.role !== "super_admin") {
    redirect("/");
  }

  // Super-admin lê todas as organizações via RLS (private.is_super_admin()).
  const [
    { data: organizations },
    { data: profiles },
    { data: invitations },
    { data: readerSetting },
    { data: readerStatuses }
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("user_id, full_name, organization_id, status"),
    supabase.from("invitations").select("organization_id, status"),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "reader_enabled")
      .maybeSingle(),
    supabase
      .from("reader_status")
      .select("profile_id, organization_id, status, extension_version, last_seen_at")
      .order("last_seen_at", { ascending: false })
  ]);

  const rows = (organizations ?? []).map((organization) => ({
    ...organization,
    activeMembers: (profiles ?? []).filter(
      (candidate) =>
        candidate.organization_id === organization.id &&
        candidate.status === "active"
    ).length,
    pendingInvites: (invitations ?? []).filter(
      (invitation) =>
        invitation.organization_id === organization.id &&
        invitation.status === "pending"
    ).length
  }));

  const readerEnabled = readerSetting?.value === true;

  // Join em memória (mesmo padrão das contagens acima): reader_status →
  // full_name do profile e nome da organização.
  const fullNameByUserId = new Map(
    (profiles ?? []).map((candidate) => [candidate.user_id, candidate.full_name])
  );
  const organizationNameById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization.name])
  );
  const readerRows = (readerStatuses ?? []).map((status) => ({
    ...status,
    fullName: fullNameByUserId.get(status.profile_id) ?? "—",
    organizationName: organizationNameById.get(status.organization_id) ?? "—"
  }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <Link className="text-base font-semibold text-zinc-950" href="/admin">
              Administração Elite Juris
            </Link>
            <p className="mt-1 text-sm text-zinc-600">{profile.full_name}</p>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link className="text-zinc-700 hover:text-emerald-700" href="/">
              Painel
            </Link>
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
      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Administração</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              Organizações
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Crie escritórios e convide o primeiro gestor. Toda ação fica
              registrada no log de auditoria.
            </p>
          </div>
          <CreateOrgForm />
        </div>

        <div className="overflow-hidden rounded border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Escritório</th>
                <th className="px-4 py-3 font-medium">Membros ativos</th>
                <th className="px-4 py-3 font-medium">Convites pendentes</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-600" colSpan={4}>
                    Nenhuma organização cadastrada.
                  </td>
                </tr>
              ) : (
                rows.map((organization) => (
                  <tr className="border-t border-zinc-200" key={organization.id}>
                    <td className="px-4 py-3 font-medium text-zinc-950">
                      {organization.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {organization.activeMembers}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {organization.pendingInvites}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {new Date(organization.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section className="grid gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">
              Leitura do WhatsApp
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Kill-switch global: desligar pausa a leitura de todos os advogados
              de todos os escritórios. Cada acionamento fica no log de auditoria.
            </p>
          </div>
          <KillSwitchToggle readerEnabled={readerEnabled} />
        </section>

        <section className="grid gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">
              Saúde da leitura
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Estado reportado pela extensão de cada advogado. É aqui que uma
              quebra do WhatsApp Web aparece antes dos clientes reclamarem.
            </p>
          </div>
          <div className="overflow-hidden rounded border border-zinc-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Advogado</th>
                  <th className="px-4 py-3 font-medium">Escritório</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Versão</th>
                  <th className="px-4 py-3 font-medium">Último sinal</th>
                </tr>
              </thead>
              <tbody>
                {readerRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-zinc-600" colSpan={5}>
                      Nenhuma extensão reportou ainda.
                    </td>
                  </tr>
                ) : (
                  readerRows.map((row) => {
                    const badge = readerStatusLabels[row.status] ?? {
                      className: "text-zinc-700",
                      label: row.status
                    };

                    return (
                      <tr className="border-t border-zinc-200" key={row.profile_id}>
                        <td className="px-4 py-3 font-medium text-zinc-950">
                          {row.fullName}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {row.organizationName}
                        </td>
                        <td className={`px-4 py-3 font-medium ${badge.className}`}>
                          {badge.label}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {row.extension_version ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {new Date(row.last_seen_at).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
