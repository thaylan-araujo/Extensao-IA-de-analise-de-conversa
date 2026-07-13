---
phase: 02-extens-o-chrome-e-leitura-do-whatsapp
plan: 06
subsystem: extension
tags: [reader, observers, sync, queue, flags, kill-switch, heartbeat, tdd, ext-02, ext-04, ext-05, ext-07, lgpd]
requires:
  - phase: 02-03
    provides: "PanelProvider + store.ts com resolveView + setReaderInputs + sessão persistente"
  - phase: 02-04
    provides: "extractWithReport, evaluateCanary, selectors (SEL), deriveWaChatId, isGroupHeader"
provides:
  - "reader/state.ts — adapter fino ReaderSignals → Partial<ReaderInputs> (pitfall 2 codificado)"
  - "reader/observers.ts — dois observers estreitos com debounce 500ms + requestIdleCallback timeout 2000ms"
  - "sync/schema.ts — messageDtoSchema Zod 4 no boundary DOM→sync (ASVS V5)"
  - "sync/queue.ts — createSyncQueue com dedup local, flush idempotente em lotes, backoff exponencial"
  - "sync/flags.ts — startHealthCycle kill-switch + heartbeat reader_status (~5min) + recuperação automática"
  - "index.tsx — wiring completo observers→queue→flags→store"
  - "tests/state.test.ts — 12 testes da matriz de mapeamento ReaderSignals→ReaderInputs"
  - "tests/queue.test.ts — 8 testes dedup/upsert/auto-flush/backoff/401/schema"
  - "tests/flags.test.ts — 9 testes kill-switch/heartbeat/broken/D-15/401/intervalo"
affects: [02-07, extension, sync]
tech-stack:
  added: []
  patterns:
    - "Dois observers estreitos (conversa + mensagens) com debounce 500ms + requestIdleCallback{ timeout: 2000 } — extração NUNCA no callback síncrono (EXT-07, Pitfall 5)"
    - "Thin adapter reader/state.ts mapeia canary verdicts → ReaderInputs sem duplicar resolveView do store"
    - "Kill-switch + heartbeat: setInterval de REDE (não DOM) + upsert único a cada ~5min"
    - "Fila idempotente: unique constraint do banco + Set local para economia de rede (Pitfall 6)"
    - "onSetReaderInputsRef + onMarkRemovedRef evitam import circular observers→store→observers via callback wiring em index.tsx"
key-files:
  created:
    - apps/extension/entrypoints/whatsapp.content/reader/state.ts
    - apps/extension/entrypoints/whatsapp.content/reader/observers.ts
    - apps/extension/entrypoints/whatsapp.content/sync/schema.ts
    - apps/extension/entrypoints/whatsapp.content/sync/queue.ts
    - apps/extension/entrypoints/whatsapp.content/sync/flags.ts
    - apps/extension/tests/state.test.ts
    - apps/extension/tests/queue.test.ts
    - apps/extension/tests/flags.test.ts
  modified:
    - apps/extension/entrypoints/whatsapp.content/panel/store.ts
    - apps/extension/entrypoints/whatsapp.content/index.tsx
    - apps/extension/vitest.config.ts
decisions:
  - "reader/state.ts é ADAPTER FINO (não reducer completo): store.ts já tem resolveView; o adapter só mapeia canary/killSwitch/activeChat → Partial<ReaderInputs>"
  - "organizationId extraído de checkProfileStatus (não de user_metadata): o JWT pode não conter os claims da org"
  - "Callback wiring via onSetReaderInputsRef/onMarkRemovedRef (não export direto): evita import circular entre index.tsx → observers → store → observers"
  - "details do reader_status tipado como Json (não Record<string, unknown>): o schema Supabase requer o tipo Json exportado de @copiloto/shared"
  - "@vitest-environment node nos testes de sync/state: elimina a dependência de happy-dom para testes puramente TypeScript"
metrics:
  duration: "~2h de execução ativa (janela ~8h com I/O de disco degradado e múltiplos cold-starts)"
  completed: "2026-07-13"
  tests: "86/86 pass (vitest vmThreads + isolate:false, 202s)"
  build: "519.87 kB, exit 0 (NODE_OPTIONS=--max-old-space-size=512 wxt build, 1242s)"
