---
phase: 02-extens-o-chrome-e-leitura-do-whatsapp
plan: 03
subsystem: extension
tags: [supabase-auth, chrome-storage, shadow-dom, react, panel, ui-spec, tdd]
requires:
  - phase: 02-01
    provides: "Scaffold WXT/React/Tailwind com host Shadow DOM, mock de chrome.storage e âncora #app validada no spike"
  - phase: 02-02
    provides: "database.types.ts regenerado (profiles/app_settings/reader_status) e contrato em @copiloto/shared"
  - phase: 01
    provides: "Supabase Auth (contas e-mail/senha), RLS por organização e fluxo web /recuperar-senha"
provides:
  - "Cliente Supabase único da extensão tipado com Database, sessão em chrome.storage.local (AUTH-02/D-10)"
  - "Ciclo de sessão: restoreSession/checkProfileStatus/signOutAndClear com erros de primeira classe (D-11/Pitfall 3)"
  - "Painel completo do 02-UI-SPEC.md: 9 estados via resolveView pura, copy travada, 360/40px, colapso persistido (D-05..D-09)"
  - "setReaderInputs no PanelProvider — ponto de acoplamento para o reader (02-04) e o sync (02-06)"
affects: [02-04, 02-06, 02-07, extension, sync]
tech-stack:
  added: []
  patterns:
    - "Storage adapter chrome.storage.local com storageKey próprio (copiloto_auth) — limpeza de logout determinística"
    - "Singleton supabase lazy via Proxy — módulo importável sem env; testes injetam clients via createExtensionClient(url, key)"
    - "View do painel DERIVADA por função pura (resolveView) com precedência explícita da máquina de estados do Pitfall 2"
key-files:
  created:
    - apps/extension/entrypoints/whatsapp.content/sync/env.ts
    - apps/extension/entrypoints/whatsapp.content/sync/supabase.ts
    - apps/extension/entrypoints/whatsapp.content/sync/session.ts
    - apps/extension/entrypoints/whatsapp.content/panel/store.ts
    - apps/extension/entrypoints/whatsapp.content/panel/App.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/LoginForm.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/PanelShell.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/CollapsedTab.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/StatusBadge.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/LeadCard.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/AiTeaser.tsx
    - apps/extension/entrypoints/whatsapp.content/panel/Notices.tsx
    - apps/extension/tests/auth-storage.test.ts
  modified:
    - apps/extension/entrypoints/whatsapp.content/index.tsx
    - apps/extension/tests/setup.ts
    - apps/extension/package.json
    - pnpm-lock.yaml
key-decisions:
  - "storageKey próprio 'copiloto_auth' no cliente (em vez do sb-{ref}-auth-token default) — logout limpa uma chave conhecida"
  - "Singleton supabase exportado como Proxy lazy: módulo não exige env no import (testável) mantendo o contrato 'export supabase' do plano"
  - "postgrest-js 2.110 tem retry+backoff nativo (1s/2s/4s) em erro de rede — mantido em produção; teste de falha de rede ganhou timeout 15s"
  - "View 'removido' mantém apenas o botão de recolher (necessidade de layout); Sair/status/IA somem conforme D-11"
metrics:
  duration: "~40min"
  completed: "2026-07-12"
requirements-completed: [AUTH-01, AUTH-02, EXT-01]
status: complete
---

# Phase 02 Plan 03: Painel lateral com login e sessão persistente Summary

**Painel completo do UI-SPEC em Shadow DOM com login e-mail/senha no próprio painel (AUTH-01/D-09), sessão em chrome.storage.local via adapter testado por TDD (AUTH-02/D-10), colapso 360/40px persistido (D-06/D-07) comprimindo o WhatsApp sem sobrepor (EXT-01) e detecção de removido no boot (D-11).**

## Performance

- **Duration:** ~40min
- **Started:** 2026-07-12T20:00:24Z
- **Completed:** 2026-07-12T20:40:00Z (aprox.)
- **Tasks:** 3/3
- **Files modified:** 17

## Accomplishments

