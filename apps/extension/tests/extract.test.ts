// Testes de regressão do parser (EXT-03) contra fixtures REAIS sanitizadas do spike
// (02-SPIKE.md, 2026-07-12, WhatsApp Business Web). Estas fixtures são a rede de
// proteção contra drift de seletor: quando o WhatsApp mudar o DOM, esta suíte quebra
// ANTES do produto quebrar em produção.
//
// Fonte de verdade das âncoras: .planning/phases/02-.../02-SPIKE.md
// - data-id é HASH PURO (drift confirmado — sem prefixo bool/chatId/@c.us)
// - from-me: tail-out/tail-in → aria-label "Você:" → fallback recibo em msg-meta
// - áudio NÃO tem data-pre-plain-text (hora via msg-meta)
// - grupo: span[data-testid="author"] (row) / chat-subtitle (header) — substitui @g.us
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MessageDTO } from "@copiloto/shared";
import {
  detectMediaKind,
  extractMessageRow,
  extractVisibleMessages,
  extractWithReport,
  isGroupChatId,
  isGroupHeader,
  isGroupMessageRow,
  parseChatIdFromDataId,
  parsePrePlainText,
  parsePtBrTimestamp,
} from "../entrypoints/whatsapp.content/reader/extract";

/** Data de referência determinística para mensagens sem data (áudio: só hora no msg-meta). */
const REF_DATE = new Date(2026, 6, 11, 23, 0, 0);

