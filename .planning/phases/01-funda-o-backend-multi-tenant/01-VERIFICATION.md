---
phase: 01-funda-o-backend-multi-tenant
verified: 2026-07-11T13:50:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
warnings:
  - "16 commits locais ainda não enviados ao origin/main (HEAD 4223adf vs origin 26c3b98): o CI verde não cobre a migration 20260711020000_auth_admin_profiles_policy.sql nem o teste de regressão CR-01. Ação: git push para disparar o db-tests (baixo risco — migration aditiva já aplicada e verificada no projeto hospedado)."
  - "tests/skeleton.test.ts falha localmente com 'Invalid login credentials' — o dono trocou a senha do gestor demo no passo 6 do checkpoint (reset real). Não é regressão de código; resolve atualizando SEED_USER_PASSWORD no .env.local (documentado no 01-08-SUMMARY.md)."
  - "REQUIREMENTS.md ainda marca AUTH-03 como Pending/não concluído, mas o fluxo de reset foi implementado, testado e aprovado no checkpoint humano (passo 6). Atualizar a tabela de rastreabilidade."
  - "10 warnings do code review (01-REVIEW.md) permanecem como débito conhecido — não bloqueiam o goal da fase."
  - "Gates do beta (não da fase): ativar Resend (EMAIL_DRIVER=console até lá) e template de recovery custom (plano Free usa fluxo ?code= padrão, já suportado pelo /auth/confirm)."
---

# Fase 1: Fundação Backend Multi-Tenant — Relatório de Verificação

**Goal da fase:** Organizações, papéis e dados criptografados existem com isolamento entre tenants provado — a base sobre a qual tudo depende, com as decisões LGPD tomadas no schema, não depois
**Verificado:** 2026-07-11
**Status:** passed
**Re-verificação:** Não — verificação inicial

Nota de modo: o ROADMAP marca a fase como `mode: mvp`, mas o goal está no formato de outcome com 5 Success Criteria explícitos (não no formato User Story). A verificação seguiu o contrato dos Success Criteria do roadmap; a cobertura de fluxo de usuário foi coberta pelo roteiro de 7 passos do checkpoint humano (abaixo).

## User Flow Coverage (roteiro do checkpoint humano — APROVADO pelo dono em produção)

Ambiente real: https://copiloto-juridico.vercel.app

| # | Passo do fluxo | Evidência no código | Status |
|---|----------------|---------------------|--------|
| 1 | Login do gestor | `apps/web/app/(auth)/login/` + `proxy.ts` → `updateSession` → `decideRedirect` (getClaims/user_role) | APROVADO (dono) |
| 2 | Convite de advogado | `POST /api/invitations` → `lib/invitations/create.ts` → `sendEmail` com link `/convite/<token>` | APROVADO (dono) |
| 3 | Aceite do convite | `POST /api/invitations/accept` — valida token_hash SHA-256 + expires_at 7 dias, `admin.createUser({email_confirm:true})` | APROVADO (dono) |
| 4 | Remoção com selo | `DELETE /api/members/[userId]` — `status:'removed'` + ban 876000h + `logAudit`; `/equipe` renderiza selo "removido" | APROVADO (dono) |
| 5 | Bloqueio de advogado no painel | `decideRedirect` → `/sem-acesso` (D-07); coberto por proxy-gate.test.ts | APROVADO (dono) |
| 6 | Reset de senha (real) | `/recuperar-senha` → `/auth/confirm` (verifyOtp + fluxo ?code=) → `/nova-senha` | APROVADO (dono) |
| 7 | Admin cria organização | `POST /api/admin/organizations` — org + convite de gestor pelo mesmo fluxo (D-03) + audit_log | APROVADO (dono) |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | SC1: Gestor loga e vê só a própria org; advogado não vê dados dos colegas | VERIFIED | Dashboard lê `organizations`/`profiles` via RLS (`createClient` server, sem service_role); policies RLS por `private.current_org_id()`; pgTAP 02-roles verde em CI; checkpoint humano aprovado |
| 2 | SC2: Gestor convida por e-mail, convidado entra na org, gestor remove | VERIFIED | Rotas de convite completas (criar/reenviar/cancelar/aceitar), `/equipe` funcional; remoção soft + ban + auditoria; invitations.test.ts (10 testes) e members-admin.test.ts documentados verdes; checkpoint humano passos 2–4 |
| 3 | SC3: Qualquer usuário redefine senha via link por e-mail | VERIFIED | `/recuperar-senha` → `resetPasswordForEmail`; `/auth/confirm` com `verifyOtp(recovery)` e fluxo `?code=`; `/nova-senha` com mínimo 8; 6 testes auth-confirm PASSARAM nesta verificação; reset real aprovado no checkpoint (passo 6) |
| 4 | SC4: Testes cross-tenant (duas orgs) passam em CI | VERIFIED* | Suíte pgTAP substantiva (Org A/Org B, escrita real em conversations/messages, `is_empty` cross-tenant); GitHub API confirma runs #5–#9 do workflow db-tests todos `success` (verificado ao vivo). *Warning: CI não cobre ainda os 16 commits não pushados |
| 5 | SC5: Transcrições/análises criptografadas em repouso, região São Paulo | VERIFIED | Tabelas `conversations`/`messages`/`diagnostics` no schema com RLS e escrita provada por pgTAP; projeto Supabase `nifjhvkamwzqcfedbcww` criado em sa-east-1 (README linhas 13/26/35, 01-02-SUMMARY; região imutável pós-criação); criptografia AES-256 da plataforma Supabase (Assumption A1) |
| 6 | D-07: Advogado no painel é redirecionado para aviso pt-BR | VERIFIED | `decideRedirect` + `/sem-acesso`; 8 testes proxy-gate PASSARAM nesta verificação |
| 7 | D-11: Removido perde acesso na consulta seguinte, sem refresh de token | VERIFIED | Helpers `security definer` filtram `status = 'active'` no nível do banco; pgTAP 03-removal.test.sql exercita a transição (verde em CI); ban via `updateUserById` bloqueia refresh |
| 8 | D-12: Reconvite reativa conta removida com o mesmo user_id | VERIFIED | `accept/route.ts` linhas 55–86: detecta profile `removed`, `updateUserById` + reativação preservando user_id; teste D-12 documentado em invitations.test.ts |
| 9 | Anti-enumeração no pedido de reset | VERIFIED | `request-form.tsx` linha 8: resposta única "Se o e-mail existir, enviamos um link..." independente da existência da conta |
| 10 | Nenhuma tabela public sem RLS | VERIFIED | Migration habilita RLS nas 7 tabelas; pgTAP 04-rls-coverage é gate estrutural (falha se qualquer tabela public estiver sem rowsecurity) — verde em CI |
| 11 | Deploy no ar em gru1 apontando para Supabase sa-east-1 | VERIFIED | `vercel.json` regions gru1; probes ao vivo nesta verificação: /login 200, / 307→login (gate funciona sem sessão), /recuperar-senha 200 |
| 12 | CR-01 e CR-02 corrigidos | VERIFIED | CR-01: `safeNextPath` rejeita `\\` e `//` + teste de regressão "blocks backslash-based open redirect" (passou nesta verificação); CR-02: `enable_signup = false` em config.toml (3 ocorrências), aplicado no hospedado conforme 01-REVIEW/contexto de execução |

