// Canário de quebra do reader (base do EXT-05 / D-13) — função PURA sobre um
// snapshot de sinais coletado pelo ciclo de leitura (02-06 monta o snapshot;
// extractWithReport fornece contagens; selectors.ts fornece isFallbackInUse()).
//
// Tabela de interpretação (Pattern 6 do 02-RESEARCH.md, validada no spike):
// - appRoot ausente (QR/loading/logout)            → disconnected  (NUNCA broken — Pitfall 2)
// - main ausente com appRoot presente              → no_chat       (nada aberto ≠ erro)
// - exceção no ciclo de extração                   → broken        (fail-safe)
// - conversa aberta + 0 linhas por N ciclos        → broken        (estrutura mudou)
// - >30% das linhas sem parse                      → broken        (formato mudou)
// - fallback secundário de seletor em uso          → drift         (reportar, seguir operando)
// - caso contrário                                 → ok
//
// A distinção disconnected vs broken é a mais importante: falso positivo do
// banner D-13 gera alarme indevido no admin e mina a confiança no aviso.

export type CanaryVerdict = "ok" | "drift" | "broken" | "disconnected" | "no_chat";

export interface CanarySnapshot {
  /** Raiz do app (#app) presente? Ausente = tela de QR/loading/logout. */
  appRootPresent: boolean;
  /** Painel da conversa (#main) presente? Ausente = nenhuma conversa aberta. */
  mainPresent: boolean;
  /** Linhas de mensagem de usuário no ciclo (ExtractionReport.rowCount). */
  rowCount: number;
  /** Linhas classificadas com sucesso (ExtractionReport.parsedCount). */
  parsedCount: number;
  /** Algum fallback secundário de seletor resolveu? (selectors.isFallbackInUse) */
  fallbackInUse: boolean;
  /** O ciclo de extração lançou exceção? (ExtractionReport.hadException) */
  hadException: boolean;
  /** Ciclos consecutivos com conversa aberta (main presente) e 0 linhas. */
  emptyCyclesWithChatOpen: number;
}

/** Ciclos consecutivos vazios com conversa aberta antes de declarar quebra. */
export const BROKEN_EMPTY_CYCLES = 3;

/** Taxa de falha de parse ACIMA da qual o formato é considerado quebrado. */
export const BROKEN_PARSE_FAILURE_RATIO = 0.3;

/** Avalia o snapshot e devolve o veredito do canário (função pura). */
export function evaluateCanary(snapshot: CanarySnapshot): CanaryVerdict {
  // Precedência 1: sem raiz do app não há o que diagnosticar — WhatsApp
  // desconectado/carregando vence QUALQUER sinal de quebra (Pitfall 2).
  if (!snapshot.appRootPresent) return "disconnected";

  // Precedência 2: sem conversa aberta não há linhas — não é erro.
  if (!snapshot.mainPresent) return "no_chat";

  // Fail-safe: exceção no ciclo é quebra imediata.
  if (snapshot.hadException) return "broken";

  // Conversa aberta, zero linhas por N ciclos: estrutura mudou.
  if (snapshot.rowCount === 0 && snapshot.emptyCyclesWithChatOpen >= BROKEN_EMPTY_CYCLES) {
    return "broken";
  }

  // Linhas existem mas o formato não parseia acima do limiar: quebrado.
  if (snapshot.rowCount > 0) {
    const failureRatio = (snapshot.rowCount - snapshot.parsedCount) / snapshot.rowCount;
    if (failureRatio > BROKEN_PARSE_FAILURE_RATIO) return "broken";
  }

  // Operando por fallback: drift — reportar ao reader_status, seguir lendo.
  if (snapshot.fallbackInUse) return "drift";

  return "ok";
}