function loadHtml(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

/** Carrega uma fixture e devolve o elemento raiz (linha de mensagem ou header). */
function loadFixture(name: string): Element {
  const host = document.createElement("div");
  host.innerHTML = loadHtml(name);
  const root = host.querySelector("[data-id], header");
  if (!root) throw new Error(`fixture sem elemento raiz: ${name}`);
  return root;
}

function extract(name: string): MessageDTO {
  const dto = extractMessageRow(loadFixture(name), { referenceDate: REF_DATE });
  if (!dto) throw new Error(`extractMessageRow devolveu null para ${name}`);
  return dto;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

describe("extractMessageRow — texto (fixtures reais)", () => {
  it("msg-in-text: recebida → fromMe false, kind text, conteúdo integral, sender e sentAt", () => {
    const dto = extract("msg-in-text.html");
    expect(dto.fromMe).toBe(false);
    expect(dto.kind).toBe("text");
    expect(dto.content).toBe(
      "Olá, Advogado Teste! Tudo bem? Aqui é o Contato Teste. Obrigado pelo contato. Hoje, nosso maior desafio é gerar mais demanda (novos clientes), embora a conversão também seja um ponto de atenção constante para nós.",
    );
    expect(dto.sender).toBe("Contato Teste");
    expect(dto.sentAt).toMatch(ISO_RE);
    expect(Number.isNaN(new Date(dto.sentAt as string).getTime())).toBe(false);
  });

  it("msg-out-text: enviada (tail-out + 'Você:') → fromMe true, multi-linha preservada", () => {
    const dto = extract("msg-out-text.html");
    expect(dto.fromMe).toBe(true);
    expect(dto.kind).toBe("text");
    expect(dto.content).toContain("Olá, Contato Teste, tudo bem?");
    expect(dto.content).toContain(
      "gerar demanda (novos clientes) ou converter melhor os contatos que já chegam?",
    );
    expect(dto.content).toMatch(/\n/); // multi-linha do WhatsApp preservada
    expect(dto.sentAt).toMatch(ISO_RE);
  });

  it("msg-out-text-enviada: SEM tail, com 'Você:' e recibo ' Enviada ' → fromMe true", () => {
    const dto = extract("msg-out-text-enviada.html");
    expect(dto.fromMe).toBe(true);
    expect(dto.kind).toBe("text");
    expect(dto.content).toBe("Atendemos em {LOCATION(City)}");
  });

  it("concatena alt de emojis no texto (emojis viram img[alt] no WhatsApp)", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<div data-id="EMOJI1"><div class="copyable-text" data-pre-plain-text="[10:00, 11/07/2026] Contato Teste: ">' +
      '<span data-testid="selectable-text" class="selectable-text copyable-text">Oi <img alt="😀"> tudo bem</span>' +
      '</div><div data-testid="msg-meta"><span>10:00</span></div></div>';
    const dto = extractMessageRow(host.querySelector("[data-id]") as Element, {
      referenceDate: REF_DATE,
    });
    expect(dto?.content).toBe("Oi 😀 tudo bem");
  });
});

describe("extractMessageRow — mídia vira marcador pt-BR (EXT-03)", () => {
  it("msg-audio: voz enviada (SEM data-pre-plain-text) → kind audio, content '[áudio]', hora via msg-meta", () => {
    const dto = extract("msg-audio.html");
    expect(dto.kind).toBe("audio");
    expect(dto.content).toBe("[áudio]");
    expect(dto.fromMe).toBe(true); // 'Você:' + recibo " Entregue "
    expect(dto.sentAt).toMatch(ISO_RE); // hora 13:25 do msg-meta + referenceDate
  });

  it("msg-in-audio: voz recebida → fromMe false, remetente do aria-label com telefone", () => {
    const dto = extract("msg-in-audio.html");
    expect(dto.kind).toBe("audio");
    expect(dto.content).toBe("[áudio]");
    expect(dto.fromMe).toBe(false); // tail-in, SEM recibo
    expect(dto.sender).toBe("+55 11 9000-0000");
  });

  it("msg-out-audio-forwarded: SEM tail e SEM 'Você:' → fromMe true SÓ pelo recibo em msg-meta", () => {
    const dto = extract("msg-out-audio-forwarded.html");
    expect(dto.kind).toBe("audio");
    expect(dto.content).toBe("[áudio]");
    expect(dto.fromMe).toBe(true); // recibo " Lida " é o único critério universal (02-SPIKE.md A1b)
  });

  it("msg-image: imagem enviada com legenda → kind image, content '[imagem]', fromMe pelo recibo", () => {
    const dto = extract("msg-image.html");
    expect(dto.kind).toBe("image");
    expect(dto.content).toBe("[imagem]");
    expect(dto.fromMe).toBe(true); // sem tail na fixture; recibo " Lida "
    expect(dto.sentAt).toMatch(ISO_RE); // pre-plain-text existe quando há legenda
  });

  it("documento (SINTÉTICO — gap do spike): msg-meta presente sem texto/voz/imagem → '[documento]'", () => {
    // A fixture msg-document.html NÃO foi capturada no spike (gap registrado no
    // 02-SPIKE.md). Heurística por exclusão até a captura real: tem msg-meta,
    // sem âncora de texto, voz ou imagem.
    const host = document.createElement("div");
    host.innerHTML =
      '<div data-id="DOC0000000000000F999"><span aria-label="Você:"></span>' +
      '<div data-testid="msg-meta"><span>10:00</span>' +
      '<span aria-hidden="false" aria-label=" Lida "></span></div></div>';
    const row = host.querySelector("[data-id]") as Element;
    expect(detectMediaKind(row)).toBe("document");
    const dto = extractMessageRow(row, { referenceDate: REF_DATE });
    expect(dto?.kind).toBe("document");
    expect(dto?.content).toBe("[documento]");
  });

  it("linha com data-id sem NENHUM atributo esperado → kind other, '[não suportado]' (nunca null silencioso)", () => {
    const host = document.createElement("div");
    host.innerHTML = '<div data-id="ZZZ0000000000000F000"><span>???</span></div>';
    const dto = extractMessageRow(host.querySelector("[data-id]") as Element, {
      referenceDate: REF_DATE,
    });
    expect(dto).not.toBeNull();
    expect(dto?.kind).toBe("other");
    expect(dto?.content).toBe("[não suportado]");
    expect(dto?.waMessageId).toBe("ZZZ0000000000000F000");
  });
});

describe("identidade da mensagem (dedup EXT-04)", () => {
  it("waMessageId é SEMPRE o data-id completo (hash puro pós-drift — 02-SPIKE.md A1)", () => {
    expect(extract("msg-in-text.html").waMessageId).toBe("CEDC000000000000F005");
    expect(extract("msg-out-text.html").waMessageId).toBe("3EB0000000000000F002");
    expect(extract("msg-audio.html").waMessageId).toBe("3EB0000000000000F00003");
    expect(extract("msg-group.html").waMessageId).toBe("3BF2000000000000F009");
  });
});

describe("parseChatIdFromDataId — tolerante ao formato legado E ao hash puro atual", () => {
  it("hash puro (formato ATUAL, drift confirmado no spike) → chatId/fromMe null", () => {
    const parsed = parseChatIdFromDataId("3EB0FD030D7C061FE4C6");
    expect(parsed.waMessageId).toBe("3EB0FD030D7C061FE4C6");
    expect(parsed.chatId).toBeNull();
    expect(parsed.fromMe).toBeNull();
  });

  it("formato legado {bool}_{chatId}_{hash} ainda é reconhecido (tolerância a rollback)", () => {
    const parsed = parseChatIdFromDataId("false_5511999999999@c.us_3EB0FD030D7C");
    expect(parsed.chatId).toBe("5511999999999@c.us");
    expect(parsed.fromMe).toBe(false);
    expect(parsed.waMessageId).toBe("false_5511999999999@c.us_3EB0FD030D7C");
    const sent = parseChatIdFromDataId("true_123456789@g.us_AAA1");
    expect(sent.fromMe).toBe(true);
    expect(sent.chatId).toBe("123456789@g.us");
  });
});

describe("detecção de grupo (D-02)", () => {
  it("isGroupChatId: sufixo @g.us legado → true; @c.us e @lid (opacos, Pitfall 9) → false", () => {
    expect(isGroupChatId("123456789-987654@g.us")).toBe(true);
    expect(isGroupChatId("5511999999999@c.us")).toBe(false);
    expect(isGroupChatId("204837465651243@lid")).toBe(false);
    expect(isGroupChatId("")).toBe(false);
    expect(isGroupChatId("title:Grupo Teste")).toBe(false);
  });

  it("msg-group: linha recebida em grupo tem span[data-testid=author] → grupo (âncora pós-drift)", () => {
    const row = loadFixture("msg-group.html");
    expect(isGroupMessageRow(row)).toBe(true);
    const dto = extractMessageRow(row, { referenceDate: REF_DATE });
    expect(dto?.fromMe).toBe(false); // tail-in
    expect(dto?.kind).toBe("image");
    expect(dto?.content).toBe("[imagem]");
    expect(dto?.sender).toBe("Contato Teste"); // nome no balão via author
  });

  it("linhas 1:1 nunca têm author → não é grupo", () => {
    expect(isGroupMessageRow(loadFixture("msg-in-text.html"))).toBe(false);
    expect(isGroupMessageRow(loadFixture("msg-out-text.html"))).toBe(false);
    expect(isGroupMessageRow(loadFixture("msg-in-audio.html"))).toBe(false);
  });

  it("header-group: chat-subtitle com participantes → grupo; header 1:1 sem subtitle → não", () => {
    expect(isGroupHeader(loadFixture("header-group.html"))).toBe(true);
    expect(isGroupHeader(loadFixture("header.html"))).toBe(false);
  });
});

describe("mensagens de sistema (02-SPIKE.md: parser deve IGNORAR)", () => {
  it("msg-system (aviso Meta Business) → null, e extractVisibleMessages não a inclui", () => {
    const row = loadFixture("msg-system.html");
    expect(extractMessageRow(row, { referenceDate: REF_DATE })).toBeNull();

    const main = document.createElement("div");
    main.innerHTML = loadHtml("msg-in-text.html") + loadHtml("msg-system.html");
    const messages = extractVisibleMessages(main, { referenceDate: REF_DATE });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.waMessageId).toBe("CEDC000000000000F005");
  });
});

