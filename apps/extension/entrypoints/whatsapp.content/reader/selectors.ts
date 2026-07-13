// ÚNICA fonte de seletores do reader (Pattern 4 do 02-RESEARCH.md).
// Nenhum seletor inline em extract/canary/observers — tudo vem de SEL/ATTR.
//
// Fonte de verdade das âncoras: 02-SPIKE.md (validadas contra o WhatsApp Business
// Web real em 2026-07-12). Cada alvo tem uma cadeia ordenada por ESTABILIDADE:
//   1º atributo semântico (data-testid / data-*) → 2º role/aria → 3º classe estável
// PROIBIDO: classes ofuscadas geradas (x1lliihq...), seletores posicionais
// (nth-child), XPath.
//
// Quando um fallback secundário resolve, o módulo registra o sinal de drift —
// consumido pelo canário (evaluateCanary) e, no 02-06, reportado ao reader_status.

export type SelectorChain = readonly string[];

/** Nomes de atributos-âncora lidos diretamente (getAttribute). */
export const ATTR = {
  /** Identidade da mensagem — HASH PURO pós-drift (02-SPIKE.md A1). */
  dataId: "data-id",
  /** Redundância nova observada no spike: data-testid="conv-msg-{id}". */
  convMsgTestId: "data-testid",
  /** "[HH:MM, DD/MM/AAAA] Nome: " — ausente em áudio (02-SPIKE.md A2). */
  prePlainText: "data-pre-plain-text",
  ariaLabel: "aria-label",
} as const;

/** Prefixo do data-testid redundante da linha de mensagem. */
export const CONV_MSG_TESTID_PREFIX = "conv-msg-";

/**
 * Valores de aria-label do recibo de entrega em msg-meta (só mensagens ENVIADAS
 * têm recibo — fallback universal de from-me, 02-SPIKE.md A1b). Comparar com trim.
 */
export const RECEIPT_LABELS: ReadonlySet<string> = new Set(["Enviada", "Entregue", "Lida"]);

/** aria-label que marca mensagem enviada pelo dono da conta. */
export const YOU_ARIA_LABEL = "Você:";

export const SEL = {
  /** Raiz do app — ausente na tela de QR/loading (ausência = desconectado, NUNCA quebra). */
  appRoot: ["#app"],
  /** Painel da conversa — só existe com conversa aberta (ausência = sem_conversa). */
  main: ["#main"],
  /** Linha de mensagem. Primário: [data-id]; redundância: data-testid conv-msg-*. */
  messageRow: ["[data-id]", `[data-testid^="${CONV_MSG_TESTID_PREFIX}"]`],
  /** Mensagem de sistema (aviso Meta Business etc.) — o parser IGNORA. */
  systemMessage: ['[data-testid="msg-notification-container"]', 'span[data-testid="system_message"]'],
  /** Container do texto com data-pre-plain-text. */
  prePlainText: ["[data-pre-plain-text]"],
  /** Texto da mensagem (multi-linha via textContent do span externo — 02-SPIKE.md A4). */
  messageText: ['span[data-testid="selectable-text"]', "span.selectable-text.copyable-text"],
  /** Hora/status — presente em TODO tipo de mensagem (âncora universal do spike). */
  msgMeta: ['[data-testid="msg-meta"]'],
  /** Spans com aria-label dentro do msg-meta (recibo de entrega). */
  receipt: ['[data-testid="msg-meta"] [aria-label]'],
  /** Balão enviado / recebido (1º critério de from-me). */
  tailOut: ['span[data-testid="tail-out"]', '[data-icon="tail-out"]'],
  tailIn: ['span[data-testid="tail-in"]', '[data-icon="tail-in"]'],
  /** 2º critério de from-me: aria-label "Você:" (enviada). */
  youLabel: [`span[aria-label="${YOU_ARIA_LABEL}"]`],
  /** Remetente via aria-label terminado em ":" (recebidas: telefone/nome). */
  senderLabel: ['span[aria-label$=":"]'],
  /** Nome do remetente no balão — EXCLUSIVO de grupo (02-SPIKE.md A6). */
  author: ['span[data-testid="author"]'],
  /** Header de encaminhada — pode suprimir tail e "Você:". */
  forwardedHeader: ['div[data-testid="forwarded-header"]', '[data-icon="forward-refreshed"]'],
  /** Selo IA do WhatsApp Business (mensagem gerada por IA). */
  aiLabel: ['span[data-testid="ai-label"]'],
  /** Voz: ptt-status (gravada) / ptt-file (encaminhada) / aria-labels pt-BR. */
  audioHint: [
    '[data-testid="ptt-status"]',
    '[data-testid="ptt-file"]',
    'span[aria-label="Mensagem de voz"]',
    'button[aria-label="Reproduzir mensagem de voz"]',
  ],
  /** Imagem: thumb + provider; legenda tem testid próprio. */
  imageHint: [
    'div[data-testid="image-thumb"]',
    '[data-testid="media-url-provider"]',
    'span[data-testid="image-caption selectable-text"]',
  ],
  /** Header da conversa (02-SPIKE.md A8). */
  header: ['header[data-testid="conversation-header"]', "#main header"],
  headerTitle: ['span[data-testid="conversation-info-header-chat-title"]'],
  /** Sinais de grupo no header (substituem @g.us pós-drift — D-02). */
  chatSubtitle: ['div[data-testid="chat-subtitle"]'],
  groupVideoCallButton: ['[aria-label="Ligação de vídeo em grupo"]'],
} as const satisfies Record<string, SelectorChain>;