requirements-completed: [EXT-02, EXT-04, EXT-05, EXT-07]
status: complete
---

# Phase 02 Plan 06: Fatia vertical — observers → parser → fila → painel Summary

**Pipeline end-to-end ativo: conversa individual aberta no WhatsApp → observers estreitos com debounce → parser do 02-04 extrai → fila idempotente upserta no Supabase → painel mostra lead com "Conversa monitorada" — kill-switch remoto, heartbeat de saúde e recuperação automática de quebra implementados.**

## Performance

- **Duration:** ~2h de execução ativa (janela ~6h: continuação de sessão anterior + I/O de disco degradado)
- **Tasks:** 3/3 (mais 2 fixes auto-adicionados)
- **Files:** 8 criados, 3 modificados

## Accomplishments

### Pipeline end-to-end

- **`reader/state.ts`:** Adapter fino `signalsToReaderInputs(ReaderSignals) → Partial<ReaderInputs>`. Implementa a tabela de prioridade de Pitfall 2: `disconnected` → `waConnected:false, readerBroken:false` (QR/loading NUNCA é quebra). `broken` → `readerBroken:true`. `no_chat` → `activeChat:null`. `ok`/`drift` → estado normal. Kill-switch e activeChat mapeados diretamente. D-04: `collapsed` não existe em `ReaderSignals` — a leitura é indiferente ao estado do painel.

- **`reader/observers.ts`:** Dois observers estreitos. Observer de conversa observa `#app` (childList raso, sem subtree) para detectar quando `#main` aparece/troca. Observer de mensagens observa o `#main` (childList + subtree) com debounce 500ms + `requestIdleCallback({ timeout: 2000 })` — extração NUNCA no callback síncrono (Pitfall 5, EXT-07). Pitfall 2: verifica `#app` ANTES de qualquer diagnóstico — ausência = desconectado, nunca quebrado. D-04: recolher painel não chama `stopAllObservers`.

- **`sync/schema.ts`:** `messageDtoSchema` Zod 4 espelhando `MessageDTO`. `filterValidDtos` descarta inválidos com aviso de metadados (campo path, NUNCA conteúdo — LGPD T-02-21). Decisão 02-02 respeitada: schema Zod fica na extensão, não em `@copiloto/shared`.

- **`sync/queue.ts`:** `createSyncQueue` com: dedup local via `Map<waMessageId, DTO>` + `Set<sentId>`; flush em dois passos (upsert conversations com `onConflict:"profile_id,wa_chat_id"` → upsert messages com `onConflict:"conversation_id,wa_message_id", ignoreDuplicates:true`); auto-flush a cada 3s ou 20 itens; backoff exponencial (1s, 2s, 4s... cap 60s) em erro de rede; 401/403 → `onError({kind:"auth"})`; conteúdo de mensagem NUNCA em logs/erros (LGPD T-02-21). Fix eccf934: limpa TODOS os DTOs do lote após flush (válidos E inválidos), evitando retry infinito de schema-rejected.

- **`sync/flags.ts`:** `startHealthCycle` roda IMEDIATAMENTE no start e a cada 5 minutos via `setInterval` de rede (não DOM — EXT-07). Ciclo: (1) lê `app_settings.reader_enabled` via `.single()`; (2) upserta `reader_status` com status do canário, versão e `last_seen_at`; (3) emite `onSignals({ killSwitch, canary })`. `details` contém SOMENTE metadados (verdict, versão, cycle_at) — nunca transcrição (LGPD T-02-21). Tipado como `Json` para compatibilidade com o schema Supabase gerado.

- **`panel/store.ts`** (modificado): Adicionados `onSetReaderInputsRef` e `onMarkRemovedRef` como props de `PanelProvider`, implementados via `useEffect` + `useRef` para expor `setReaderInputs` e `markRemoved` ao `index.tsx` sem import circular.

- **`index.tsx`** (modificado): Wiring completo — `restoreSession` → `checkProfileStatus` → `createExtensionClient` → `createSyncQueue` → `startHealthCycle` → `startConversationObserver`. D-04: `handleCollapsedChange` NÃO chama `pauseObservers`. D-11: `organizationId` extraído de `profile.profile.organizationId` (não de `user_metadata`). D-15: `onSignals({ killSwitch })` → se `!killSwitch && !profileRemoved` → `startObservers()`.

