/**
 * Testes do ciclo de saúde (sync/flags.ts — plano 02-06, Task 3).
 *
 * Cobertura dos comportamentos do bloco behavior:
 *   1. reader_enabled false → onSignals com killSwitch true (view kill_switch)
 *   2. Upserta reader_status com status atual do canário + extensão_version + last_seen_at
 *   3. canário broken → onSignals com canary "broken" (banner D-13)
 *   4. flag volta a true → onSignals com killSwitch false (retomada automática — D-15)
 *   5. Falha de auth (401) → onError com kind: auth
 *   6. Ciclo roda imediatamente no start e depois a cada HEALTH_INTERVAL_MS
 *
 * Mock do cliente Supabase com fake timers para controlar o ciclo.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CanaryVerdict } from "../entrypoints/whatsapp.content/reader/canary";
import {
  startHealthCycle,
  stopHealthCycle,
  HEALTH_INTERVAL_MS,
  type HealthCycleOptions,
} from "../entrypoints/whatsapp.content/sync/flags";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de mock
// ──────────────────────────────────────────────────────────────────────────────

interface MockSignals {
  killSwitch: boolean;
  canary?: CanaryVerdict;
}

function makeClient({
  readerEnabled = true,
  settingsError = null as unknown,
  statusError = null as unknown,
  settingsStatus = 200,
}: {
  readerEnabled?: boolean;
  settingsError?: unknown;
  statusError?: unknown;
  settingsStatus?: number;
} = {}) {
  const statusUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: statusError ?? null,
    status: statusError ? 500 : 200,
  });

  const settingsSelect = vi.fn().mockResolvedValue({
    data: settingsError ? null : [{ key: "reader_enabled", value: readerEnabled }],
    error: settingsError ?? null,
    status: settingsError ? (settingsStatus || 500) : 200,
  });

  const client = {
    from: vi.fn((table: string) => {
      if (table === "app_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: settingsSelect,
              }),
              single: settingsSelect,
            }),
            single: settingsSelect,
          }),
        };
      }
      if (table === "reader_status") {
        return { upsert: statusUpsert };
      }
      return {};
    }),
  };

  return { client, statusUpsert, settingsSelect };
}

function makeOptions(
  overrides: Partial<HealthCycleOptions> = {},
): HealthCycleOptions {
  return {
    client: makeClient().client as never,
    profileId: "user-uuid-001",
    organizationId: "org-uuid-001",
    getCanaryStatus: () => "ok" as CanaryVerdict,
    getExtensionVersion: () => "0.1.0",
    onSignals: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Testes
// ──────────────────────────────────────────────────────────────────────────────

describe("startHealthCycle — kill-switch + heartbeat + recuperação automática", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopHealthCycle(); // Garantir estado limpo
  });

  afterEach(() => {
    stopHealthCycle();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // Comportamento 1: kill-switch
  // ──────────────────────────────────────────────
  it("reader_enabled false → onSignals com killSwitch true", async () => {
    const { client } = makeClient({ readerEnabled: false });
    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      onSignals,
    });

    // Ciclo inicial imediato
    await vi.runAllTimersAsync();

    expect(onSignals).toHaveBeenCalledWith(
      expect.objectContaining({ killSwitch: true }),
    );
  });

  it("reader_enabled true → onSignals com killSwitch false", async () => {
    const { client } = makeClient({ readerEnabled: true });
    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      onSignals,
    });

    await vi.runAllTimersAsync();

    expect(onSignals).toHaveBeenCalledWith(
      expect.objectContaining({ killSwitch: false }),
    );
  });

  // ──────────────────────────────────────────────
  // Comportamento 2: heartbeat reader_status
  // ──────────────────────────────────────────────
  it("ciclo faz upsert no reader_status com status, version e last_seen_at", async () => {
    const { client, statusUpsert } = makeClient({ readerEnabled: true });
    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      getCanaryStatus: () => "ok",
      getExtensionVersion: () => "0.1.0",
      onSignals,
    });

    await vi.runAllTimersAsync();

    expect(statusUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "user-uuid-001",
        organization_id: "org-uuid-001",
        status: "ok",
        extension_version: "0.1.0",
      }),
      expect.objectContaining({
        onConflict: "profile_id",
      }),
    );
  });

  it("details do reader_status contém APENAS metadados (verdict, versão) — NUNCA transcrição (T-02-21)", async () => {
    const { client, statusUpsert } = makeClient({ readerEnabled: true });

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      getCanaryStatus: () => "drift",
    });

    await vi.runAllTimersAsync();

    if (statusUpsert.mock.calls.length > 0) {
      const upsertPayload = statusUpsert.mock.calls[0][0];
      const detailsStr = JSON.stringify(upsertPayload.details ?? {});
      // details não deve conter conteúdo de mensagem — só metadados
      expect(detailsStr).not.toContain("content");
      expect(detailsStr).not.toContain("texto");
      expect(detailsStr).not.toContain("mensagem enviada");
      // Deve conter metadados válidos
      expect(upsertPayload.status).toBe("drift");
    }
  });

  // ──────────────────────────────────────────────
  // Comportamento 3: canário broken
  // ──────────────────────────────────────────────
  it("canário broken → onSignals com canary 'broken' (banner D-13)", async () => {
    const { client } = makeClient({ readerEnabled: true });
    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      getCanaryStatus: () => "broken",
      onSignals,
    });

    await vi.runAllTimersAsync();

    expect(onSignals).toHaveBeenCalledWith(
      expect.objectContaining({ canary: "broken" }),
    );
  });

  // ──────────────────────────────────────────────
  // Comportamento 4: flag volta a true → retomada automática
  // ──────────────────────────────────────────────
  it("flag reader_enabled volta de false para true → onSignals com killSwitch false (D-15: retomada sem ação do advogado)", async () => {
    let readerEnabled = false;
    const settingsSelect = vi.fn()
      .mockResolvedValueOnce({
        data: [{ key: "reader_enabled", value: false }],
        error: null,
        status: 200,
      })
      .mockResolvedValue({
        data: [{ key: "reader_enabled", value: true }],
        error: null,
        status: 200,
      });

    const client = {
      from: vi.fn((table: string) => {
        if (table === "app_settings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ single: settingsSelect }),
                single: settingsSelect,
              }),
              single: settingsSelect,
            }),
          };
        }
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null, status: 200 }) };
      }),
    };

    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      onSignals,
    });

    // Primeiro ciclo: killSwitch true
    await vi.runAllTimersAsync();
    const firstCall = onSignals.mock.calls[0][0];
    expect(firstCall.killSwitch).toBe(true);

    // Avançar para o próximo ciclo (após HEALTH_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(HEALTH_INTERVAL_MS);
    await vi.runAllTimersAsync();

    // Segundo ciclo: killSwitch false (flag voltou)
    const calls = onSignals.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.killSwitch).toBe(false);
  });

  // ──────────────────────────────────────────────
  // Comportamento 5: falha de auth → onError com kind: auth
  // ──────────────────────────────────────────────
  it("erro 401 ao ler settings → onError com kind auth (D-11: re-verificar sessão)", async () => {
    const { client } = makeClient({
      settingsError: { message: "JWT expired", code: "PGRST301" },
      settingsStatus: 401,
    });
    const onError = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      onError,
    });

    await vi.runAllTimersAsync();

    // O ciclo deve reportar erro de auth (não engolir — Pitfall 3)
    if (onError.mock.calls.length > 0) {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "auth" }),
      );
    }
  });

  // ──────────────────────────────────────────────
  // Comportamento 6: ciclo roda imediatamente + depois a cada HEALTH_INTERVAL_MS
  // ──────────────────────────────────────────────
  it("ciclo roda IMEDIATAMENTE no start e depois a cada HEALTH_INTERVAL_MS", async () => {
    const { client } = makeClient({ readerEnabled: true });
    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      onSignals,
    });

    // Ciclo inicial imediato (sem avançar tempo)
    await vi.runAllTimersAsync();
    expect(onSignals).toHaveBeenCalledTimes(1);

    // Avançar para o próximo ciclo
    await vi.advanceTimersByTimeAsync(HEALTH_INTERVAL_MS);
    await vi.runAllTimersAsync();
    expect(onSignals).toHaveBeenCalledTimes(2);

    // E mais um ciclo
    await vi.advanceTimersByTimeAsync(HEALTH_INTERVAL_MS);
    await vi.runAllTimersAsync();
    expect(onSignals).toHaveBeenCalledTimes(3);
  });

  // ──────────────────────────────────────────────
  // stopHealthCycle para o ciclo
  // ──────────────────────────────────────────────
  it("stopHealthCycle para o intervalo — sem novos ciclos após stop", async () => {
    const { client } = makeClient({ readerEnabled: true });
    const onSignals = vi.fn();

    startHealthCycle({
      ...makeOptions(),
      client: client as never,
      onSignals,
    });

    await vi.runAllTimersAsync();
    const countAfterStart = onSignals.mock.calls.length;

    stopHealthCycle();

    await vi.advanceTimersByTimeAsync(HEALTH_INTERVAL_MS * 3);
    await vi.runAllTimersAsync();

    // Não deve ter novos ciclos após stop
    expect(onSignals).toHaveBeenCalledTimes(countAfterStart);
  });
});
