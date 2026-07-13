// Gate estático de SOMENTE-LEITURA (EXT-08) — garantia arquitetural verificável
// do requisito "a extensão NUNCA envia mensagens nem escreve no DOM do WhatsApp".
//
// Varre os fontes .ts/.tsx de reader/ e sync/ (excluindo testes) e FALHA se
// encontrar qualquer API da lista proibida do Pattern 8 do 02-RESEARCH.md.
// Roda localmente (vitest) e no CI (extension-ci.yml) — o build quebra se
// alguém introduzir escrita no DOM. Mitigação primária do risco de banimento
// (a Meta bane automação de ENVIO; leitura passiva não — T-02-13).
//
// Decisão de discretion (documentada no plano 02-04): gate como teste vitest +
// step de CI em vez de plugin ESLint — o repo não tem ESLint configurado;
// mesma garantia, zero dependência nova.
//
// EXCEÇÕES (lista FECHADA, fora do escopo do gate por design — Pattern 8):
//   1. Criação do host do painel (createShadowRootUi appenda um custom element
//      ao body) — vive em index.tsx/panel/, NÃO em reader/ ou sync/.
//   2. Reserva de largura do painel (ajuste de estilo no raiz do WhatsApp para
//      comprimir, não sobrepor) — idem, documentada no index.tsx (02-03).
// Nenhuma das duas toca a árvore da conversa, o campo de texto ou dispara eventos.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Diretórios sob vigilância: TODO o código que toca o DOM do WhatsApp ou o sync. */
const SCAN_DIRS = [
  "entrypoints/whatsapp.content/reader",
  "entrypoints/whatsapp.content/sync",
];

/** Padrões PROIBIDOS (Pattern 8 do 02-RESEARCH.md + D-03). */
const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
  // Eventos sintéticos — o vetor clássico de automação de envio
  { name: "evento sintético (dispatchEvent)", pattern: /\.dispatchEvent\s*\(/ },
  { name: "criação de evento sintético (new Event/KeyboardEvent/MouseEvent/InputEvent)", pattern: /new\s+(Keyboard|Mouse|Input|Pointer|Composition)?Event\s*\(/ },
  // Edição de documento
  { name: "comando de edição (execCommand)", pattern: /\bexecCommand\s*\(/ },
  // Interação programática
  { name: "clique programático (.click())", pattern: /\.click\s*\(/ },
  { name: "foco programático (.focus())", pattern: /\.focus\s*\(/ },
  // Atribuições de conteúdo/valor
  { name: "atribuição de innerHTML/outerHTML", pattern: /\.(innerHTML|outerHTML)\s*=[^=]/ },
  { name: "atribuição de textContent", pattern: /\.textContent\s*=[^=]/ },
  { name: "atribuição de value", pattern: /\.value\s*=[^=]/ },
  { name: "insertAdjacent*", pattern: /\.insertAdjacent(HTML|Element|Text)\s*\(/ },
  // Inserção/remoção de nós
  {
    name: "inserção de nós (appendChild/append/prepend/insertBefore/before/after/replaceWith/replaceChildren)",
    pattern: /\.(appendChild|append|prepend|insertBefore|before|after|replaceWith|replaceChildren)\s*\(/,
  },
  { name: "remoção de nós (removeChild)", pattern: /\.removeChild\s*\(/ },
  // Atributos e estilo
  { name: "escrita de atributo (setAttribute/removeAttribute/toggleAttribute)", pattern: /\.(setAttribute|removeAttribute|toggleAttribute)\s*\(/ },
  { name: "escrita de classe (classList.add/remove/toggle)", pattern: /\.classList\.(add|remove|toggle)\s*\(/ },
  // Rolagem programática — D-03: a extensão NUNCA rola sozinha
  { name: "rolagem programática (scrollTo/scrollBy/scrollIntoView) — D-03", pattern: /\.(scrollTo|scrollBy|scrollIntoView)\s*\(/ },
  { name: "atribuição de scrollTop/scrollLeft — D-03", pattern: /\.(scrollTop|scrollLeft)\s*=[^=]/ },
  // APIs de depuração/injeção
  { name: "chrome.debugger", pattern: /chrome\.debugger/ },
  { name: "injeção de script (chrome.scripting)", pattern: /chrome\.scripting/ },
];

interface Violation {
  file: string;
  line: number;
  rule: string;
  excerpt: string;
}

function isSourceFile(name: string): boolean {
  if (!/\.(ts|tsx)$/.test(name)) return false;
  return !/\.(test|spec)\.(ts|tsx)$/.test(name);
}

/** Lista recursivamente os fontes de um diretório (ignora se não existir ainda). */
function listSources(dir: string): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // diretório ainda não criado (ex.: sync/ antes do 02-06) — nada a varrer
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSources(full));
    else if (entry.isFile() && isSourceFile(entry.name)) files.push(full);
  }
  return files;
}

function scanFile(file: string): Violation[] {
  const violations: Violation[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    // Comentários de linha inteira não executam — mas mantê-los fora do gate
    // exigiria um parser; só ignoramos linhas que COMEÇAM como comentário.
    const trimmed = text.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) {
        violations.push({ file, line: i + 1, rule: rule.name, excerpt: trimmed.slice(0, 120) });
      }
    }
  });
  return violations;
}

describe("gate somente-leitura (EXT-08) — reader/ e sync/ jamais escrevem no DOM", () => {
  const roots = SCAN_DIRS.map((d) => join(process.cwd(), d));
  const files = roots.flatMap(listSources);

  it("encontra os fontes do reader (sanidade: o gate não pode varrer o vazio)", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("reader"))).toBe(true);
  });

  it("nenhuma API de escrita/evento sintético/rolagem/debugger nos módulos vigiados", () => {
    const violations = files.flatMap(scanFile);
    const formatted = violations.map(
      (v) => `${v.file}:${v.line} — ${v.rule}\n    ${v.excerpt}`,
    );
    expect(formatted, `APIs proibidas encontradas (EXT-08):\n${formatted.join("\n")}`).toEqual([]);
  });
});
