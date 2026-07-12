/**
 * Teaser da IA (D-05): interface completa já desenhada porém DESATIVADA.
 * Visual travado no 02-UI-SPEC.md: fundo zinc-50, texto zinc-400, cursor
 * not-allowed, badge "Em breve". A Fase 3/4 apenas ativa — o layout não muda.
 * O botão só ganha o accent emerald quando ativado (lista fechada do accent).
 */
function ComingSoonBadge() {
  return (
    <span className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-600">
      Em breve
    </span>
  );
}

export function AiTeaser() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-zinc-950">Copiloto de IA</h2>

      <div className="flex items-center justify-between gap-2 rounded bg-zinc-50 p-4">
        <button
          className="h-11 flex-1 cursor-not-allowed rounded bg-zinc-100 px-4 text-sm font-semibold text-zinc-400"
          disabled
          type="button"
        >
          Sugerir resposta
        </button>
        <ComingSoonBadge />
      </div>

      <div className="flex items-center justify-between gap-2 rounded bg-zinc-50 p-4">
        <div className="flex flex-col gap-1">
          <span className="cursor-not-allowed text-sm font-semibold text-zinc-400">
            Diagnóstico da conversa
          </span>
          <span className="text-xs text-zinc-400">
            Nota e feedback ao final do atendimento.
          </span>
        </div>
        <ComingSoonBadge />
      </div>
    </section>
  );
}
