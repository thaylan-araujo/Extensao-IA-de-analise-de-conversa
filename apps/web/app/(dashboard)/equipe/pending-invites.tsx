"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingInvite = {
  daysRemaining: number;
  email: string;
  expires_at: string;
  id: string;
  role: "advogado" | "gestor" | "super_admin";
};

export function PendingInvites({ invitations }: { invitations: PendingInvite[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function mutateInvitation(id: string, action: "resend" | "cancel") {
    setError(null);
    setBusyId(id);

    if (action === "cancel") {
      const confirmed = window.confirm("Cancelar este convite pendente?");
      if (!confirmed) {
        setBusyId(null);
        return;
      }
    }

    const response = await fetch(
      action === "resend" ? `/api/invitations/${id}/resend` : `/api/invitations/${id}`,
      { method: action === "resend" ? "POST" : "DELETE" }
    );
    const payload = await response.json();

    setBusyId(null);

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível atualizar o convite.");
      return;
    }

    router.refresh();
  }

  if (!invitations.length) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
        Nenhum convite pendente.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {invitations.map((invitation) => (
        <article
          className="grid gap-4 rounded border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
          key={invitation.id}
        >
          <div>
            <p className="font-medium text-zinc-950">{invitation.email}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {invitation.role} · vence em {invitation.daysRemaining} dias
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busyId === invitation.id}
              onClick={() => mutateInvitation(invitation.id, "resend")}
              type="button"
            >
              Reenviar
            </button>
            <button
              className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busyId === invitation.id}
              onClick={() => mutateInvitation(invitation.id, "cancel")}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
