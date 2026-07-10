"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MemberActions({
  fullName,
  userId
}: {
  fullName: string;
  userId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRemove() {
    setError(null);

    const confirmed = window.confirm(
      `Remover ${fullName} da equipe?\n\nO acesso é bloqueado imediatamente. As conversas e notas dele continuam visíveis no painel.`
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);

    const response = await fetch(`/api/members/${userId}`, { method: "DELETE" });
    const payload = await response.json();

    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível remover o membro.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoading}
        onClick={handleRemove}
        type="button"
      >
        {isLoading ? "Removendo..." : "Remover"}
      </button>
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
