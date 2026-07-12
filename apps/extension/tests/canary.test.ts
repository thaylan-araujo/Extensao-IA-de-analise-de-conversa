// Testes do canário de quebra (base do EXT-05 / D-13) — tabela do Pattern 6 do
// 02-RESEARCH.md como entradas explícitas de evaluateCanary.
//
// A distinção mais importante: DISCONNECTED (tela de QR/loading — appRoot ausente)
// NUNCA pode virar BROKEN (Pitfall 2: falso positivo do banner D-13 gera alarme
// indevido no admin e mina a confiança no aviso).
import { describe, expect, it } from "vitest";
import {
  BROKEN_EMPTY_CYCLES,
  BROKEN_PARSE_FAILURE_RATIO,
  evaluateCanary,
  type CanarySnapshot,
  type CanaryVerdict,
} from "../entrypoints/whatsapp.content/reader/canary";

/** Snapshot saudável de referência — cada caso muta só o sinal em teste. */
function healthy(overrides: Partial<CanarySnapshot> = {}): CanarySnapshot {
  return {
    appRootPresent: true,
    mainPresent: true,
    rowCount: 20,
    parsedCount: 20,
    fallbackInUse: false,
    hadException: false,
    emptyCyclesWithChatOpen: 0,
    ...overrides,
  };
}

describe("evaluateCanary — tabela do Pattern 6", () => {
  it("tudo saudável → ok", () => {
    expect(evaluateCanary(healthy())).toBe<CanaryVerdict>("ok");
  });

  it("appRoot + main presentes + 0 linhas com conversa aberta por N ciclos → broken", () => {
    expect(
      evaluateCanary(
        healthy({ rowCount: 0, parsedCount: 0, emptyCyclesWithChatOpen: BROKEN_EMPTY_CYCLES }),
      ),
    ).toBe("broken");
    // acima do limiar também
    expect(
      evaluateCanary(
        healthy({ rowCount: 0, parsedCount: 0, emptyCyclesWithChatOpen: BROKEN_EMPTY_CYCLES + 2 }),
      ),
    ).toBe("broken");
  });

  it("0 linhas mas AINDA abaixo do limiar de ciclos → não é quebra (pode ser conversa recém-aberta)", () => {
    expect(
      evaluateCanary(
        healthy({ rowCount: 0, parsedCount: 0, emptyCyclesWithChatOpen: BROKEN_EMPTY_CYCLES - 1 }),
      ),
    ).toBe("ok");
  });

  it("mais de 30% das linhas sem parse → broken (formato mudou)", () => {
    // 40% de falha (10 linhas, 6 parseadas) > limiar de 30%
    expect(evaluateCanary(healthy({ rowCount: 10, parsedCount: 6 }))).toBe("broken");
  });

  it("taxa de falha abaixo do limiar → segue ok (linhas exóticas isoladas não são quebra)", () => {
    // 20% de falha (10 linhas, 8 parseadas) <= 30%
    expect(evaluateCanary(healthy({ rowCount: 10, parsedCount: 8 }))).toBe("ok");
    // exatamente no limiar não dispara (o limiar é "acima de")
    expect(evaluateCanary(healthy({ rowCount: 10, parsedCount: 7 }))).toBe("ok");
    expect(BROKEN_PARSE_FAILURE_RATIO).toBe(0.3);
  });

  it("fallback secundário da cadeia em uso → drift (reportar, seguir operando)", () => {
    expect(evaluateCanary(healthy({ fallbackInUse: true }))).toBe("drift");
  });

  it("exceção não tratada no ciclo de extração → broken (fail-safe)", () => {
    expect(evaluateCanary(healthy({ hadException: true }))).toBe("broken");
  });

  it("broken tem precedência sobre drift (fallback em uso + taxa de falha alta)", () => {
    expect(
      evaluateCanary(healthy({ fallbackInUse: true, rowCount: 10, parsedCount: 3 })),
    ).toBe("broken");
  });
});

describe("evaluateCanary — disconnected NUNCA é broken (Pitfall 2)", () => {
  it("appRoot ausente (tela de QR / loading / logout) → disconnected", () => {
    expect(evaluateCanary(healthy({ appRootPresent: false, mainPresent: false, rowCount: 0, parsedCount: 0 }))).toBe(
      "disconnected",
    );
  });

  it("appRoot ausente vence QUALQUER outro sinal de quebra — zero falso positivo do banner D-13", () => {
    expect(
      evaluateCanary(
        healthy({
          appRootPresent: false,
          mainPresent: false,
          rowCount: 0,
          parsedCount: 0,
          hadException: true,
          fallbackInUse: true,
          emptyCyclesWithChatOpen: BROKEN_EMPTY_CYCLES + 10,
        }),
      ),
    ).toBe("disconnected");
  });

  it("main ausente com appRoot presente → no_chat (nenhuma conversa aberta ≠ erro)", () => {
    expect(
      evaluateCanary(healthy({ mainPresent: false, rowCount: 0, parsedCount: 0 })),
    ).toBe("no_chat");
  });

  it("no_chat também vence sinais de quebra (sem conversa não há o que parsear)", () => {
    expect(
      evaluateCanary(
        healthy({
          mainPresent: false,
          rowCount: 0,
          parsedCount: 0,
          emptyCyclesWithChatOpen: BROKEN_EMPTY_CYCLES + 1,
        }),
      ),
    ).toBe("no_chat");
  });
});
