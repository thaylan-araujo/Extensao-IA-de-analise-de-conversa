/**
 * Aba recolhida de 40px (D-07): logo no topo, seta de expandir e o status dot
 * SEMPRE visível (D-08) — recolher não pausa a leitura (D-04, só CSS/layout).
 */
import { ChevronLeft } from "lucide-react";

import { StatusBadge } from "./StatusBadge";
import { usePanel } from "./store";

export function CollapsedTab() {
  const { monitoring, setCollapsed } = usePanel();

  return (
    <div className="flex h-full flex-col items-center gap-4 bg-zinc-50 py-4">
      <span aria-label="Copiloto Jurídico" className="text-xs font-semibold text-zinc-950">
        CJ
      </span>

      <button
        aria-label="Expandir painel"
        className="flex h-11 w-8 items-center justify-center rounded text-zinc-600 transition hover:bg-zinc-200 focus:ring-2 focus:ring-emerald-100"
        onClick={() => setCollapsed(false)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>

      <StatusBadge dotOnly status={monitoring} />
    </div>
  );
}
