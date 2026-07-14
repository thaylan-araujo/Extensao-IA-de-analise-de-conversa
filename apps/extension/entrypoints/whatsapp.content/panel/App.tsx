/**
 * Painel completo (02-UI-SPEC.md): renderiza todos os estados da tabela
 * "Estados do painel" a partir da view derivada no store (resolveView).
 *
 * Segurança (T-02-10): o painel renderiza exclusivamente TEXTO — React escapa
 * por default; NENHUMA API de injeção de HTML bruto é permitida em panel/
 * (proibição verificada por grep automatizado na verify do plano).
 */
import { useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";

import { AiTeaser } from "./AiTeaser";
import { LeadCard } from "./LeadCard";
import { LoginForm } from "./LoginForm";
import {
  BrokenBanner,
  DisconnectedNotice,
  EmptyState,
  GroupNotice,
  RemovedNotice,
} from "./Notices";
import { PanelShell } from "./PanelShell";
import { StatusBadge } from "./StatusBadge";
import { usePanel, type PanelView } from "./store";

function Header() {
  const { session, setCollapsed } = usePanel();

  return (
    <header className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 p-4">
      <div className="flex min-w-0 flex-col">
        <span className="text-base font-semibold text-zinc-950">
          Copiloto Jurídico
        </span>
      </div>
      <button
        aria-label="Recolher painel"
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded text-zinc-600 transition hover:bg-zinc-200 focus:ring-2 focus:ring-emerald-100"
        onClick={() => setCollapsed(true)}
        type="button"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </header>
  );
}

function SignOutFooter() {
  const { signOut } = usePanel();
  const [confirming, setConfirming] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleConfirm() {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    setConfirming(false);
  }

  return (
    <footer className="mt-auto border-t border-zinc-200 p-4">
      {confirming ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-800">
            Sair da conta? O monitoramento das conversas fica pausado até você
            entrar novamente.
          </p>
          <div className="flex gap-2">
            <button
              className="h-11 flex-1 rounded bg-red-700 px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isSigningOut}
              onClick={handleConfirm}
              type="button"
            >
              Sair
            </button>
            <button
              className="h-11 flex-1 rounded border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed"
              disabled={isSigningOut}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex h-11 items-center gap-1 rounded px-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 focus:ring-2 focus:ring-emerald-100"
          onClick={() => setConfirming(true)}
          type="button"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sair
        </button>
      )}
    </footer>
  );
}

/** Conteúdo do painel expandido para os estados LOGADOS. */
function AuthenticatedContent({ view }: { view: PanelView }) {
  const { lead, monitoring } = usePanel();

  // Acesso removido (D-11): todo o conteúdo vira o aviso; controles somem.
  if (view === "removido") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <RemovedNotice />
      </div>
    );
  }

  // Quebra/kill-switch (D-13/D-15): banner warning; controles de IA e status
  // ficam ocultos; painel e logout continuam vivos.
  if (view === "quebrado" || view === "kill_switch") {
    return (
      <>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <BrokenBanner />
        </div>
        <SignOutFooter />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <StatusBadge status={monitoring} />

        {view === "wa_desconectado" ? <DisconnectedNotice /> : null}
        {view === "sem_conversa" ? <EmptyState /> : null}
        {view === "grupo" ? <GroupNotice /> : null}
        {view === "conversa_ativa" ? <LeadCard lead={lead} /> : null}

        <AiTeaser />
      </div>
      <SignOutFooter />
    </>
  );
}

export function App() {
  const { view } = usePanel();

  return (
    <PanelShell>
      {view === "carregando" ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-600">Carregando...</p>
        </div>
      ) : view === "deslogado" ? (
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4 py-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-zinc-950">
              Copiloto Jurídico
            </h1>
            <p className="text-sm text-zinc-600">
              Entre com a sua conta para acompanhar os atendimentos.
            </p>
          </div>
          <LoginForm />
        </div>
      ) : (
        <>
          <Header />
          <AuthenticatedContent view={view} />
        </>
      )}
    </PanelShell>
  );
}
