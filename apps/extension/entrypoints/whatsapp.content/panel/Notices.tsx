/**
 * Estados de aviso do painel (02-UI-SPEC.md — copy TRAVADA, strings literais):
 * - EmptyState: nenhuma conversa aberta
 * - GroupNotice: grupo/comunidade aberto (D-02)
 * - BrokenBanner: leitura quebrada / kill-switch (D-13)
 * - RemovedNotice: acesso removido (D-11)
 * - DisconnectedNotice: WhatsApp desconectado (QR/loading — nunca é quebra)
 */
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 p-4">
      <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex flex-col gap-1 text-sm text-amber-900">{children}</div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col gap-2 py-8 text-center">
      <h2 className="text-base font-semibold text-zinc-950">
        Nenhuma conversa aberta
      </h2>
      <p className="text-sm text-zinc-600">
        Abra uma conversa individual no WhatsApp para acompanhar o atendimento.
      </p>
    </div>
  );
}

export function GroupNotice() {
  return (
    <WarningBox>
      <h2 className="text-base font-semibold">Grupos não são monitorados</h2>
      <p>Abra uma conversa individual para acompanhar o atendimento.</p>
    </WarningBox>
  );
}

export function BrokenBanner() {
  return (
    <WarningBox>
      <p>
        O WhatsApp mudou e estamos ajustando a leitura. Suas conversas não
        estão sendo registradas neste momento e as funções de IA estão
        pausadas. Você não precisa fazer nada — voltaremos automaticamente.
      </p>
    </WarningBox>
  );
}

export function RemovedNotice() {
  return (
    <WarningBox>
      <p>Seu acesso foi desativado — fale com seu gestor.</p>
    </WarningBox>
  );
}

export function DisconnectedNotice() {
  return (
    <div className="flex flex-col gap-2 py-8 text-center">
      <h2 className="text-base font-semibold text-zinc-950">
        WhatsApp desconectado
      </h2>
      <p className="text-sm text-zinc-600">
        Conecte o WhatsApp Web neste navegador para acompanhar as conversas.
      </p>
    </div>
  );
}