export type SelTarget = keyof typeof SEL;

export interface ResolvedElement {
  element: Element;
  /** Índice na cadeia (0 = seletor primário; >0 = fallback em uso → drift). */
  index: number;
  selector: string;
}

export interface DriftSignal {
  target: SelTarget;
  /** Índice do fallback que resolveu. */
  index: number;
  selector: string;
}

// Registro em memória de fallbacks usados (sinal de drift antes da quebra total).
const driftSignals = new Map<SelTarget, DriftSignal>();

function recordDrift(target: SelTarget, index: number, selector: string): void {
  if (!driftSignals.has(target)) driftSignals.set(target, { target, index, selector });
}

/** Há algum fallback secundário em uso desde o último reset? (insumo do canário) */
export function isFallbackInUse(): boolean {
  return driftSignals.size > 0;
}

/** Lê os sinais de drift acumulados (para reporte ao reader_status no 02-06). */
export function getDriftSignals(): DriftSignal[] {
  return [...driftSignals.values()];
}

/** Zera o registro de drift (início de um novo ciclo de leitura). */
export function resetDriftSignals(): void {
  driftSignals.clear();
}

/**
 * Resolve o primeiro elemento da cadeia do alvo, na ordem de estabilidade.
 * Se um fallback (índice > 0) resolver, registra o sinal de drift.
 */
export function resolveWithFallback(root: ParentNode, target: SelTarget): ResolvedElement | null {
  const chain = SEL[target];
  for (let i = 0; i < chain.length; i++) {
    const selector = chain[i] as string;
    const element = root.querySelector(selector);
    if (element) {
      if (i > 0) recordDrift(target, i, selector);
      return { element, index: i, selector };
    }
  }
  return null;
}

/**
 * Resolve TODOS os elementos do primeiro seletor da cadeia que devolver algo.
 * Fallback (índice > 0) também registra drift.
 */
export function resolveAllWithFallback(
  root: ParentNode,
  target: SelTarget,
): { elements: Element[]; index: number } {
  const chain = SEL[target];
  for (let i = 0; i < chain.length; i++) {
    const selector = chain[i] as string;
    const elements = [...root.querySelectorAll(selector)];
    if (elements.length > 0) {
      if (i > 0) recordDrift(target, i, selector);
      return { elements, index: i };
    }
  }
  return { elements: [], index: -1 };
}

/**
 * Presença de QUALQUER âncora da cadeia (alvos "anyOf": heurísticas de mídia,
 * tails, sinais de grupo). NÃO registra drift — as âncoras são alternativas
 * legítimas entre variantes de mensagem, não degradação de seletor.
 */
export function matchesAny(root: ParentNode, target: SelTarget): boolean {
  return SEL[target].some((selector) => root.querySelector(selector) !== null);
}
