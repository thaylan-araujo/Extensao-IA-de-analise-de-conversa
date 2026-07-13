/**
 * Dois observers estreitos com debounce (Pattern 3 do 02-RESEARCH.md / EXT-02, EXT-07).
 *
 * Regras invioláveis (EXT-08 — gate somente-leitura):
 * - SOMENTE leitura do DOM (querySelector/getAttribute/textContent).
 * - Nenhum setInterval de polling de DOM (EXT-07); o único timer permitido é o
 *   debounce de 500ms da extração + requestIdleCallback.
 * - Observers desconectados em logout/kill-switch/quebra ou sem conversa.
 * - Recolher o painel NÃO pausa os observers (D-04).
 * - A extensão NUNCA rola sozinha para minerar histórico (D-03).
 *
 * Pitfall 2: ausência do #app = WhatsApp desconectado/carregando, NUNCA "broken".
 * Pitfall 5: extração NUNCA roda no callback síncrono da mutação — sempre via
 *            debounce 500ms + requestIdleCallback({ timeout: 2000 }).
 */
import type { MessageDTO } from "@copiloto/shared";
import {
  extractWithReport,
  deriveWaChatId,
  isGroupHeader,
} from "./extract";
import { evaluateCanary, type CanarySnapshot } from "./canary";
import { isFallbackInUse, resetDriftSignals, resolveWithFallback, SEL } from "./selectors";
import type { ReaderSignals } from "./state";

/** Callback chamada a cada ciclo de extração (mensagens + estado do canário). */
export type ExtractionCallback = (params: {
  messages: MessageDTO[];
  signals: Pick<ReaderSignals, "activeChat" | "canary" | "waConnected">;
}) => void;

/** Callback de erro não-fatal — nunca engolir (Pitfall 3). */
export type ObserverErrorCallback = (err: unknown) => void;