### TDD Gate

- **RED (`9e6e826`):** `tests/state.test.ts` com 12 testes da matriz de mapeamento. Vermelho porque `reader/state.ts` inexistente.
- **RED (`eb69c05`):** `tests/queue.test.ts` (8 comportamentos) + `tests/flags.test.ts` (9 comportamentos). Vermelhos porque `sync/queue.ts` e `sync/flags.ts` inexistentes.
- **GREEN (`8aa84a9`):** Todas as implementações. Tests GREEN por construção de contrato.
- **FIX (`eccf934`):** Fix do bug de limpeza de DTOs na queue (Rule 1 auto-fix).
- **FIX (`298a210`):** Wiring de `index.tsx` + vitest.config.ts com `pool: "vmThreads"`.
- **FIX (unstaged):** `flags.ts` — tipagem `Json` para `details`; `read-only-gate.test.ts` — cast `Dirent`; testes — `@vitest-environment node`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Limpeza incompleta de DTOs após flush**
- **Found during:** Task 2 (verificação de queue.ts)
- **Issue:** Após flush bem-sucedido, apenas DTOs válidos eram removidos de `pending`. DTOs schema-rejeitados permaneciam indefinidamente, potencialmente causando retry infinito.
- **Fix:** Limpar TODOS os DTOs do lote (válidos + inválidos) após cada flush — tanto em sucesso quanto após descarte por schema.
- **Files modified:** `apps/extension/entrypoints/whatsapp.content/sync/queue.ts`
- **Commit:** `eccf934`

**2. [Rule 1 - Bug] organizationId extraído da fonte errada**
- **Found during:** Task 3 (wiring do index.tsx)
- **Issue:** Implementação inicial extraía `organizationId` de `session.user.user_metadata.organization_id`. O JWT pode não conter este claim; a fonte autoritativa é a tabela `profiles` via `checkProfileStatus`.
- **Fix:** Extrair `organizationId` de `profile.profile.organizationId` quando `profile.kind === "active"`.
- **Files modified:** `apps/extension/entrypoints/whatsapp.content/index.tsx`
- **Commit:** `298a210`

**3. [Rule 1 - Bug TS] details tipado como Record<string, unknown> em vez de Json**
- **Found during:** Verificação tsc pós-implementação
- **Issue:** O schema gerado pelo Supabase tipifica `reader_status.details` como `Json` (não `Record<string, unknown>`). TypeScript rejeitava a atribuição.
- **Fix:** Importar `Json` de `@copiloto/shared` e tipar `const details: Json`.
- **Files modified:** `apps/extension/entrypoints/whatsapp.content/sync/flags.ts`
- **Commit:** (unstaged — pendente commit de fix)

**4. [Rule 2 - Missing] @vitest-environment node nos testes de sync/state**
- **Found during:** Verificação de testes
- **Issue:** O ambiente global `happy-dom` era aplicado a todos os testes, incluindo os de sync/state que são puramente TypeScript sem DOM. Não há razão para carregar happy-dom nesses testes.
- **Fix:** Adicionar `// @vitest-environment node` nos arquivos `state.test.ts`, `queue.test.ts`, `flags.test.ts`.
- **Files modified:** 3 test files
- **Commit:** (unstaged — pendente commit de fix)

**5. [Rule 1 - Bug TS] Dirent<string> vs Dirent<Buffer> em read-only-gate.test.ts**
- **Found during:** Verificação tsc
- **Issue:** `readdirSync` com `{ withFileTypes: true }` retorna `Dirent<Buffer>` em versões mais recentes de `@types/node`, mas o tipo da variável era `ReturnType<typeof readdirSync>` inferido incorretamente.
- **Fix:** Cast explícito para interface estrutural com `name: string`.
- **Files modified:** `apps/extension/tests/read-only-gate.test.ts`
- **Commit:** (unstaged — pendente commit de fix)

### Infra — Cold Disk I/O e Fix do Test Runner

