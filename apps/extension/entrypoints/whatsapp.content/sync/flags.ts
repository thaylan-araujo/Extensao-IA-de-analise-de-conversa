/**
 * Ciclo de saúde: kill-switch + heartbeat reader_status + recuperação automática
 * (plano 02-06, Task 3 — EXT-05, D-13, D-14, D-15).
 *
 * Regras invioláveis:
 * - Este setInterval é de REDE (polling de tabela Postgres), não de DOM —
 *   EXT-07 proíbe polling de DOM, não polling de rede.
 * - details do reader_status leva SOMENTE metadados (verdict, versão, drift signals)
 *   — NUNCA transcrição (LGPD T-02-21).
 * - Erros NUNCA são engolidos (Pitfall 3): onError é sempre chamado.
 * - O ciclo roda IMEDIATAMENTE no start (sem esperar o primeiro intervalo).
 *
 * Fluxo por ciclo (~5 min):
 *   1. Ler app_settings.reader_enabled → sinal killSwitch
 *   2. Upsert reader_status com status atual do canário + versão + last_seen_at
 *   3. Chamar onSignals com { killSwitch, canary }
 */
import type { ExtensionSupabaseClient } from "./supabase";
import type { CanaryVerdict } from "../reader/canary";

/** Intervalo padrão do ciclo de saúde: 5 minutos. */
export const HEALTH_INTERVAL_MS = 5 * 60 * 1000;

/** Tipos de erro do ciclo de saúde. */
export type HealthError =
  | { kind: "auth"; message: string }
  | { kind: "network"; error: unknown }
  | { kind: "unknown"; error: unknown };

/** Sinais emitidos por ciclo de saúde. */
export interface HealthSignals {
  killSwitch: boolean;
  canary: CanaryVerdict;
}

export interface HealthCycleOptions {
  client: ExtensionSupabaseClient;
  /** ID do advogado logado. */
  profileId: string;
  /** ID da organização do advogado. */
  organizationId: string;
  /** Retorna o veredito atual do canário (fornecido pelos observers). */
  getCanaryStatus: () => CanaryVerdict;
  /** Retorna a versão da extensão (browser.runtime.getManifest().version). */
  getExtensionVersion: () => string;
  /** Callback com os sinais do ciclo. */
  onSignals: (signals: HealthSignals) => void;
  /** Callback de erro (nunca opcional — Pitfall 3). */
  onError: (err: HealthError) => void;
}

let healthIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Executa um único ciclo de saúde.
 * Não lança — todos os erros são entregues ao onError.
 */
async function runCycle(options: HealthCycleOptions): Promise<void> {
  const { client, profileId, organizationId, getCanaryStatus, getExtensionVersion, onSignals, onError } = options;

  try {
    // ── Passo 1: ler o kill-switch remoto ─────────────────────────────────
    // Usa .single() porque reader_enabled é PRIMARY KEY em app_settings —
    // sempre existe exatamente uma linha (inserted na migration).
    const { data: settingsData, error: settingsError, status: settingsStatus } =
      await (client
        .from("app_settings")
        .select("key, value")
        .eq("key", "reader_enabled")
        .single() as unknown as Promise<{ data: { key: string; value: unknown } | null; error: { message: string; code?: string } | null; status: number }>);

    if (settingsError) {
      if (settingsStatus === 401 || settingsStatus === 403) {
        onError({ kind: "auth", message: settingsError.message });
        return;
      }
      onError({ kind: "network", error: new Error(settingsError.message) });
      return;
    }

    // reader_enabled: flag pode ser boolean json ou string "true"/"false"
    // .single() retorna o objeto diretamente (não array)
    const readerEnabledRaw = (settingsData as { key: string; value: unknown } | null)?.value;
    const killSwitch = readerEnabledRaw === false || readerEnabledRaw === "false";

    // ── Passo 2: heartbeat no reader_status ───────────────────────────────
    const canary = getCanaryStatus();
    const version = getExtensionVersion();

    // details: SOMENTE metadados — NUNCA conteúdo de mensagem (LGPD T-02-21)
    const details: Record<string, unknown> = {
      verdict: canary,
      extension_version: version,
      kill_switch: killSwitch,
      cycle_at: new Date().toISOString(),
    };

    const { error: statusError, status: statusStatus } = await (client
      .from("reader_status")
      .upsert(
        {
          profile_id: profileId,
          organization_id: organizationId,
          status: canary === "ok" || canary === "drift" || canary === "broken" ? canary : "ok",
          extension_version: version,
          details,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      ) as unknown as Promise<{ error: { message: string } | null; status: number }>);

    if (statusError) {
      // Falha no heartbeat não é fatal — continuar e reportar o kill-switch
      if (statusStatus === 401 || statusStatus === 403) {
        onError({ kind: "auth", message: statusError.message });
        return;
      }
      onError({ kind: "network", error: new Error(statusError.message) });
      // Não retornar — ainda entregar os sinais ao chamador
    }

    // ── Passo 3: emitir sinais ────────────────────────────────────────────
    onSignals({ killSwitch, canary });
  } catch (err) {
    onError({ kind: "unknown", error: err });
  }
}

/**
 * Inicia o ciclo de saúde.
 *
 * Roda IMEDIATAMENTE no start e depois a cada HEALTH_INTERVAL_MS.
 * Chamado pelo index.tsx após restaurar a sessão.
 *
 * Este setInterval é de REDE — não poleia o DOM (EXT-07 regra específica
 * de DOM; polling de rede a 5 min é negligenciável).
 */
export function startHealthCycle(options: HealthCycleOptions): void {
  stopHealthCycle(); // garantir apenas um ciclo rodando

  // Execução imediata (sem esperar o primeiro intervalo)
  void runCycle(options);

  // Ciclos subsequentes a cada HEALTH_INTERVAL_MS
  healthIntervalId = setInterval(() => {
    void runCycle(options);
  }, HEALTH_INTERVAL_MS);
}

/**
 * Para o ciclo de saúde (logout, kill-switch, quebra permanente).
 */
export function stopHealthCycle(): void {
  if (healthIntervalId !== null) {
    clearInterval(healthIntervalId);
    healthIntervalId = null;
  }
}
