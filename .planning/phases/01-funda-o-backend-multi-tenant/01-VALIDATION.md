---
phase: 1
slug: funda-o-backend-multi-tenant
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-08
updated: 2026-07-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP via `supabase test db` (CLI 2.109.1) + Vitest 4.1.10 |
| **Config file** | none — Wave 0 instala (plano 01-01 cria `apps/web/vitest.config.ts`; plano 01-03 cria `supabase/tests/`) |
| **Quick run command** | `pnpm --filter web exec vitest run` (sem Docker) |
| **Full suite command** | CI: `supabase start && supabase test db` + `pnpm --filter web exec vitest run` (Docker ausente localmente — pgTAP roda no GitHub Actions) |
| **Estimated runtime** | vitest ~10-30s local; job pgTAP ~3-5 min no CI |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web exec vitest run` (a partir do plano 01-01)
- **After every plan wave:** push + `gh run watch` do workflow `db-tests.yml` (a partir do plano 01-03)
- **Before `/gsd-verify-work`:** CI completo verde (pgTAP + vitest) — exigência literal do criterion 4
- **Max feedback latency:** ~60s local (vitest); ~5 min CI (pgTAP)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-04 | T-1-SC | Pacotes aprovados antes de instalar | checkpoint | — (blocking-human) | — | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-04 | T-1-01/02 | Sem secrets no git; TS 5.9 pinado | build + red test | `pnpm --filter web build` + skeleton.test.ts VERMELHO | ❌ W0 (esta task cria) | ⬜ pending |
| 1-02-01 | 02 | 2 | AUTH-04, LGPD-01 | T-1-03/04 | RLS em toda tabela; deny-by-default | static gates | greps estruturais na migration | ✅ | ⬜ pending |
| 1-02-02 | 02 | 2 | LGPD-01 | T-1-08 | Projeto em sa-east-1 (imutável) | integration | assert região + `vitest run tests/skeleton.test.ts` VERDE | ✅ | ⬜ pending |
| 1-03-01 | 03 | 3 | AUTH-04 | T-1-09/10 | Isolamento cross-tenant; remoção imediata | pgTAP (estático local) | greps estruturais + `supabase test db` no CI | ❌ W0 (esta task cria) | ⬜ pending |
| 1-03-02 | 03 | 3 | AUTH-04, LGPD-01 | T-1-11 | Suíte pgTAP verde no CI | CI | `gh run list --workflow=db-tests.yml ... success` | ✅ | ⬜ pending |
| 1-04-01 | 04 | 3 | AUTH-04 | T-1-13 | Gate por papel (D-07) testado puro | unit (tdd) | `vitest run tests/proxy-gate.test.ts` | ❌ W0 (esta task cria) | ⬜ pending |
| 1-04-02 | 04 | 3 | AUTH-04 | T-1-12/14 | Login sem enumeração; proxy.ts Next 16 | build + grep | `pnpm --filter web build` + greps | ✅ | ⬜ pending |
| 1-04-03 | 04 | 3 | AUTH-04 | T-1-13 | Painel lê sob RLS do usuário | unit + build | `vitest run --exclude tests/skeleton.test.ts` | ✅ | ⬜ pending |
| 1-05-01 | 05 | 4 | AUTH-05 | T-1-16 | Token 32B hasheado | unit (tdd, red) | `vitest run tests/invitations.test.ts` (VERMELHO) | ❌ W0 (esta task cria) | ⬜ pending |
| 1-05-02 | 05 | 4 | AUTH-05 | T-1-17/18/20/21 | Autorização + anti-enumeração + D-12 | integration | `vitest run tests/invitations.test.ts` (VERDE) | ✅ | ⬜ pending |
| 1-05-03 | 05 | 4 | AUTH-05 | T-1-19 | Equipe sob RLS; sem admin client na página | build + grep | build + vitest | ✅ | ⬜ pending |
| 1-06-01 | 06 | 4 | AUTH-03 | T-1-22 | Resposta única anti-enumeração | unit (tdd, red) | `vitest run tests/auth-confirm.test.ts` (VERMELHO) | ❌ W0 (esta task cria) | ⬜ pending |
| 1-06-02 | 06 | 4 | AUTH-03 | T-1-23/24 | verifyOtp + next interno (anti open-redirect) | unit | `vitest run tests/auth-confirm.test.ts` (VERDE) | ✅ | ⬜ pending |
| 1-07-01 | 07 | 5 | AUTH-05 | T-1-26/27 | Remoção imediata sem refresh; cross-org nega | integration (tdd, red) | `vitest run tests/members-admin.test.ts` (VERMELHO) | ❌ W0 (esta task cria) | ⬜ pending |
| 1-07-02 | 07 | 5 | AUTH-05 | T-1-26/29/30 | Soft-removal + revogação + audit | integration | `vitest run tests/members-admin.test.ts` (parcial verde) | ✅ | ⬜ pending |
| 1-07-03 | 07 | 5 | AUTH-05, AUTH-04 | T-1-28 | Admin só super_admin, auditado | integration | `vitest run tests/members-admin.test.ts` (VERDE) | ✅ | ⬜ pending |
| 1-08-01 | 08 | 6 | AUTH-04, LGPD-01 | T-1-31/32 | Deploy gru1; secrets fora do bundle | smoke | curl /login == 200 + greps | ✅ | ⬜ pending |
| 1-08-02 | 08 | 6 | todos | — | Fluxo completo no ar validado pelo dono | checkpoint | — (blocking human-verify) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` + `apps/web/tests/skeleton.test.ts` — plano 01-01 Task 2 (teste de esqueleto nasce VERMELHO por design)
- [ ] `supabase/tests/00-helpers.sql` + `01-cross-tenant.test.sql` + `02-roles.test.sql` + `03-removal.test.sql` + `04-rls-coverage.test.sql` — plano 01-03 Task 1
- [ ] `.github/workflows/db-tests.yml` — plano 01-03 Task 2
- [ ] `apps/web/tests/proxy-gate.test.ts` — plano 01-04 Task 1 (red antes de implementar)
- [ ] `apps/web/tests/invitations.test.ts` — plano 01-05 Task 1 (red antes da API)
- [ ] `apps/web/tests/auth-confirm.test.ts` — plano 01-06 Task 1 (red antes do handler)
- [ ] `apps/web/tests/members-admin.test.ts` — plano 01-07 Task 1 (red antes dos endpoints)
- [ ] Framework install: vitest 4.1.10 + supabase CLI 2.109.1 como devDeps pinadas — plano 01-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Região sa-east-1 + criptografia AES-256 em repouso | LGPD-01 | Propriedade da plataforma Supabase, não testável em código; região tem assert por CLI, criptografia é atestado de plataforma (Assumption A1 — confirmar interpretação com o dono) | `supabase projects list -o json` mostra sa-east-1; evidência (project-ref) registrada no SUMMARY do 01-02; docs de encryption da Supabase anexadas ao verify-work |
| Reset de senha ponta a ponta com e-mail real | AUTH-03 | Docker ausente (sem Mailpit local); orquestrar captura de e-mail automatizada excede o MVP — o handler tem teste unitário (4 comportamentos) | Pedir reset para o e-mail do gestor demo (membro do time do projeto — SMTP default entrega), abrir o link, trocar a senha, logar; passo 6 do checkpoint do 01-08 |
| Fluxo completo no ambiente deployado | AUTH-03/04/05, LGPD-01 | Validação de valor pelo dono não-técnico | Checkpoint de 7 passos no plano 01-08 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (checkpoints exceto)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (cada plano de slice cria seus testes vermelhos na Task 1)
- [x] No watch-mode flags (todos os comandos usam `vitest run`)
- [x] Feedback latency < 60s local; pgTAP autoritativo no CI (~5 min)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
