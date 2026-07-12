/**
 * Coletor de diagnóstico do SPIKE — DEV ONLY (nunca entra no build de produção;
 * ver guard `import.meta.env.DEV` em index.tsx — T-02-03).
 *
 * Valida as âncoras de extração assumidas no 02-RESEARCH.md (A1-A5, A8) contra
 * o WhatsApp Web real e permite capturar o HTML de linhas de mensagem para as
 * fixtures de tests/fixtures/.
 *
 * RESTRIÇÃO ABSOLUTA (EXT-08 / D-03 / T-02-01): este módulo usa EXCLUSIVAMENTE
 * APIs de LEITURA do DOM — querySelector*, getAttribute, textContent, outerHTML.
 * Nenhuma escrita, clique, foco, scroll ou evento sintético. Tudo é logado
 * apenas localmente no console; nada é enviado a servidor algum (exceto o teste
 * de CORS A5, que faz um GET sem dados de conversa ao endpoint REST do Supabase).
 */

interface SpikeReport {
  /** A3 — o painel da conversa existe? */
  mainPresent: boolean;
  /** A1 — quantas linhas de mensagem com [data-id] estão no DOM */
  dataIdCount: number;
  /**
   * A1 — até 5 valores de data-id com o hash final truncado.
   * Formato esperado: `{true|false}_{chatId}_{hash}` (true = enviada por mim).
   */
  dataIdSamples: string[];
  /** A2 — até 3 valores de data-pre-plain-text (formato esperado: `[HH:MM, DD/MM/AAAA] Nome:`) */
  prePlainTextSamples: string[];
  /** A4 — amostras de texto extraídas via span.selectable-text dentro de .copyable-text */
  selectableTextSamples: string[];
  /** A8 — candidatos a título/nome do contato no header do #main */
  headerTitleCandidates: string[];
}

/** Trunca o hash final de um data-id (`{bool}_{chatId}_{hash}` → hash com 6 chars + "…"). */
function truncateDataId(dataId: string): string {
  const parts = dataId.split("_");
  if (parts.length < 3) return dataId;
  const hash = parts.slice(2).join("_");
  return `${parts[0]}_${parts[1]}_${hash.slice(0, 6)}…`;
}

function collect(): SpikeReport {
  const main = document.querySelector("#main");
  const rows = Array.from(document.querySelectorAll("[data-id]"));

  const dataIdSamples = rows
    .slice(0, 5)
    .map((el) => el.getAttribute("data-id") ?? "")
    .filter(Boolean)
    .map(truncateDataId);

  const prePlainTextSamples = Array.from(
    document.querySelectorAll("[data-pre-plain-text]"),
  )
    .slice(0, 3)
    .map((el) => el.getAttribute("data-pre-plain-text") ?? "")
    .filter(Boolean);

  const selectableTextSamples = Array.from(
    document.querySelectorAll(".copyable-text span.selectable-text"),
  )
    .slice(0, 3)
    .map((el) => (el.textContent ?? "").slice(0, 60));

  // A8 — no header do #main, candidatos: elementos com atributo title ou role=heading
  const headerTitleCandidates: string[] = [];
  const header = main?.querySelector("header");
  if (header) {
    for (const el of Array.from(
      header.querySelectorAll('[title], [role="heading"]'),
    )) {
      const title = el.getAttribute("title");
      const text = (el.textContent ?? "").trim();
      const candidate = title || text;
      if (candidate && !headerTitleCandidates.includes(candidate)) {
        headerTitleCandidates.push(candidate.slice(0, 60));
      }
      if (headerTitleCandidates.length >= 5) break;
    }
  }

  return {
    mainPresent: Boolean(main),
    dataIdCount: rows.length,
    dataIdSamples,
    prePlainTextSamples,
    selectableTextSamples,
    headerTitleCandidates,
  };
}

/**
 * Retorna o outerHTML da n-ésima linha de mensagem ([data-id]) para o humano
 * salvar como fixture (uso: `copy(__copilotoSpike.captureRow(0))`).
 * Somente leitura — outerHTML é um getter.
 */
function captureRow(n: number): string {
  const rows = document.querySelectorAll("[data-id]");
  const row = rows[n];
  if (!row) return `<!-- nenhuma linha [data-id] no índice ${n} (total: ${rows.length}) -->`;
  return row.outerHTML;
}

/** Captura o outerHTML do header do #main (fixture header.html — A8). */
function captureHeader(): string {
  const header = document.querySelector("#main header");
  if (!header) return "<!-- #main header não encontrado -->";
  return header.outerHTML;
}

/**
 * A5 — prova de CORS: fetch autenticável ao Supabase de DENTRO do content script.
 * Qualquer resposta HTTP (200/401) prova que o CORS funciona; erro de rede/CORS
 * prova que precisamos do fallback via background.
 * Aceita url/key manuais caso o .env.local não esteja configurado no build.
 */
async function testSupabaseCors(
  url?: string,
  key?: string,
): Promise<{ status: number; ok: boolean } | { error: string }> {
  const supabaseUrl = url ?? (import.meta.env.WXT_SUPABASE_URL as string | undefined);
  const anonKey = key ?? (import.meta.env.WXT_SUPABASE_ANON_KEY as string | undefined);
  if (!supabaseUrl || !anonKey) {
    return {
      error:
        "WXT_SUPABASE_URL/WXT_SUPABASE_ANON_KEY ausentes no build. Chame __copilotoSpike.testSupabaseCors(url, anonKey) passando os valores manualmente.",
    };
  }
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: anonKey },
    });
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { error: `fetch falhou (provável bloqueio CORS/rede): ${String(err)}` };
  }
}

type SpikeApi = (() => SpikeReport) & {
  captureRow: typeof captureRow;
  captureHeader: typeof captureHeader;
  testSupabaseCors: typeof testSupabaseCors;
};

declare global {
  interface Window {
    __copilotoSpike?: SpikeApi;
  }
}

/** Registra window.__copilotoSpike() no mundo isolado do content script. */
export function registerSpikeCollector(): void {
  const api = collect as SpikeApi;
  api.captureRow = captureRow;
  api.captureHeader = captureHeader;
  api.testSupabaseCors = testSupabaseCors;
  window.__copilotoSpike = api;
  console.info(
    "[Copiloto Jurídico] Spike collector ativo (dev). Use __copilotoSpike(), __copilotoSpike.captureRow(n), __copilotoSpike.captureHeader() e await __copilotoSpike.testSupabaseCors() no contexto do content script.",
  );
}
