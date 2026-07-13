/**
 * Testes do adapter reader/state.ts (plano 02-06, Task 1).
 *
 * Cobertura da matriz de mapeamento signalsToReaderInputs:
 *   canary === "broken"       → readerBroken: true
 *   canary === "disconnected" → waConnected: false (NUNCA readerBroken — Pitfall 2)
 *   canary === "no_chat"      → waConnected: true, activeChat: null
 *   canary === "ok"/"drift"   → readerBroken: false, waConnected: true
 *   killSwitch true           → killSwitchActive: true
 *   activeChat presente       → activeChat: { isGroup, lead }
 *   activeChat null           → activeChat: null
 *   D-04: collapsed NÃO aparece em ReaderSignals nem em ReaderInputs (painel
 *         recolhido não afeta a leitura)
 */
import { describe, expect, it } from "vitest";
import type { CanaryVerdict } from "../entrypoints/whatsapp.content/reader/canary";
import {
  signalsToReaderInputs,
  type ReaderSignals,
} from "../entrypoints/whatsapp.content/reader/state";

/** Sinal base padrão (caso feliz) */
const BASE_SIGNALS: ReaderSignals = {
  session: {} as never, // presença da sessão (não mapeada pelo adapter)
  profileRemoved: false,
  waConnected: true,
  activeChat: { chatId: "title:Lead Teste", isGroup: false, contactName: "Lead Teste" },
  canary: "ok",
  killSwitch: false,
};

describe("signalsToReaderInputs — mapeamento de ReaderSignals para ReaderInputs parcial", () => {
  // ──────────────────────────────────────────────────
  // Canary verdicts
  // ──────────────────────────────────────────────────
  it("canary ok → readerBroken false, waConnected true", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, canary: "ok" });
    expect(result.readerBroken).toBe(false);
    expect(result.waConnected).toBe(true);
  });

  it("canary drift → readerBroken false, waConnected true (drift reportado pelo flags, não muda a view)", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, canary: "drift" });
    expect(result.readerBroken).toBe(false);
    expect(result.waConnected).toBe(true);
  });

  it("canary broken → readerBroken true", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, canary: "broken" });
    expect(result.readerBroken).toBe(true);
  });

  it("canary disconnected → waConnected false e readerBroken false (Pitfall 2: desconectado NUNCA é quebra)", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, canary: "disconnected" });
    expect(result.waConnected).toBe(false);
    expect(result.readerBroken).toBe(false);
  });

  it("canary no_chat → waConnected true, activeChat null (nenhuma conversa aberta ≠ erro)", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, canary: "no_chat", activeChat: null });
    expect(result.waConnected).toBe(true);
    expect(result.activeChat).toBeNull();
  });

  // ──────────────────────────────────────────────────
  // Kill-switch
  // ──────────────────────────────────────────────────
  it("killSwitch true → killSwitchActive true", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, killSwitch: true });
    expect(result.killSwitchActive).toBe(true);
  });

  it("killSwitch false → killSwitchActive false", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, killSwitch: false });
    expect(result.killSwitchActive).toBe(false);
  });

  // ──────────────────────────────────────────────────
  // activeChat mapeamento
  // ──────────────────────────────────────────────────
  it("activeChat com conversa individual → activeChat com isGroup false e lead preenchido", () => {
    const result = signalsToReaderInputs({
      ...BASE_SIGNALS,
      activeChat: { chatId: "title:Lead", isGroup: false, contactName: "Lead Teste" },
    });
    expect(result.activeChat).toEqual({
      isGroup: false,
      lead: { name: "Lead Teste", phone: null },
    });
  });

  it("activeChat com grupo → activeChat com isGroup true (D-02: painel mostra aviso de grupo)", () => {
    const result = signalsToReaderInputs({
      ...BASE_SIGNALS,
      activeChat: { chatId: "title:Grupo do Escritório", isGroup: true, contactName: "Grupo do Escritório" },
    });
    expect(result.activeChat).toEqual({
      isGroup: true,
      lead: { name: "Grupo do Escritório", phone: null },
    });
  });

  it("activeChat null → activeChat null (nenhuma conversa aberta)", () => {
    const result = signalsToReaderInputs({ ...BASE_SIGNALS, activeChat: null });
    expect(result.activeChat).toBeNull();
  });

  // ──────────────────────────────────────────────────
  // Combinações críticas de prioridade (mesmas do resolveView no store.ts)
  // ──────────────────────────────────────────────────
  it("broken + killSwitch true → ambos os flags mapeados (store.ts decide a prioridade com resolveView)", () => {
    const result = signalsToReaderInputs({
      ...BASE_SIGNALS,
      canary: "broken",
      killSwitch: true,
    });
    // O adapter mapeia TUDO; o resolveView no store decide a prioridade.
    expect(result.readerBroken).toBe(true);
    expect(result.killSwitchActive).toBe(true);
  });

  it("disconnected + broken → waConnected false e readerBroken false (disconnected vence broken — Pitfall 2)", () => {
    // Quando o app root está ausente (disconnected), a extração não roda — não há
    // como ter "broken" ao mesmo tempo em cenário real. Mas se chegasse, o adapter
    // deve respeitar o Pitfall 2: disconnected → waConnected false NUNCA readerBroken.
    // Nota: na prática os observers param quando waConnected false — este teste
    // documenta o contrato de mapeamento.
    const result = signalsToReaderInputs({
      ...BASE_SIGNALS,
      canary: "disconnected",
    });
    expect(result.waConnected).toBe(false);
    expect(result.readerBroken).toBe(false);
  });

  // ──────────────────────────────────────────────────
  // D-04: recolher o painel NÃO aparece em ReaderSignals
  // ──────────────────────────────────────────────────
  it("ReaderSignals não expõe collapsed — a leitura é indiferente ao estado do painel (D-04)", () => {
    // Verificação de contrato de tipos: collapsed não existe no objeto de sinais.
    const signals: ReaderSignals = BASE_SIGNALS;
    // TypeScript impediria `signals.collapsed` em tempo de compilação — aqui
    // verificamos que a chave não existe em runtime no objeto produzido.
    expect("collapsed" in signals).toBe(false);
    const result = signalsToReaderInputs(signals);
    expect("collapsed" in result).toBe(false);
  });

  // ──────────────────────────────────────────────────
  // Campos session e profileRemoved não são mapeados para ReaderInputs
  // (pertencem ao PanelProvider diretamente)
  // ──────────────────────────────────────────────────
  it("session e profileRemoved NÃO aparecem no resultado (são insumos diretos do PanelProvider)", () => {
    const result = signalsToReaderInputs(BASE_SIGNALS);
    expect("session" in result).toBe(false);
    expect("profileRemoved" in result).toBe(false);
  });
});