- **Ciclo de sessão (TDD, 12/12 verdes):** `chromeStorageAdapter` sobre chrome.storage.local, `createExtensionClient` tipado com `Database` de `@copiloto/shared` (persistSession/autoRefreshToken/detectSessionInUrl:false), `restoreSession` tolerante a storage vazio (supabase-js#2030), `signOutAndClear` com limpeza defensiva (funciona offline) e `checkProfileStatus` tipado active/removed/error — erro de rede NUNCA é classificado como removido (Pitfall 3).
- **Painel completo (9 estados):** `resolveView` pura com precedência boot → sessão → removido → kill_switch → quebrado → wa_desconectado → sem_conversa → grupo → conversa_ativa; toda a copy travada do Copywriting Contract verbatim (assertiva automatizada passou); tipografia só 12/14/16/20px, pesos 400/600; accent emerald apenas na lista fechada; zero APIs de injeção de HTML bruto em panel/ (T-02-10).
- **Ciclo de vida:** monta após a âncora `#app` (02-SPIKE.md; QR/loading nunca é quebra), boot restaura sessão e verifica remoção antes de exibir controles, reserva de largura 360/40px no raiz do WhatsApp (exceção documentada nº 2 do EXT-08 com comentário no ponto exato), `copiloto_panel_open` persiste o colapso (ausente = aberto, D-06), "Esqueci minha senha" abre o fluxo web da Fase 1 (`WXT_WEB_APP_URL/recuperar-senha`) sem permissão `tabs`.
- **Manifest continua mínimo:** permissions `["storage"]`, matches só `web.whatsapp.com` (verificado por assertiva pós-build).

## Task Commits

1. **Task 1 (RED): testes do adapter e ciclo de sessão** - `95e9d8a` (test)
2. **Task 1 (GREEN): cliente Supabase + ciclo de sessão** - `c52a117` (feat)
3. **Task 2: painel completo com estados e copy do UI-SPEC** - `3edfdce` (feat)
4. **Task 3: wiring do ciclo de vida no index.tsx** - `8efe167` (feat)

## Files Created/Modified

- `sync/env.ts` - `getExtensionEnv()` valida WXT_SUPABASE_URL/ANON_KEY/WEB_APP_URL em um lugar (padrão env.ts da Fase 1).
- `sync/supabase.ts` - adapter + factory `createExtensionClient` + singleton lazy `supabase` (Proxy), storageKey `copiloto_auth`.
- `sync/session.ts` - `restoreSession`, `checkProfileStatus` (ProfileCheck tipado), `signOutAndClear`.
- `panel/store.ts` - `PanelView` (9 estados), `resolveView`/`resolveMonitoring` puras, `PanelProvider`/`usePanel`, `setReaderInputs` para 02-04/02-06.
- `panel/App.tsx` + 7 componentes - todos os estados do UI-SPEC com copy travada; diálogo de confirmação do Sair.
- `index.tsx` - boot de sessão, reserva de largura (EXT-08 exceção nº 2), D-06, recuperação de senha.
- `tests/auth-storage.test.ts` - 12 testes dos 5 comportamentos do plano (rede 100% mockada).
- `tests/setup.ts` - stub inerte de WebSocket (realtime-js exige construtor; happy-dom 19 não fornece).
- `package.json`/`pnpm-lock.yaml` - `@copiloto/shared` como dependência workspace da extensão.

## Decisions Made

- **storageKey `copiloto_auth`:** chave única e conhecida em vez do default `sb-{ref}-auth-token` — `signOutAndClear` remove de forma determinística (mais varredura defensiva de chaves `sb-*` legadas).
- **Singleton via Proxy lazy:** mantém o contrato "export supabase" do plano sem exigir env no momento do import — os testes injetam url/key fake via `createExtensionClient` sem tocar o singleton.
- **Retry nativo do postgrest-js preservado:** a versão 2.110 faz retry com backoff exponencial (1s/2s/4s) em erro de rede — desejável em produção; o teste de falha de rede recebeu timeout de 15s.
- **View `removido` mantém só o recolher:** D-11 pede que os controles sumam; o botão de recolher foi mantido por necessidade de layout (sem ele o painel bloquearia a tela permanentemente). Sair, status e IA somem.
- **Copy da view `wa_desconectado` (discretion):** "WhatsApp desconectado / Conecte o WhatsApp Web neste navegador..." — estado não coberto pelo Copywriting Contract; segue o tom D-13 (direto, "você", sem culpa).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] `@copiloto/shared` adicionado como dependência workspace da extensão**
- **Found during:** Task 1 (GREEN)
- **Issue:** O plano exige `createClient<Database>` importando de `@copiloto/shared`, mas `apps/extension/package.json` não declarava a dependência — import quebrado.
- **Fix:** `"@copiloto/shared": "workspace:*"` + `pnpm install` (link interno do monorepo; nenhum pacote externo novo — T-02-SC inalterado).
- **Files modified:** apps/extension/package.json, pnpm-lock.yaml
- **Commit:** c52a117

