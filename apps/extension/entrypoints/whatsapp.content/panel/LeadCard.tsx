/**
 * Card do lead da conversa ativa (nome/telefone exibíveis vindos do header do
 * WhatsApp — SEMPRE texto puro; React escapa por default, nunca HTML bruto).
 */
import type { LeadInfo } from "./store";

export function LeadCard({ lead }: { lead: LeadInfo | null }) {
  const name = lead?.name ?? "Contato sem nome";

  return (
    <div className="flex flex-col gap-1 rounded border border-zinc-200 bg-white p-4">
      <span className="text-base font-semibold text-zinc-950">{name}</span>
      {lead?.phone ? (
        <span className="text-xs text-zinc-600">{lead.phone}</span>
      ) : null}
    </div>
  );
}
