import { createClient } from "../../../lib/supabase/server";
import { InviteForm } from "./invite-form";
import { MemberActions } from "./member-actions";
import { PendingInvites } from "./pending-invites";

function roleLabel(role: string) {
  return role === "gestor" ? "gestor" : "advogado";
}

function daysRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export default async function EquipePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, role, status")
      .order("full_name", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  ]);

  const pendingInvites =
    invitations?.map((invitation) => ({
      ...invitation,
      daysRemaining: daysRemaining(invitation.expires_at)
    })) ?? [];

  return (
    <section className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Equipe</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Membros e convites
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            Convide gestores ou advogados e acompanhe convites pendentes.
          </p>
        </div>
        <InviteForm />
      </div>

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Membros</h2>
        <div className="overflow-hidden rounded border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member) => (
                <tr className="border-t border-zinc-200" key={member.user_id}>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    {member.full_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{roleLabel(member.role)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        member.status === "removed"
                          ? "rounded bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700"
                          : "rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800"
                      }
                    >
                      {member.status === "removed" ? "removido" : "ativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {member.status === "active" && member.user_id !== user?.id ? (
                      <MemberActions
                        fullName={member.full_name}
                        userId={member.user_id}
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Convites pendentes</h2>
        <PendingInvites invitations={pendingInvites} />
      </div>
    </section>
  );
}
