// Parser de mensagens do WhatsApp Web (EXT-03) — funções PURAS, testáveis com
// fixtures (tests/fixtures/, capturas reais do spike 02-SPIKE.md).
//
// Regras invioláveis:
// - SOMENTE leitura do DOM (querySelector/getAttribute/textContent) — o gate
//   estático read-only-gate.test.ts (EXT-08) falha o CI se escrita aparecer aqui.
// - Todo seletor vem de ./selectors (SEL/ATTR) — nenhum seletor inline.
// - wa_chat_id é string OPACA: NUNCA derivar telefone dela (Pitfall 9).
// - Linha não parseável vira "[não suportado]" — nunca descartada em silêncio
//   (transparência da transcrição). Exceção: mensagem de SISTEMA é ignorada por
//   design (aviso do WhatsApp, não fala do lead nem do advogado).
// - Exceção em extractWithReport vira sinal para o canário, nunca crash.
import type { MessageDTO, MessageKind } from "@copiloto/shared";
import {
  ATTR,
  CONV_MSG_TESTID_PREFIX,
  RECEIPT_LABELS,
  YOU_ARIA_LABEL,
  matchesAny,
  resolveAllWithFallback,
  resolveWithFallback,
} from "./selectors";

export interface ExtractOptions {
  /**
   * Data de referência para mensagens SEM data no DOM (áudio: só hora no
   * msg-meta — 02-SPIKE.md A2). Injetável para manter as funções puras;
   * default: agora (a conversa visível é a atual).
   */
  referenceDate?: Date;
  /** Identidade da conversa já derivada pelo chamador (extractVisibleMessages). */
  waChatId?: string;
}

export interface ParsedDataId {
  /** SEMPRE o data-id completo (chave de dedup EXT-04). */
  waMessageId: string;
  /** Só no formato legado {bool}_{chatId}_{hash}; hash puro atual → null. */
  chatId: string | null;
  /** Só no formato legado; hash puro atual → null (detectar pelo DOM). */
  fromMe: boolean | null;
}

export interface ExtractionReport {
  /** Linhas de mensagem de usuário encontradas (exclui mensagens de sistema). */
  rowCount: number;
  /** Linhas classificadas com sucesso (kind !== "other"). */
  parsedCount: number;
  /** Linhas que viraram "[não suportado]" (kind "other"). */
  unsupportedCount: number;
  /** Mensagens de sistema ignoradas por design. */
  systemCount: number;
  /** true se o ciclo lançou exceção (vira verdict "broken" no canário). */
  hadException: boolean;
}

/** Marcadores pt-BR de mídia/fallback (EXT-03: mídias viram marcadores). */
const MEDIA_MARKERS: Record<Exclude<MessageKind, "text">, string> = {
  audio: "[áudio]",
  image: "[imagem]",
  document: "[documento]",
  other: "[não suportado]",
};

// Formato LEGADO do data-id ({bool}_{chatId}_{hash}) — o spike confirmou DRIFT
// para hash puro (02-SPIKE.md A1), mas a regex tolerante permanece para o caso
// de rollback do WhatsApp e para ids legados persistidos.
const LEGACY_DATA_ID_RE = /^(true|false)_([^_]+@[a-z0-9.-]+)_(.+)$/i;

// "[HH:MM, DD/MM/AAAA] Nome: " — regex tolerante a locale (vírgula opcional,
// dia/mês com 1-2 dígitos, ano com 2 ou 4).
const PRE_PLAIN_RE = /^\[\s*(\d{1,2}:\d{2})\s*,?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*\]\s*(.+?):\s*$/;

const TIME_RE = /(\d{1,2}):(\d{2})/;

/**
 * Converte data ("DD/MM/AAAA") e hora ("HH:MM") pt-BR em ISO 8601.
 * Formato inesperado ou data impossível (sem rollover) → null, nunca lança.
 */
export function parsePtBrTimestamp(date: string, time: string): string | null {
  const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return null;
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const rawYear = dateMatch[3] as string;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const parsed = new Date(year, month - 1, day, hours, minutes);
  if (Number.isNaN(parsed.getTime())) return null;
  // Rejeita rollover do construtor (31/02 → 03/03, 25:99 → dia seguinte).
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null;
  }
  return parsed.toISOString();
}

/**
 * Interpreta o valor de data-pre-plain-text ("[15:56, 11/07/2026] Nome: ").
 * Formato desconhecido → { sender: null, sentAt: null }, nunca lança.
 */
export function parsePrePlainText(raw: string): { sender: string | null; sentAt: string | null } {
  const match = PRE_PLAIN_RE.exec(raw);
  if (!match) return { sender: null, sentAt: null };
  const [, time, date, name] = match as unknown as [string, string, string, string];
  return {
    sender: name.trim() || null,
    sentAt: parsePtBrTimestamp(date, time),
  };
}

