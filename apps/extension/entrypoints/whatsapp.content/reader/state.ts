/**
 * Adapter fino entre os sinais do reader e os insumos do PanelProvider (02-06).
 *
 * Por que "adapter" e não "reducer completo"?
 * O resolveView (função pura da máquina de estados do painel) já vive em
 * panel/store.ts e é alimentado via setReaderInputs(partial: ReaderInputs).
 * Este módulo faz SOMENTE o mapeamento canary/killSwitch/activeChat → ReaderInputs,
 * sem duplicar a lógica de prioridade que o store.ts já encapsula.
 *
 * Tabela de mapeamento de canário → ReaderInputs (Pitfall 2 do 02-RESEARCH.md):
 *   "disconnected" → waConnected: false, readerBroken: false  (QR/loading ≠ quebra)
 *   "no_chat"      → waConnected: true, activeChat: null
 *   "broken"       → readerBroken: true
 *   "drift"/"ok"   → readerBroken: false, waConnected: true
 *
 * D-04: `collapsed` não existe em ReaderSignals — a leitura é completamente
 * indiferente ao estado do painel (recolher não pausa a leitura).
 */
import type { Session } from "@supabase/supabase-js";
import type { CanaryVerdict } from "./canary";
import type { ActiveChat, ReaderInputs } from "../panel/store";

/**
 * Sinais do ciclo de leitura que o healthCycle e os observers produzem.
 * Estes são os insumos "brutos" antes do mapeamento para ReaderInputs.
 */
export interface ReaderSignals {
  /** Sessão do advogado (não mapeada para ReaderInputs — insumo direto do PanelProvider). */
  session: Session | null;
  /** Profile removido (não mapeado para ReaderInputs — insumo direto do PanelProvider). */
  profileRemoved: boolean;
  /**
   * Conectividade do WhatsApp (verdadeiro quando #app está presente).
   * Nota: o canary também carrega este sinal via "disconnected" — os observers
   * alimentam este campo diretamente quando o ciclo não passa pelo evaluateCanary.
   */
  waConnected: boolean;
  /**
   * Conversa ativa derivada dos observers.
   * null quando nenhuma conversa está aberta.
   */
  activeChat: {
    chatId: string;
    isGroup: boolean;
    /** Nome exibido no header (D-02 + A8 do spike). */
    contactName: string;
  } | null;
  /** Veredito do canário do último ciclo de extração. */
  canary: CanaryVerdict;
  /** Kill-switch remoto (lido da tabela app_settings). */
  killSwitch: boolean;
}

/**
 * Mapeia os sinais do reader para o formato parcial esperado por
 * setReaderInputs() do PanelProvider.
 *
 * Regra Pitfall 2: "disconnected" significa que o app root do WhatsApp está
 * ausente — nunca é "quebrado" (broken seria falso positivo que exibiria o
 * banner D-13 quando o advogado está só na tela de QR/loading).
 */
export function signalsToReaderInputs(signals: ReaderSignals): Partial<ReaderInputs> {
  const { canary, killSwitch, activeChat } = signals;

  // Mapear o veredito do canário para os flags de ReaderInputs
  let waConnected = true;
  let readerBroken = false;

  switch (canary) {
    case "disconnected":
      // Pitfall 2: appRoot ausente = WhatsApp desconectado/carregando, NUNCA quebra
      waConnected = false;
      readerBroken = false;
      break;
    case "broken":
      // Extração falhou ou formato mudou — exibir banner D-13
      readerBroken = true;
      // waConnected permanece true (o #app existe, mas a extração falhou)
      break;
    case "no_chat":
      // Sem conversa aberta — nenhum erro
      waConnected = true;
      readerBroken = false;
      break;
    case "ok":
    case "drift":
    default:
      waConnected = true;
      readerBroken = false;
      break;
  }

  // Mapear activeChat: sinais → formato do ActiveChat do store
  let mappedActiveChat: ActiveChat | null = null;
  if (activeChat !== null && canary !== "disconnected" && canary !== "no_chat") {
    mappedActiveChat = {
      isGroup: activeChat.isGroup,
      lead: {
        // nome exibível do header; phone não disponível via DOM (A8 do spike —
        // o header expõe o nome do contato, não o telefone)
        name: activeChat.contactName || null,
        phone: null,
      },
    };
  } else if (activeChat !== null && canary !== "disconnected") {
    // canary === "no_chat" com activeChat não-null é inconsistente mas mapeamos conservadoramente
    mappedActiveChat = null;
  }

  return {
    waConnected,
    readerBroken,
    killSwitchActive: killSwitch,
    activeChat: activeChat === null ? null : mappedActiveChat,
  };
}
