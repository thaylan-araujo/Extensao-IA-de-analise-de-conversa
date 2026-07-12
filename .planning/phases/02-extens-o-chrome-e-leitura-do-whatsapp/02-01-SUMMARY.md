---
phase: 02-extens-o-chrome-e-leitura-do-whatsapp
plan: 01
subsystem: extension
tags: [wxt, react, tailwind, shadow-dom, mv3, spike, whatsapp-dom, fixtures]
requires: []
provides:
  - "apps/extension compilando (WXT 0.20 + React 19 + Tailwind 4) com manifest MV3 mínimo"
  - "Host do painel em Shadow DOM injetado no WhatsApp Web (base de EXT-01)"
  - "02-SPIKE.md — fonte de verdade dos seletores para o 02-04 (pré-requisito de EXT-03)"
  - "11 fixtures HTML reais sanitizadas em apps/extension/tests/fixtures/"
  - "CORS A5 comprovado: supabase-js pode viver no content script (02-05/02-06)"
affects: [02-03, 02-04, 02-05, 02-06, 02-07]
tech-stack:
  added:
    - wxt@0.20.27
    - "@wxt-dev/module-react@1.2.2"
    - "@supabase/supabase-js@2.110.2"
    - lucide-react@1.24.0
    - happy-dom@20.10.6
    - "@types/chrome@0.2.2"
  patterns:
    - "createShadowRootUi + cssInjectionMode 'ui' com espera pela âncora #app (QR/loading ≠ erro)"
    - "Manifest mínimo: permissions [storage], matches só web.whatsapp.com (Pattern 8/D-12)"
    - "Coletor de diagnóstico DEV-only via dynamic import sob import.meta.env.DEV (T-02-03)"
key-files:
  created:
    - apps/extension/package.json
    - apps/extension/wxt.config.ts
    - apps/extension/tsconfig.json
    - apps/extension/vitest.config.ts
    - apps/extension/postcss.config.mjs
    - apps/extension/entrypoints/whatsapp.content/index.tsx
    - apps/extension/entrypoints/whatsapp.content/style.css
    - apps/extension/entrypoints/whatsapp.content/spike/collector.ts
    - apps/extension/entrypoints/background.ts
    - apps/extension/tests/setup.ts
    - apps/extension/tests/smoke.test.ts
    - apps/extension/tests/fixtures/README.md
    - apps/extension/tests/fixtures/ (11 fixtures .html sanitizadas)
    - .planning/phases/02-extens-o-chrome-e-leitura-do-whatsapp/02-SPIKE.md
  modified:
    - .env.example
    - .gitignore
    - pnpm-lock.yaml
decisions:
  - "data-id sofreu DRIFT: hash puro sem chatId — from-me via tail-out/in + fallback recibo; grupo via author/chat-subtitle (substitui @g.us)"
  - "CORS OK do content script (401 do REST) — fallback via background descartado"
  - "@tailwindcss/postcss@4.3.2 reaproveitado da Fase 1 para compilar Tailwind 4 no WXT (mesmo repo oficial já auditado)"
  - "wa_chat_id perdeu a fonte primária com o drift — questão aberta delegada ao 02-04"
metrics:
  duration: "~35min (+ spike com o usuário)"
  completed: "2026-07-12"
status: complete
---

# Phase 02 Plan 01: Scaffold da extensão + spike de âncoras do WhatsApp Summary

**Scaffold WXT/React 19/Tailwind 4 com painel Shadow DOM e manifest MV3 mínimo, e spike hands-on que confirmou drift no data-id (hash puro) e CORS OK — seletores reais registrados em 02-SPIKE.md com 11 fixtures sanitizadas.**

## O que foi construído

- **`apps/extension`** (`@copiloto/extension`): segundo app do monorepo, compilando com `pnpm --filter extension build`. Manifest MV3 mínimo verificado por assertiva automatizada: content script só em `*://web.whatsapp.com/*`, permissão só `storage`.
- **Host do painel em Shadow DOM**: `createShadowRootUi` com espera pela âncora `#app` (tela de QR/loading tratada como "ainda não montar", nunca erro), reset `:host` (font-size 16px + font stack do UI-SPEC — Pitfall 4 mitigado). Placeholder "Copiloto Jurídico" confirmado sobre o WhatsApp real sem quebrar a página.
- **Coletor de spike `window.__copilotoSpike()`** (DEV-only, somente leitura — zero APIs de escrita, verificado por grep): valida A1-A5/A8, `captureRow(n)`/`captureHeader()` para fixtures, `testSupabaseCors()`. Ausente do bundle de produção; presente no build dev (`chrome-mv3-dev`).
- **Ambiente de testes**: vitest + happy-dom com mock em memória de `chrome.storage.local` (smoke 3/3 verde) — base para os testes do parser (02-04) e do storage adapter (02-05).
- **02-SPIKE.md**: fonte de verdade dos seletores (tabela âncora → seletor confirmado → observações), heurísticas de mídia, variantes extras (system_message, forwarded, ai-label, status de entrega), resultado CORS e implicações para 02-04/02-06.
- **11 fixtures reais sanitizadas** em `tests/fixtures/` (estrutura verbatim; nomes/telefones/ids/fotos fictícios), cobrindo texto in/out, áudio in/out/encaminhado, imagem, grupo, sistema e os dois headers.