**2. [Rule 3 - Bloqueio] Stub inerte de WebSocket no tests/setup.ts**
- **Found during:** Task 1 (GREEN)
- **Issue:** O construtor do supabase-js 2.110 (realtime-js) exige um WebSocket no runtime; happy-dom 19 não fornece — `createClient` lançava em todos os testes.
- **Fix:** stub de classe inerte injetado no setup quando `typeof WebSocket === "undefined"` (os testes nunca abrem canais realtime; no Chrome real o WebSocket nativo existe).
- **Files modified:** apps/extension/tests/setup.ts
- **Commit:** c52a117

**3. [Rule 1 - Bug no teste] Timeout de 15s no caso de falha de rede**
- **Found during:** Task 1 (GREEN)
- **Issue:** postgrest-js 2.110 faz retry com backoff (1s/2s/4s ≈ 7s) em erro de rede — o teste estourava o timeout default de 5s do vitest.
- **Fix:** timeout de 15s no teste específico, com comentário explicando o retry nativo (comportamento de produção preservado).
- **Files modified:** apps/extension/tests/auth-storage.test.ts
- **Commit:** c52a117

## Known Stubs (intencionais, contratados pelo plano)

| Stub | Arquivo | Motivo / resolução |
|------|---------|--------------------|
| `AiTeaser` desativado com badge "Em breve" | panel/AiTeaser.tsx | D-05 — teaser proposital; Fase 3/4 apenas ativa |
| Insumos do reader com default (`waConnected: true`, `activeChat: null`, kill-switch/canário false) | panel/store.ts (`DEFAULT_READER_INPUTS`) | Contrato do plano: 02-04 (reader) e 02-06 (sync/flags) alimentam via `setReaderInputs`; até lá o painel logado mostra o estado vazio |
| View `wa_desconectado` nunca ativada em runtime nesta fase | panel/store.ts / index.tsx | O painel só monta com `#app` presente; a detecção fina de conexão é âncora do reader (02-04) |

## TDD Gate Compliance

Task 1 (`tdd="true"`): RED `95e9d8a` (test, suíte falhando por módulos ausentes) → GREEN `c52a117` (feat, 12/12). Refactor não foi necessário. Tasks 2-3 não são TDD (verificação por build + assertivas de copy/manifest).

## Issues Encountered

- Arquivos alheios ao plano permanecem untracked no repo (`AGENTS.md`, `"pnpm-lock 2.yaml"`, caches de `.planning/research/.cache/`) — fora do escopo deste plano; registrados em `deferred-items.md` da fase.

## Threat Flags

Nenhuma superfície nova além do threat model do plano: T-02-08 (tokens só em chrome.storage.local — nenhum token em localStorage/DOM), T-02-09 (erro genérico de login, sem enumeração), T-02-10 (grep de injeção de HTML = 0), T-02-11 (checkProfileStatus no boot + 401 → deslogado), T-02-SC (nenhum pacote externo novo).

## Verification

- `pnpm --filter extension exec vitest run tests/auth-storage.test.ts` → 12/12 PASS
- `pnpm --filter extension exec vitest run` (suíte completa) → 15/15 PASS
- `pnpm --filter extension build` → 0; assertiva de copy travada → "copy ok"
- `grep -r dangerouslySetInnerHTML panel/ | wc -l` → 0
- Manifest pós-build: permissions `["storage"]`, matches `["*://web.whatsapp.com/*"]` (assertiva node)
- `tsc --noEmit` → 0
- PanelShell.tsx contém as constantes 360 e 40; store.ts exporta `PanelView` com os 9 estados

## Next Phase Readiness

- 02-04 (reader) alimenta `setReaderInputs({ activeChat, waConnected, readerBroken })` — o painel já renderiza grupo/lead/status.
- 02-06 (sync/flags) alimenta `killSwitchActive` e re-verifica o profile no heartbeat (D-11 contínuo) usando `checkProfileStatus`.
- Verificação humana no WhatsApp real (login com a conta da Fase 1, colapso, persistência) fica no checkpoint do 02-07 (E2E da fase).

## Self-Check: PASSED

Arquivos-chave (sync/supabase.ts, panel/store.ts, panel/App.tsx, tests/auth-storage.test.ts ≥40 linhas) e commits 95e9d8a, c52a117, 3edfdce, 8efe167 verificados em disco e no git em 2026-07-12.