/** Parse tolerante do data-id (legado {bool}_{chatId}_{hash} OU hash puro atual). */
export function parseChatIdFromDataId(dataId: string): ParsedDataId {
  const match = LEGACY_DATA_ID_RE.exec(dataId);
  if (match) {
    return {
      waMessageId: dataId,
      chatId: match[2] as string,
      fromMe: (match[1] as string).toLowerCase() === "true",
    };
  }
  return { waMessageId: dataId, chatId: null, fromMe: null };
}

/**
 * Grupo pelo sufixo LEGADO @g.us do chatId (D-02). Para ids atuais (hash puro)
 * a detecção de grupo vem do DOM: isGroupMessageRow / isGroupHeader.
 * @c.us e @lid são opacos e NÃO são grupo (Pitfall 9).
 */
export function isGroupChatId(chatId: string): boolean {
  return /@g\.us$/i.test(chatId);
}

/** Grupo no nível da linha: span[data-testid="author"] só existe em grupo (02-SPIKE.md A6). */
export function isGroupMessageRow(row: Element): boolean {
  return matchesAny(row, "author");
}

/** Grupo no nível do header: chat-subtitle (participantes) ou botão de ligação em grupo. */
export function isGroupHeader(header: Element): boolean {
  return matchesAny(header, "chatSubtitle") || matchesAny(header, "groupVideoCallButton");
}

/** Mensagem de sistema (aviso Meta Business etc.) — ignorada por design. */
export function isSystemMessageRow(row: Element): boolean {
  return matchesAny(row, "systemMessage");
}

/**
 * Classifica a mensagem por heurística de elementos (02-SPIKE.md "Heurísticas
 * de mídia"). Documento é classificado por EXCLUSÃO (tem msg-meta, sem
 * texto/voz/imagem) até a fixture real ser capturada — gap registrado no spike.
 */
export function detectMediaKind(row: Element): MessageKind {
  if (matchesAny(row, "audioHint")) return "audio";
  if (matchesAny(row, "imageHint")) return "image";
  if (hasTextAnchor(row)) return "text";
  if (matchesAny(row, "msgMeta")) return "document";
  return "other";
}

function hasTextAnchor(row: Element): boolean {
  return resolveWithFallback(row, "messageText") !== null;
}

/** Identidade da mensagem: data-id, com fallback no data-testid conv-msg-{id}. */
function readRowId(row: Element): string | null {
  const dataId = row.getAttribute(ATTR.dataId);
  if (dataId) return dataId;
  const testId = row.getAttribute(ATTR.convMsgTestId);
  if (testId?.startsWith(CONV_MSG_TESTID_PREFIX)) {
    return testId.slice(CONV_MSG_TESTID_PREFIX.length);
  }
  return null;
}

/**
 * Direção pela cadeia validada no spike (02-SPIKE.md A1b):
 * 1º tail-out/tail-in → 2º aria-label "Você:" → fallback UNIVERSAL: presença de
 * recibo (Enviada/Entregue/Lida) em msg-meta — recebidas nunca têm recibo.
 */
function detectFromMe(row: Element): boolean {
  if (matchesAny(row, "tailOut")) return true;
  if (matchesAny(row, "tailIn")) return false;
  if (matchesAny(row, "youLabel")) return true;
  return hasReceipt(row);
}

function hasReceipt(row: Element): boolean {
  const { elements } = resolveAllWithFallback(row, "receipt");
  return elements.some((el) => {
    const label = el.getAttribute(ATTR.ariaLabel)?.trim();
    return label !== undefined && RECEIPT_LABELS.has(label);
  });
}

/** Texto com alt de emojis concatenado (emojis viram img[alt] no WhatsApp). */
function textWithEmojiAlt(el: Element): string {
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      out += node.textContent ?? "";
    } else if (node.nodeType === 1 /* ELEMENT_NODE */) {
      const child = node as Element;
      out += child.tagName === "IMG" ? (child.getAttribute("alt") ?? "") : textWithEmojiAlt(child);
    }
  }
  return out;
}

/** Remetente sem o pre-plain-text: author (grupo) → aria-label "Nome:"/"+55...:". */
function detectSenderFromDom(row: Element): string | null {
  const author = resolveWithFallback(row, "author");
  const authorName = author?.element.textContent?.trim();
  if (authorName) return authorName;

  const { elements } = resolveAllWithFallback(row, "senderLabel");
  for (const el of elements) {
    const label = el.getAttribute(ATTR.ariaLabel);
    if (!label || label === YOU_ARIA_LABEL) continue;
    const name = label.replace(/:\s*$/, "").trim();
    if (name) return name;
  }
  return null;
}