describe("parsePtBrTimestamp / parsePrePlainText", () => {
  it("data e hora pt-BR válidas → ISO parseável", () => {
    const iso = parsePtBrTimestamp("11/07/2026", "14:32");
    expect(iso).toMatch(ISO_RE);
    const d = new Date(iso as string);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // julho
    expect(d.getDate()).toBe(11);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(32);
  });

  it("formato inesperado → null, sem lançar", () => {
    expect(parsePtBrTimestamp("banana", "xx:yy")).toBeNull();
    expect(parsePtBrTimestamp("", "")).toBeNull();
    expect(parsePtBrTimestamp("31/02/2026", "14:32")).toBeNull(); // data impossível não faz rollover
    expect(parsePtBrTimestamp("11/07/2026", "25:99")).toBeNull();
  });

  it("parsePrePlainText: '[14:32, 11/07/2026] Nome:' → sender + sentAt ISO válido", () => {
    const parsed = parsePrePlainText("[14:32, 11/07/2026] Nome:");
    expect(parsed.sender).toBe("Nome");
    expect(parsed.sentAt).toMatch(ISO_RE);
  });

  it("parsePrePlainText tolera espaço final e devolve null/null para formato desconhecido", () => {
    const parsed = parsePrePlainText("[15:56, 11/07/2026] Advogado Teste: ");
    expect(parsed.sender).toBe("Advogado Teste");
    expect(parsed.sentAt).toMatch(ISO_RE);
    expect(parsePrePlainText("qualquer coisa")).toEqual({ sender: null, sentAt: null });
  });
});

