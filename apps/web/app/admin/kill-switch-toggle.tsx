"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// D-15: o kill-switch é global de propósito — desligar pausa a leitura de
// TODOS os advogados de todos os escritórios (T-02-19: confirmação explícita).
export function KillSwitchToggle({ readerEnabled }: { readerEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle() {
    const next = !readerEnabled;
    const confirmation = next
      ? "Reativar a leitura do WhatsApp para todos os advogados de todos os escritórios?"
      : "Desativar a leitura do WhatsApp de TODOS os advogados de todos os escritórios? O painel e o login continuam funcionando; a extensão mostra o aviso de manutenção até a leitura ser reativada.";

    if (!window.confirm(confirmation)) {
      return;
    }

    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/admin/settings", {
      body: JSON.stringify({ reader_enabled: next }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json().catch(() => ({}));

    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível alterar a leitura.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="grid gap-3 rounded border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={`text-sm font-semibold ${
              readerEnabled ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {readerEnabled ? "Leitura ativa" : "Leitura desativada"}
          </p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
            {readerEnabled
              ? "A extensão está lendo e sincronizando as conversas dos advogados."
              : "A leitura está pausada para todos os escritórios. Painel e login continuam funcionando com o aviso de manutenção."}
          </p>
        </div>
        <button
          className={`h-10 shrink-0 rounded px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-400 ${
            readerEnabled
              ? "bg-red-700 hover:bg-red-800"
              : "bg-emerald-700 hover:bg-emerald-800"
          }`}
          disabled={isLoading}
          onClick={handleToggle}
          type="button"
        >
          {isLoading
            ? "Aplicando..."
            : readerEnabled
              ? "Desativar leitura"
              : "Reativar leitura"}
        </button>
      </div>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