/** Hora do msg-meta (único horário disponível em áudio) + data de referência → ISO. */
function sentAtFromMsgMeta(row: Element, referenceDate: Date): string | null {
  const meta = resolveWithFallback(row, "msgMeta");
  const text = meta?.element.textContent ?? "";
  const match = TIME_RE.exec(text);
  if (!match) return null;
  const day = String(referenceDate.getDate()).padStart(2, "0");
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const date = `${day}/${month}/${referenceDate.getFullYear()}`;
  return parsePtBrTimestamp(date, `${match[1]}:${match[2]}`);
}

/**
 * DOM de uma linha de mensagem → MessageDTO (@copiloto/shared).
 * null APENAS quando a linha não é mensagem (sem id) ou é mensagem de sistema;
 * linha de usuário não parseável vira kind "other" + "[não suportado]".
 */
export function extractMessageRow(row: Element, opts: ExtractOptions = {}): MessageDTO | null {
  const rowId = readRowId(row);
  if (!rowId) return null;
  if (isSystemMessageRow(row)) return null;

  const referenceDate = opts.referenceDate ?? new Date();
  const parsedId = parseChatIdFromDataId(rowId);
  const kind = detectMediaKind(row);

  let sender: string | null = null;
  let sentAt: string | null = null;
  const prePlain = resolveWithFallback(row, "prePlainText");
  const prePlainRaw = prePlain?.element.getAttribute(ATTR.prePlainText);
  if (prePlainRaw) {
    const parsed = parsePrePlainText(prePlainRaw);
    sender = parsed.sender;
    sentAt = parsed.sentAt;
  }
  if (!sender) sender = detectSenderFromDom(row);
  if (!sentAt) sentAt = sentAtFromMsgMeta(row, referenceDate);

  let content: string;
  if (kind === "text") {
    const textEl = resolveWithFallback(row, "messageText");
    content = textEl ? textWithEmojiAlt(textEl.element).trim() : "";
  } else {
    content = MEDIA_MARKERS[kind];
  }
  // Âncora de texto presente mas vazia: não descartar em silêncio.
  const finalKind: MessageKind = kind === "text" && !content ? "other" : kind;
  if (finalKind === "other") content = MEDIA_MARKERS.other;

  return {
    waMessageId: parsedId.waMessageId,
    // wa_chat_id OPACO: legado do data-id quando existir; senão o chamador
    // injeta a identidade derivada do header (deriveWaChatId).
    waChatId: parsedId.chatId ?? opts.waChatId ?? "",
    // Prefixo legado quando existir; formato atual (hash puro) → cadeia do DOM.
    fromMe: parsedId.fromMe ?? detectFromMe(row),
    kind: finalKind,
    content,
    sender,
    sentAt,
  };
}

/**
 * Identidade OPACA da conversa derivada do título do header.
 *
 * Contexto (02-SPIKE.md, gap registrado): o drift do data-id removeu o chatId —
 * não há mais fonte primária de wa_chat_id no DOM da conversa. Até uma âncora
 * estável surgir, a identidade é o título normalizado com prefixo "title:".
 * Limitações documentadas: é display name (muda se o contato for renomeado;
 * "Número desconhecido" para não salvos) — aceitas para o dedup v1 (D-02).
 */
export function deriveWaChatId(main: Element): string | null {
  const title = resolveWithFallback(main, "headerTitle");
  const text = title?.element.textContent?.trim().replace(/\s+/g, " ");
  return text ? `title:${text}` : null;
}

/**
 * Extrai todas as mensagens visíveis + relatório para o canário.
 * try/catch no topo: exceção NUNCA derruba o content script — vira
 * hadException=true (verdict "broken" no evaluateCanary).
 */
export function extractWithReport(
  main: Element,
  opts: ExtractOptions = {},
): { messages: MessageDTO[]; report: ExtractionReport } {
  const report: ExtractionReport = {
    rowCount: 0,
    parsedCount: 0,
    unsupportedCount: 0,
    systemCount: 0,
    hadException: false,
  };
  const messages: MessageDTO[] = [];
  try {
    const waChatId = opts.waChatId ?? deriveWaChatId(main) ?? "";
    const { elements: rows } = resolveAllWithFallback(main, "messageRow");
    for (const row of rows) {
      if (isSystemMessageRow(row)) {
        report.systemCount += 1;
        continue;
      }
      const dto = extractMessageRow(row, { ...opts, waChatId });
      if (!dto) continue;
      report.rowCount += 1;
      if (dto.kind === "other") report.unsupportedCount += 1;
      else report.parsedCount += 1;
      messages.push(dto);
    }
  } catch {
    report.hadException = true;
  }
  return { messages, report };
}

/** Mensagens visíveis na ordem do DOM (empates de sent_at ordenam por esta ordem). */
export function extractVisibleMessages(main: Element, opts: ExtractOptions = {}): MessageDTO[] {
  return extractWithReport(main, opts).messages;
}