describe("extractVisibleMessages / extractWithReport", () => {
  function buildMain(...names: string[]): Element {
    const main = document.createElement("div");
    main.id = "main";
    main.innerHTML = names.map(loadHtml).join("");
    return main;
  }

  it("extrai todas as linhas visíveis na ordem do DOM, com waChatId consistente e opaco", () => {
    const main = buildMain("header.html", "msg-in-text.html", "msg-out-text.html");
    const messages = extractVisibleMessages(main, { referenceDate: REF_DATE });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.waMessageId).toBe("CEDC000000000000F005");
    expect(messages[1]?.waMessageId).toBe("3EB0000000000000F002");
    // wa_chat_id: string opaca derivada de âncora estável do main (pós-drift o
    // data-id não carrega mais o chatId — decisão documentada no SUMMARY)
    expect(messages[0]?.waChatId).toBeTruthy();
    expect(messages[0]?.waChatId).toBe(messages[1]?.waChatId);
    // determinística entre ciclos (dedup por (profile, wa_chat_id) depende disso)
    const again = extractVisibleMessages(main, { referenceDate: REF_DATE });
    expect(again[0]?.waChatId).toBe(messages[0]?.waChatId);
  });

  it("linha não parseável NÃO é descartada em silêncio: vira [não suportado] e conta no report", () => {
    const main = buildMain("header.html", "msg-in-text.html", "msg-out-text.html");
    const stray = document.createElement("div");
    stray.setAttribute("data-id", "XXX0000000000000F111");
    stray.innerHTML = "<span>estrutura desconhecida</span>";
    main.appendChild(stray);

    const { messages, report } = extractWithReport(main, { referenceDate: REF_DATE });
    expect(messages).toHaveLength(3);
    expect(messages[2]?.kind).toBe("other");
    expect(messages[2]?.content).toBe("[não suportado]");
    expect(report.rowCount).toBe(3);
    expect(report.parsedCount).toBe(2);
    expect(report.unsupportedCount).toBe(1);
    expect(report.hadException).toBe(false);
  });

  it("elementos sem data-id não são linhas de mensagem", () => {
    const main = buildMain("header.html");
    const noise = document.createElement("div");
    noise.textContent = "não sou mensagem";
    main.appendChild(noise);
    expect(extractVisibleMessages(main, { referenceDate: REF_DATE })).toHaveLength(0);
  });
});