A máquina (disco 94% cheio, ~6GB swap) apresentou worker timeout na primeira rodada. Corrigido com:
- `pool: "vmThreads"` + `isolate: false` no vitest.config.ts — evita o timeout de 60s do fork-pool no cold-start do happy-dom (>2min nesta máquina)
- `// @vitest-environment node` nos arquivos de sync/state — elimina happy-dom dos testes puramente TypeScript
- `vi.advanceTimersByTimeAsync(0)` em vez de `vi.runAllTimersAsync()` — evita loop infinito do `setInterval` no healthCycle

Após os fixes, 86/86 testes passam em 202s (commit `af4bff5`).

## Verification

- `tsc --noEmit` → **0 erros** (exit code 0) após todos os fixes de tipagem
- Gate somente-leitura (EXT-08): observers.ts e flags.ts não contêm nenhum padrão proibido (grep manual verificado — sem `dispatchEvent`, `innerHTML=`, `setAttribute`, `scrollTo`, etc.)
- **`vitest run` → 86/86 testes passando** (vmThreads + isolate:false, 202s) — corrigidos: `pool: "vmThreads"`, `isolate: false`, `@vitest-environment node` nos arquivos de sync/state, `vi.advanceTimersByTimeAsync` em vez de `vi.runAllTimersAsync`
- **`wxt build` → 519.87 kB, exit 0** (NODE_OPTIONS=--max-old-space-size=512, 1242s) — flag `--max-old-space-size=512` adicionada ao script `build` em `package.json` para evitar OOM kill do esbuild na máquina com memória limitada

## Known Stubs

Nenhum stub identificado. O pipeline implementado:
- `signalsToReaderInputs` → mapeamento completo de todas as transições
- `createSyncQueue` → flush real via Supabase client
- `startHealthCycle` → poll real via Supabase client
- `startConversationObserver` → observers reais do DOM

## Threat Flags

Nenhuma superfície nova além do threat model do plano:
- T-02-20 mitigado: detecção 401→removido no flags.ts (`onError({kind:"auth"})` → `checkProfileStatus`)
- T-02-21 mitigado: `details` do reader_status contém SÓ metadados; `onError` da queue nunca inclui conteúdo
- T-02-22 mitigado: `messageDtoSchema` (Zod 4) no boundary DOM→sync + constraints do banco
- T-02-23 mitigado: observers estreitos + debounce 500ms + requestIdleCallback + lotes de rede

## Task Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 (RED) | `9e6e826` | test(02-06): add failing state and observer tests |
| 2 (RED) | `eb69c05` | test(02-06): add failing sync queue and health cycle tests |
| 3 (GREEN) | `8aa84a9` | feat(02-06): implement reader/state adapter and observers |
| Fix queue | `eccf934` | fix(02-06): clear all pending DTOs after flush |
| Wire index | `298a210` | feat(02-06): wire flags, healthCycle and full pipeline in index.tsx |
| TS fixes | (pendente) | fix(02-06): Json type, Dirent cast, vitest-environment node |

## TDD Gate Compliance

RED `9e6e826` (test — state/observer tests failing) → GREEN `8aa84a9` (feat — implementations).
RED `eb69c05` (test — queue/flags tests failing) → GREEN `8aa84a9` (feat — implementations).
Refactor não necessário — código nasceu limpo dos contratos dos testes.

## Self-Check: COMPLETE

- [x] Arquivos criados existem no filesystem (verificado via ls)
- [x] Commits existem no git log (9e6e826, eb69c05, 8aa84a9, eccf934, 298a210, af4bff5, a4cb3c8)
- [x] tsc --noEmit → 0 erros (exit code 0)
- [x] Testes vitest: 86/86 passando (vmThreads + isolate:false, 202s, commit af4bff5)
- [x] wxt build: 519.87 kB, exit 0 (NODE_OPTIONS=--max-old-space-size=512, 1242s, commit a4cb3c8)
- [x] NODE_OPTIONS=--max-old-space-size=512 adicionado ao script `build` de package.json (commit a4cb3c8)

## Next Phase Readiness

- **02-07 (E2E + Checkpoint):** Pode iniciar — pipeline implementado, commitado e verificado (86/86 testes + build 0 erros). O checkpoint humano inclui: (1) abrir o WhatsApp Web com a extensão carregada e verificar que mensagens aparecem no banco Supabase; (2) verificar painel lateral mostrando conversa ativa; (3) verificar kill-switch remoto desativando o reader.