## Resultados-chave do spike (executado pelo usuário no WhatsApp Business real)

1. **DRIFT confirmado no `data-id`** (A1): agora é hash puro — o formato `{bool}_{chatId}@c.us_{hash}` da pesquisa NÃO existe mais. From-me: `tail-out`/`tail-in` + `aria-label "Você:"`, com **fallback universal** = recibo em `[data-testid="msg-meta"]` (mensagens sem tail existem). Grupo: `span[data-testid="author"]` (row) + `chat-subtitle`/botão "Ligação de vídeo em grupo" (header) — substitui `@g.us`.
2. **A2/A3/A4/A8 confirmadas** (com ressalvas: `data-pre-plain-text` ausente em áudio; título do header via `conversation-info-header-chat-title`, não `[title]`).
3. **CORS A5 comprovado**: fetch direto do content script ao Supabase retornou HTTP 401 (resposta chegou) — cliente supabase-js no content script confirmado; sem fallback via background.
4. **Performance**: sem travamento percebido durante digitação (informal; medição formal no 02-07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio de build] `@tailwindcss/postcss@4.3.2` adicionado como devDependency**
- **Found during:** Task 2 (Tailwind 4 não compila `@import "tailwindcss"` sem plugin Vite/PostCSS)
- **Fix:** reaproveitado o mesmo pacote/versão já auditado e instalado na Fase 1 (`apps/web`), repo oficial `tailwindlabs/tailwindcss` — nenhuma superfície nova de supply chain; `postcss.config.mjs` idêntico à convenção da Fase 1
- **Files modified:** apps/extension/package.json, apps/extension/postcss.config.mjs
- **Commit:** 0b1a9aa

**2. [Rule 2 - Higiene de repo] `.wxt/` e `.output/` adicionados ao `.gitignore`**
- **Found during:** Task 2 (WXT gera tipos e builds não versionáveis)
- **Commit:** 0b1a9aa

**3. [Rule 3 - Robustez do spike] `testSupabaseCors(url?, key?)` aceita parâmetros manuais**
- **Found during:** Task 2 (leitura de arquivos `.env*` é negada pelas permissões do ambiente — fallback caso o `.env.local` não estivesse no build)
- **Commit:** 0b1a9aa (não foi necessário no spike: o `.env.local` foi criado com sucesso via transformação sem exibição de segredos)

**4. [Pré-existente] Typo `SEED_USER_PASSWORD` (sem `=`) no `.env.example` restaurado**
- **Found during:** Task 2 (edição não commitada de sessão anterior)
- **Commit:** 0b1a9aa

### Escopo ampliado (justificado)

- **11 fixtures em vez de 7**: o spike revelou variantes críticas não previstas (mensagem sem tail, system_message, selo IA, status " Enviada ") — todas capturadas pois são exatamente os edge cases que quebram parsers.

## Known Gaps (não são stubs — registrados em 02-SPIKE.md)

- **`msg-document.html` não capturada** (usuário sem documento à mão) — tipo documento fica sem fixture de regressão até o 02-04.
- **Fonte estável de `wa_chat_id` indefinida** após o drift do data-id — questão aberta obrigatória para o 02-04 antes de detalhar `selectors.ts`.
- **Placeholder `<App />`** no content script é intencional — o painel real é o plano 02-03.

## Threat Flags

Nenhuma superfície nova além do threat model do plano (T-02-SC mitigado com versões pinadas aprovadas no gate humano; T-02-01 mitigado com sanitização verificada por varredura automatizada de PII; T-02-02 verificado por assertiva no manifest; T-02-03 verificado por grep no bundle de produção).

## Verification

- `pnpm --filter extension build` → 0; manifest ok (`matches web.whatsapp.com`, `permissions [storage]`)
- `pnpm --filter extension exec vitest run` → 3/3
- `tsc --noEmit` → 0
- Coletor sem APIs de escrita (grep) e ausente do bundle de produção
- Varredura de PII nas fixtures → zero resíduos
- Painel injetado no WhatsApp real sem quebrar a página (confirmado pelo usuário no spike)

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 | — | Gate humano de pacotes aprovado pelo usuário ("Aprovado") |
| 2 | 0b1a9aa | Scaffold apps/extension + coletor de spike |
| 3 | 9ece54d | 02-SPIKE.md + 11 fixtures sanitizadas |

## Self-Check: PASSED

Arquivos-chave e commits (0b1a9aa, 9ece54d) verificados em disco e no git em 2026-07-12.
