---
phase: 2
slug: extens-o-chrome-e-leitura-do-whatsapp
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Preenchido a partir dos planos 02-01 a 02-07 (arquivos de teste e comandos reais dos `<verify>`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + happy-dom (apps/extension) · Vitest (apps/web, integração env-gated contra o Supabase hospedado) · pgTAP via `supabase test db` (CI — sem Docker local, mesma limitação da Fase 1) |
| **Config file** | `apps/extension/vitest.config.ts` — criado no plano 02-01 Task 2 (Wave 1); `apps/web/vitest.config.ts` já existe (Fase 1) |
| **Quick run command** | `pnpm --filter extension exec vitest run` |
| **Full suite command** | `pnpm --filter extension exec vitest run && pnpm --filter web exec vitest run` (local) + workflows `db-tests.yml` (pgTAP 05/06) e `extension-ci.yml` no GitHub Actions |
| **Estimated runtime** | ~15s (extensão) · ~60s (web, integração hospedada) · ~3 min (pgTAP no CI) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter extension exec vitest run` (ou `pnpm --filter web exec vitest run <arquivo>` quando a task tocar apps/web)
- **After every plan wave:** Run `pnpm --filter extension exec vitest run && pnpm --filter web exec vitest run`; quando a wave tocar SQL, confirmar `db-tests.yml` verde no CI
- **Before `/gsd-verify-work`:** Suíte completa verde (local + CI) e checklist manual do 02-07 Task 2 aprovado
- **Max feedback latency:** 60 seconds (loop local; pgTAP fica no CI por falta de Docker)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | supply chain | T-02-SC | Só pacotes auditados/pinados entram no bundle | checkpoint humano (blocking-human) | — manual (ver Manual-Only) | — | ⬜ pending |
| 02-01-02 | 01 | 1 | EXT-01 (base) | T-02-02 | Manifest mínimo: só `storage` + web.whatsapp.com | build + unit + assert | `pnpm --filter extension build && pnpm --filter extension exec vitest run` + assert node do manifest | ❌ W0 (a própria task cria vitest.config/setup/smoke) | ⬜ pending |
| 02-01-03 | 01 | 1 | EXT-03 (pré-req) | T-02-01 | Fixtures sanitizadas antes do git | checkpoint humano (spike) | — manual (ver Manual-Only) | — | ⬜ pending |
| 02-02-01 | 02 | 1 | EXT-04, EXT-05 | T-02-05, T-02-07 | Unique indexes de dedup + RLS nas tabelas novas | assert estático | `node -e` assert de conteúdo da migration (wa_message_id, indexes, policies, seed) | ✅ (assert inline) | ⬜ pending |
| 02-02-02 | 02 | 1 | EXT-04 | — | Schema vivo = migrations | integração CLI + assert | `supabase migration list --linked \| grep 20260712000000` + assert node dos tipos regenerados | ✅ (assert inline) | ⬜ pending |
| 02-02-03 | 02 | 1 | EXT-04, EXT-05 | T-02-04, T-02-05, T-02-07 | Dedup por constraint; kill-switch só super-admin; heartbeat só a própria linha | pgTAP + integração | `pnpm --filter web exec vitest run tests/extension-schema.test.ts` + `supabase test db` no CI (05-extension-sync.test.sql, 06-app-settings.test.sql) | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AUTH-01, AUTH-02 | T-02-08 | Sessão em chrome.storage.local, inacessível à página | unit (TDD) | `pnpm --filter extension exec vitest run tests/auth-storage.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | EXT-01 | T-02-10 | Painel só renderiza texto (proibição de HTML bruto verificada) | build + assert copy | `pnpm --filter extension build` + assert node da copy travada + grep dangerouslySetInnerHTML = 0 | ✅ (assert inline) | ⬜ pending |
| 02-03-03 | 03 | 2 | EXT-01, AUTH-02 | T-02-11 | Removido → view `removido`; controles somem (D-11) | build + suíte | `pnpm --filter extension build && pnpm --filter extension exec vitest run` | ✅ (reusa suíte) | ⬜ pending |
| 02-04-01 | 04 | 2 | EXT-03 | T-02-15 | Fixtures revisadas (sanitização) antes do uso | unit RED (deve falhar) | `pnpm --filter extension exec vitest run tests/extract.test.ts tests/canary.test.ts` sai NÃO-zero | ❌ W0 (a task cria) | ⬜ pending |
| 02-04-02 | 04 | 2 | EXT-03 | T-02-12, T-02-14 | Extração só textContent/getAttribute; exceção vira verdict do canário | unit GREEN | `pnpm --filter extension exec vitest run tests/extract.test.ts tests/canary.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-03 | 04 | 2 | EXT-08 | T-02-13 | Gate estático proíbe escrita/eventos/scroll em reader/ e sync/ | teste estático + CI | `pnpm --filter extension exec vitest run tests/read-only-gate.test.ts` + assert node do extension-ci.yml | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | EXT-05 | T-02-16, T-02-17 | 403 para não super-admin; toda mutação auditada | integração (TDD) | `pnpm --filter web exec vitest run tests/admin-settings.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 2 | EXT-05 | T-02-18 | Guarda dupla do /admin intacta; details só metadados | build + assert | `pnpm --filter web build` + assert node da página admin | ✅ (assert inline) | ⬜ pending |
| 02-06-01 | 06 | 3 | EXT-02, EXT-07 | T-02-23 | Observers estreitos + debounce + idle; D-04 não pausa leitura | unit (TDD) + gate | `pnpm --filter extension exec vitest run tests/state.test.ts` + `vitest run tests/read-only-gate.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 3 | EXT-04 | T-02-22 | Zod no boundary DOM→sync; logs sem conteúdo de mensagem | unit (TDD) + gate | `pnpm --filter extension exec vitest run tests/queue.test.ts` + `vitest run tests/read-only-gate.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-03 | 06 | 3 | EXT-05 | T-02-20, T-02-21 | 401→removido para a leitura; details do heartbeat só metadados | unit (TDD) + build | `pnpm --filter extension exec vitest run && pnpm --filter extension build` | ❌ W0 (tests/flags.test.ts) | ⬜ pending |
| 02-07-01 | 07 | 4 | D-12 | T-02-25 | Bundle sem coletor de spike; manifest mínimo auditado | build + assert release | `pnpm --filter extension build && pnpm --filter extension zip` + assert node (manifest, zip, README, grep __copilotoSpike = 0) | ✅ (assert inline) | ⬜ pending |
| 02-07-02 | 07 | 4 | todos os success criteria | — | — | checkpoint humano | — manual (ver Manual-Only) | — | ⬜ pending |
| 02-07-03 | 07 | 4 | D-12 | T-02-26 | Declaração honesta de coleta na ficha da CWS | checkpoint humano (human-action) | — manual (ver Manual-Only) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Nesta fase o scaffolding de teste é criado dentro dos próprios planos (as fixtures dependem do spike humano e não podem precedê-lo):

- [ ] `apps/extension/vitest.config.ts` + `apps/extension/tests/setup.ts` (mock de chrome.storage.local) + `tests/smoke.test.ts` — criados no **02-01 Task 2**
- [ ] `apps/extension/tests/fixtures/*.html` — capturadas e sanitizadas no spike (**02-01 Task 3**): msg-in-text, msg-out-text, msg-audio, msg-image, msg-document, msg-group, header
- [ ] `supabase/tests/05-extension-sync.test.sql` — dedup + RLS do sync (EXT-04) — **02-02 Task 3**
- [ ] `supabase/tests/06-app-settings.test.sql` — RLS do kill-switch e do reader_status (EXT-05) — **02-02 Task 3**
- [ ] `apps/extension/tests/read-only-gate.test.ts` — gate somente-leitura (EXT-08) como teste vitest (substitui a regra ESLint sugerida na pesquisa; o repo não tem ESLint — decisão documentada no 02-04 Task 3) — **02-04 Task 3**
- [ ] `.github/workflows/extension-ci.yml` — vitest (inclui o gate) + build a cada push/PR — **02-04 Task 3**
- [ ] Framework install: `vitest` + `happy-dom` pinados no scaffold do **02-01 Task 2** (após aprovação do checkpoint de pacotes)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aprovação da auditoria de pacotes npm | supply chain (T-02-SC) | Gate de legitimidade nunca é auto-aprovável | 02-01 Task 1 — conferir tabela de 10 pacotes e responder "aprovado" |
| Âncoras reais do DOM + captura de fixtures + teste CORS A5 | EXT-03 (pré-req) | WhatsApp Web exige login por QR — impossível em CI | 02-01 Task 3 — roteiro de 7 passos com `__copilotoSpike()`; resultado vira 02-SPIKE.md |
| Painel monta/comprime sem sobrepor; reage à troca de conversa | EXT-01, EXT-02 | Exige WhatsApp logado com conversas reais | 02-07 Task 2, blocos 2 e 3 |
| Sessão sobrevive a restart real do Chrome | AUTH-02, D-10 | Restart do navegador não é simulável na suíte | 02-07 Task 2, bloco 1 |
| Sem long tasks >50ms durante digitação | EXT-07 | Profiling exige página viva (DevTools Performance) | 02-01 Task 3 passo 7 (linha de base) + 02-07 Task 2 bloco 5 |
| Kill-switch acionado no /admin pausa e retoma a leitura de ponta a ponta | EXT-05, D-13/D-14/D-15 | Ciclo completo cruza admin web + extensão + WhatsApp real | 02-07 Task 2, bloco 4 |
| Advogado removido vê aviso e a leitura para | D-11 | Exige remoção real de membro e observação do painel | 02-07 Task 2, bloco 6 |
| Submissão unlisted na Chrome Web Store | D-12 | Conta de desenvolvedor + pagamento + ficha: sem CLI/API na primeira publicação | 02-07 Task 3 — 6 passos do Developer Console |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — as 5 exceções são checkpoints humanos legítimos (listados em Manual-Only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (pior caso: 02-07 Tasks 2-3, dois checkpoints finais consecutivos)
- [x] Wave 0 covers all MISSING references — todo arquivo ❌ W0 do mapa tem task criadora identificada acima
- [x] No watch-mode flags — todos os comandos usam `vitest run`
- [x] Feedback latency < 60s (loop local; pgTAP delegado ao CI por falta de Docker, mesma limitação aceita na Fase 1)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-12