**Score:** 12/12 truths verificados (0 presentes-sem-prova-comportamental)

### Required Artifacts

| Artefato | Fornece | Status | Detalhes |
|----------|---------|--------|----------|
| `pnpm-workspace.yaml`, `apps/web/package.json` | Monorepo pnpm + Next 16.2 | VERIFIED | verify.artifacts 01-01: 4/4 |
| `supabase/migrations/20260710012345_initial_schema.sql` | 7 tabelas, enums, helpers security definer, policies RLS, custom_access_token_hook | VERIFIED | 292 linhas; RLS habilitado nas 7 tabelas; hook com grant só para supabase_auth_admin |
| `supabase/migrations/20260710183300_...` e `20260711020000_...` | Grants domain + policy SELECT p/ supabase_auth_admin | VERIFIED | Correções descobertas em 01-03 e 01-08 |
| `supabase/config.toml` | Hook habilitado, otp_expiry 3600, senha mín. 8, signup OFF, redirect URLs Vercel | VERIFIED | Linhas 159–293 conferidas |
| `scripts/seed.ts`, `packages/shared/src/database.types.ts` | Seed idempotente + tipos gerados | VERIFIED | 162 e 447 linhas |
| `supabase/tests/01..04 + helpers/00-helpers.inc` | Suíte pgTAP cross-tenant/papéis/remoção/cobertura RLS | VERIFIED | Helper movido para `helpers/00-helpers.inc` (incluído via `\i` — desvio documentado no 01-03-SUMMARY, não é gap) |
| `.github/workflows/db-tests.yml` | CI: supabase start + supabase test db + vitest | VERIFIED | Runs #5–#9 success (GitHub API) |
| `apps/web/proxy.ts`, `lib/supabase/{server,client,admin,proxy-session}.ts` | Sessão Next 16 (proxy.ts, sem middleware.ts) + gate por papel | VERIFIED | service_role isolado em admin.ts |
| Login, dashboard, `/sem-acesso`, `/equipe`, `/admin`, rotas de convite/membros/admin | Fluxos do walking skeleton | VERIFIED | verify.artifacts 01-04..01-07: todos 100% |
| `apps/web/app/auth/confirm/route.ts` + páginas de reset | AUTH-03 | VERIFIED | verifyOtp + exchangeCodeForSession + safeNextPath (CR-01) |
| `apps/web/lib/audit.ts` | Trilha audit_log via service_role | VERIFIED | Importado e chamado em members e admin/organizations |
| `vercel.json`, `README.md` | Deploy gru1 + doc de redeploy | VERIFIED | URL viva (probes 200/307) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `proxy.ts` | `proxy-session.ts` | `updateSession` | WIRED |
| `proxy-session.ts` | claims do hook (01-02) | `getClaims()` → `app_metadata.user_role` | WIRED |
| `(dashboard)/page.tsx` | Supabase RLS | `.from("organizations")` + `.from("profiles")` sob JWT — falso-negativo do tool (regex com aspas simples) | WIRED |
| `api/invitations/*` | `lib/email/index.ts` | `create.ts` → `sendEmail` com link `/convite/<token>` | WIRED |
| `api/invitations/accept` | auth.admin (service_role) | `createUser({email_confirm:true})` OU `updateUserById` (reativação D-12) | WIRED |
| `api/members/[userId]` | GoTrue Admin API | `updateUserById({ban_duration})` + status removed | WIRED |
| `api/admin/organizations` | `public.audit_log` | `logAudit()` (lib/audit.ts) — falso-negativo do tool (padrão indireto) | WIRED |
| `api/admin/organizations` | `public.invitations` | mesmo fluxo de convite do 01-05 (D-03) | WIRED |
| `db-tests.yml` | `supabase/tests/` | `supabase test db` | WIRED |
| testes pgTAP | `helpers/00-helpers.inc` | `\i helpers/00-helpers.inc` (create_supabase_user / authenticate_as) | WIRED |
| `config.toml` | URL do deploy | site_url + additional_redirect_urls incluem copiloto-juridico.vercel.app/auth/confirm | WIRED |
| Vercel | Supabase sa-east-1 | env vars no projeto Vercel — não verificável por grep; provado indiretamente pelos probes vivos (login 200 renderiza, checkpoint aprovado) | WIRED |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Confirm de recovery + regressão CR-01 + gate de papéis | `vitest run tests/auth-confirm.test.ts tests/proxy-gate.test.ts` | 14/14 testes passaram (241ms) | PASS |
| Suíte pgTAP em CI | GitHub API run 29115308883 + runs #6–#9 | todos `completed/success` | PASS |
| Deploy vivo | `curl` /login, /, /recuperar-senha | 200, 307 (gate), 200 | PASS |
| Testes de integração (invitations, members-admin) | não executados nesta verificação | mutam estado no Supabase hospedado (criam usuários) — proibido pelo contrato de verificação; verdes conforme 01-05/01-07 SUMMARY + checkpoint humano | SKIP (justificado) |
| skeleton.test.ts | não executado | vermelho local conhecido (senha do gestor demo trocada pelo dono no passo 6) — documentado, não é regressão | SKIP (documentado) |

