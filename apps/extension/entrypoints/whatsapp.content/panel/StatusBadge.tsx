/**
 * Indicador de monitoramento (D-08): dot de 8px + rótulo textual travado no
 * 02-UI-SPEC.md. Nunca cor sozinha comunicando estado — na versão dot-only
 * (aba recolhida) o rótulo vira aria-label/title.
 */
import type { MonitoringStatus } from "./store";

const STATUS_CONFIG: Record<
  MonitoringStatus,
  { label: string; dotClass: string }
> = {
  ativa: { label: "Conversa monitorada", dotClass: "bg-emerald-500" },
  pausada: { label: "Monitoramento pausado", dotClass: "bg-amber-600" },
  nao_monitorada: { label: "Não monitorada", dotClass: "bg-zinc-400" },
};

export interface StatusBadgeProps {
  status: MonitoringStatus;
  /** Aba recolhida: só o dot, com o rótulo em aria-label (D-07/D-08). */
  dotOnly?: boolean;
}

export function StatusBadge({ status, dotOnly = false }: StatusBadgeProps) {
  const { label, dotClass } = STATUS_CONFIG[status];

  if (dotOnly) {
    return (
      <span
        aria-label={label}
        className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
        role="status"
        title={label}
      />
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-zinc-600" role="status">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