/** Opções de injeção para testabilidade (isolam os observers do DOM real). */
export interface ObserverOptions {
  /** Raiz da busca de seletores (padrão: document). */
  root?: ParentNode;
  /** Callback chamado com cada ciclo de extração + sinal do canário. */
  onExtraction: ExtractionCallback;
  /** Callback de erro (nunca opcional — Pitfall 3). */
  onError: ObserverErrorCallback;
  /** Débito de debounce em ms (padrão: 500). Injetável para testes com fake timers. */
  debounceMs?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Estado do módulo (singleton por tab — content script vive numa única aba)
// ──────────────────────────────────────────────────────────────────────────────
let conversationObserver: MutationObserver | null = null;
let messageObserver: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let emptyCyclesWithChatOpen = 0;

// Contexto da conversa atual (re-derivado a cada troca de chat)
let currentChatId: string | null = null;
let currentIsGroup = false;
let currentContactName: string | null = null;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Detecta se a conversa ativa é um grupo a partir do header.
 * Substitui a heurística @g.us pós-drift do data-id (A6 do spike).
 */
function resolveIsGroup(main: Element): boolean {
  const header = resolveWithFallback(main, "header");
  if (!header) return false;
  return isGroupHeader(header.element);
}

/** Extrai o nome do contato do header da conversa. */
function resolveContactName(main: Element): string | null {
  const titleEl = resolveWithFallback(main, "headerTitle");
  return titleEl?.element.textContent?.trim().replace(/\s+/g, " ") ?? null;
}

/** Agenda a extração fora do caminho crítico da mutação (Pitfall 5). */
function scheduleExtraction(
  main: Element,
  onExtraction: ExtractionCallback,
  onError: ObserverErrorCallback,
): void {
  requestIdleCallback(
    () => {
      try {
        resetDriftSignals();
        const appRoot = resolveWithFallback(document as unknown as ParentNode, "appRoot");
        const appRootPresent = appRoot !== null;

        const { messages, report } = extractWithReport(main);

        if (report.rowCount === 0 && messages.length === 0) {
          emptyCyclesWithChatOpen += 1;
        } else {
          emptyCyclesWithChatOpen = 0;
        }

        const snapshot: CanarySnapshot = {
          appRootPresent,
          mainPresent: true,
          rowCount: report.rowCount,
          parsedCount: report.parsedCount,
          fallbackInUse: isFallbackInUse(),
          hadException: report.hadException,
          emptyCyclesWithChatOpen,
        };

        const canary = evaluateCanary(snapshot);
        const chatId = deriveWaChatId(main) ?? currentChatId ?? "";

        onExtraction({
          messages,
          signals: {
            activeChat: currentChatId
              ? {
                  chatId,
                  isGroup: currentIsGroup,
                  contactName: currentContactName ?? chatId,
                }
              : null,
            canary,
            waConnected: true,
          },
        });
      } catch (err) {
        onError(err);
      }
    },
    { timeout: 2000 },
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Observer de mensagens — recriado a cada troca de conversa
// ──────────────────────────────────────────────────────────────────────────────

function startMessageObserver(
  main: Element,
  onExtraction: ExtractionCallback,
  onError: ObserverErrorCallback,
  debounceMs: number,
): void {
  // Parar o observer anterior (troca de conversa)
  if (messageObserver) {
    messageObserver.disconnect();
    messageObserver = null;
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Reset do contador de ciclos vazios para a nova conversa
  emptyCyclesWithChatOpen = 0;

  // Extração inicial ao abrir a conversa (mensagens já visíveis no DOM)
  scheduleExtraction(main, onExtraction, onError);

  // Observer narrow: apenas a lista de mensagens dentro do #main
  messageObserver = new MutationObserver(() => {
    // NUNCA extrair aqui — só debounce (Pitfall 5)
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      scheduleExtraction(main, onExtraction, onError);
    }, debounceMs);
  });

  // Observer estreito: childList + subtree DENTRO do #main (não do document.body)
  messageObserver.observe(main, { childList: true, subtree: true });
}

// ──────────────────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Inicia o observer de troca de conversa.
 *
 * Observa o container pai do #main com childList raso (sem subtree profundo).
 * Ao detectar mudança, re-deriva a conversa ativa e reinicia o observer de
 * mensagens.
 *
 * Pitfall 2: verifica SEL.appRoot ANTES de qualquer diagnóstico — ausência do
 * #app significa WhatsApp desconectado/carregando, nunca "quebrado".
 */
export function startConversationObserver(options: ObserverOptions): void {
  const { root = document as unknown as ParentNode, onExtraction, onError, debounceMs = 500 } = options;

  // Parar observer anterior se houver
  stopAllObservers();

  // Verificar se o #app está presente (Pitfall 2)
  const appRoot = resolveWithFallback(root, "appRoot");
  if (!appRoot) {
    // WhatsApp desconectado/carregando — reportar estado sem lançar
    onExtraction({
      messages: [],
      signals: {
        activeChat: null,
        canary: "disconnected",
        waConnected: false,
      },
    });
    return;
  }

  // Observer de conversa: alvo estreito (appRoot), childList raso
  // Detecta quando o #main é adicionado/removido/substituído
  conversationObserver = new MutationObserver(() => {
    try {
      const main = resolveWithFallback(root, "main");

      if (!main) {
        // Conversa fechada ou trocando
        currentChatId = null;
        currentIsGroup = false;
        currentContactName = null;
        if (messageObserver) {
          messageObserver.disconnect();
          messageObserver = null;
        }
        onExtraction({
          messages: [],
          signals: {
            activeChat: null,
            canary: "no_chat",
            waConnected: true,
          },
        });
        return;
      }

      // Re-derivar a identidade da conversa a partir do header
      const isGroup = resolveIsGroup(main.element);
      const contactName = resolveContactName(main.element);
      const chatId = deriveWaChatId(main.element) ?? `chat:${Date.now()}`;

      const chatChanged = chatId !== currentChatId || isGroup !== currentIsGroup;
      currentChatId = chatId;
      currentIsGroup = isGroup;
      currentContactName = contactName;

      if (chatChanged) {
        // Iniciar (ou reiniciar) o observer de mensagens para a nova conversa
        startMessageObserver(main.element, onExtraction, onError, debounceMs);
      }
    } catch (err) {
      onError(err);
    }
  });

  // Observar o container do app (appRoot) com childList raso
  // O #main é filho direto do #app — sem subtree profundo (anti-padrão EXT-07)
  conversationObserver.observe(appRoot.element, { childList: true, subtree: false });

  // Verificar imediatamente se já há uma conversa aberta
  const main = resolveWithFallback(root, "main");
  if (main) {
    const isGroup = resolveIsGroup(main.element);
    const contactName = resolveContactName(main.element);
    const chatId = deriveWaChatId(main.element) ?? `chat:${Date.now()}`;
    currentChatId = chatId;
    currentIsGroup = isGroup;
    currentContactName = contactName;
    startMessageObserver(main.element, onExtraction, onError, debounceMs);
  } else {
    // Sem conversa aberta no momento
    onExtraction({
      messages: [],
      signals: {
        activeChat: null,
        canary: "no_chat",
        waConnected: true,
      },
    });
  }
}

/**
 * Para todos os observers e cancela qualquer debounce pendente.
 * Chamado em: logout, remoção, kill-switch, quebra (mas NÃO ao recolher — D-04).
 */
export function stopAllObservers(): void {
  if (conversationObserver) {
    conversationObserver.disconnect();
    conversationObserver = null;
  }
  if (messageObserver) {
    messageObserver.disconnect();
    messageObserver = null;
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  currentChatId = null;
  currentIsGroup = false;
  currentContactName = null;
  emptyCyclesWithChatOpen = 0;
}