### Requirements Coverage

| Requirement | Plano(s) | Descrição | Status | Evidência |
|-------------|----------|-----------|--------|-----------|
| AUTH-03 | 01-06 | Reset de senha via link por e-mail | SATISFIED | Fluxo completo + 6 testes unitários + reset real aprovado no checkpoint. Obs.: REQUIREMENTS.md ainda marca "Pending" — atualizar (warning) |
| AUTH-04 | 01-01/02/03/04/07/08 | Login gestor; papéis separados | SATISFIED | Login + gate D-07 + RLS + pgTAP 02-roles verde |
| AUTH-05 | 01-05/07 | Convidar e remover advogados | SATISFIED | Convites ponta a ponta + remoção com revogação + selo |
| LGPD-01 | 01-02/03/08 | Criptografia em repouso, região SP | SATISFIED | sa-east-1 + AES-256 plataforma + escrita provada por pgTAP |

Sem requirements órfãos: REQUIREMENTS.md mapeia exatamente AUTH-03/04/05 e LGPD-01 para a Phase 1, todos reivindicados pelos planos.

### Anti-Patterns Found

| Arquivo | Padrão | Severidade | Impacto |
|---------|--------|-----------|---------|
| — | Nenhum TBD/FIXME/XXX/TODO/HACK/placeholder em apps/web, scripts, migrations ou packages/shared | — | — |

### Human Verification Required

Nenhum item pendente. O checkpoint humano da fase (plano 01-08 Task 2) foi executado e APROVADO pelo dono: roteiro de 7 passos completo no ambiente real, cobrindo exatamente os comportamentos que grep não vê (e-mail real de reset, aceite de convite, revogação imediata na prática).

### Gaps Summary

Nenhum gap bloqueante. O goal da fase está alcançado no código e provado por três camadas independentes: (1) pgTAP cross-tenant verde em CI com duas organizações e escrita real, (2) testes unitários/integração no app, (3) checkpoint humano aprovado em produção.

Pendências não-bloqueantes (ver `warnings` no frontmatter): push dos 16 commits locais para o CI validar a última migration e o teste de regressão CR-01; atualizar SEED_USER_PASSWORD local; marcar AUTH-03 como Complete no REQUIREMENTS.md; débito dos 10 warnings do 01-REVIEW.md; gates do beta (Resend + template de recovery).

---

_Verificado: 2026-07-11_
_Verifier: Claude (gsd-verifier)_
