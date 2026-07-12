/**
 * Máquina de estados do painel (02-UI-SPEC.md) + estado compartilhado via React context.
 *
 * O `view` é DERIVADO (função pura resolveView) dos insumos: sessão presente?,
 * profile removido?, kill-switch?, canário quebrado?, chat ativo é grupo?,
 * WhatsApp conectado? — nesta fase os insumos de leitura (chat/canário/kill-switch)
 * chegam como default e os planos 02-04/02-06 os alimentam via setReaderInputs.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { signOutAndClear } from "../sync/session";

export type PanelView =
  | "deslogado"
  | "carregando"
  | "wa_desconectado"
  | "sem_conversa"
  | "conversa_ativa"
  | "grupo"
  | "quebrado"
  | "kill_switch"
  | "removido";

export type MonitoringStatus = "ativa" | "pausada" | "nao_monitorada";

export interface LeadInfo {
  name: string | null;
  phone: string | null;
}

export interface ActiveChat {
  isGroup: boolean;
  lead: LeadInfo | null;
}

/** Insumos alimentados pelo reader/sync (planos 02-04 e 02-06). */
export interface ReaderInputs {
  waConnected: boolean;
  killSwitchActive: boolean;
  readerBroken: boolean;
  activeChat: ActiveChat | null;
}

export interface ResolveViewInput extends ReaderInputs {
  bootLoading: boolean;
  session: Session | null;
  profileRemoved: boolean;
}

/**
 * Função pura que resolve a view do painel a partir dos insumos.
 * Ordem de precedência (Pitfall 2 do 02-RESEARCH.md): boot → sessão →
 * removido (D-11) → kill-switch (D-15) → quebrado (D-13) → WhatsApp
 * desconectado (QR/loading ≠ quebra) → sem conversa → grupo (D-02) → ativa.
 */
export function resolveView(input: ResolveViewInput): PanelView {
  if (input.bootLoading) return "carregando";
  if (!input.session) return "deslogado";
  if (input.profileRemoved) return "removido";
  if (input.killSwitchActive) return "kill_switch";
  if (input.readerBroken) return "quebrado";
  if (!input.waConnected) return "wa_desconectado";
  if (!input.activeChat) return "sem_conversa";
  if (input.activeChat.isGroup) return "grupo";
  return "conversa_ativa";
}

/** Status de monitoramento derivado da view (rótulos travados no StatusBadge — D-08). */
export function resolveMonitoring(view: PanelView): MonitoringStatus {
  switch (view) {
    case "conversa_ativa":
      return "ativa";
    case "grupo":
    case "sem_conversa":
      return "nao_monitorada";
    default:
      return "pausada";
  }
}

export interface PanelContextValue {
  session: Session | null;
  view: PanelView;
  collapsed: boolean;
  lead: LeadInfo | null;
  monitoring: MonitoringStatus;
  setSession: (session: Session | null) => void;
  markRemoved: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setReaderInputs: (partial: Partial<ReaderInputs>) => void;
  signOut: () => Promise<void>;
  forgotPassword: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export interface PanelProviderProps {
  initialSession: Session | null;
  initialProfileRemoved?: boolean;
  initialCollapsed?: boolean;
  /** Persistência D-06 + reserva de largura — o index.tsx injeta o efeito. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Abre o fluxo web da Fase 1 (recuperar-senha) — injetado pelo index.tsx. */
  onForgotPassword?: () => void;
  children: ReactNode;
}

const DEFAULT_READER_INPUTS: ReaderInputs = {
  // Defaults desta fase: o painel só monta com a âncora raiz do WhatsApp
  // presente (index.tsx); a detecção fina de conexão/chat chega no 02-04.
  waConnected: true,
  killSwitchActive: false,
  readerBroken: false,
  activeChat: null,
};

export function PanelProvider({
  initialSession,
  initialProfileRemoved = false,
  initialCollapsed = false,
  onCollapsedChange,
  onForgotPassword,
  children,
}: PanelProviderProps) {
  const [session, setSessionState] = useState<Session | null>(initialSession);
  const [profileRemoved, setProfileRemoved] = useState(initialProfileRemoved);
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [readerInputs, setReaderInputsState] = useState<ReaderInputs>(
    DEFAULT_READER_INPUTS,
  );

  const setSession = useCallback((next: Session | null) => {
    setSessionState(next);
    if (next) setProfileRemoved(false);
  }, []);

  const markRemoved = useCallback(() => {
    setProfileRemoved(true);
  }, []);

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      onCollapsedChange?.(next);
    },
    [onCollapsedChange],
  );

  const setReaderInputs = useCallback((partial: Partial<ReaderInputs>) => {
    setReaderInputsState((current) => ({ ...current, ...partial }));
  }, []);

  const signOut = useCallback(async () => {
    await signOutAndClear();
    setSessionState(null);
    setProfileRemoved(false);
  }, []);

  const forgotPassword = useCallback(() => {
    onForgotPassword?.();
  }, [onForgotPassword]);

  const view = resolveView({
    bootLoading: false,
    session,
    profileRemoved,
    ...readerInputs,
  });

  const value = useMemo<PanelContextValue>(
    () => ({
      session,
      view,
      collapsed,
      lead: readerInputs.activeChat?.lead ?? null,
      monitoring: resolveMonitoring(view),
      setSession,
      markRemoved,
      setCollapsed,
      setReaderInputs,
      signOut,
      forgotPassword,
    }),
    [
      session,
      view,
      collapsed,
      readerInputs,
      setSession,
      markRemoved,
      setCollapsed,
      setReaderInputs,
      signOut,
      forgotPassword,
    ],
  );

  return createElement(PanelContext.Provider, { value }, children);
}

export function usePanel(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanel deve ser usado dentro de <PanelProvider>.");
  }
  return context;
}
