---
phase: 01-funda-o-backend-multi-tenant
plan: 07
subsystem: auth
tags: [supabase, rls, admin-api, audit-log, multi-tenant, next-16]
requires:
  - 01-02 (schema multi-tenant + audit_log + RLS)
  - 01-05 (mecânica de convites e aceite com reativação D-12)
provides:
  - "DELETE /api/members/[userId]: soft-removal com revogação de sessão e auditoria"
  - "POST|GET /api/admin/organizations: provisioning de escritórios pelo super-admin"
  - "/admin: interface mínima da Elite Juris (D-02)"
  - "logAudit(): trilha de auditoria via service_role"
affects:
  - apps/web/app/(dashboard)/equipe (ações de remoção)
  - apps/web/app/api/invitations (helper compartilhado extraído)
tech-stack:
  added: []
  patterns:
    - "Revogação de sessão por ban (ban_duration 876000h) + RLS por lookup"
    - "Auditoria server-side em audit_log (escrita só via service_role)"
    - "Fluxo único de convite reutilizado pelo admin (D-03)"
key-files:
  created:
    - apps/web/app/api/members/[userId]/route.ts
    - apps/web/app/api/admin/organizations/route.ts
    - apps/web/app/admin/page.tsx
    - apps/web/app/admin/create-org-form.tsx
    - apps/web/app/(dashboard)/equipe/member-actions.tsx
    - apps/web/lib/audit.ts
    - apps/web/lib/invitations/create.ts
    - apps/web/tests/members-admin.test.ts
  modified:
    - apps/web/app/(dashboard)/equipe/page.tsx
    - apps/web/app/api/invitations/route.ts
    - apps/web/app/api/invitations/_helpers.ts
    - apps/web/tests/invitations.test.ts
    - packages/shared/src/index.ts
decisions:
  - "Revogação de sessão na remoção = ban via updateUserById (A5): admin.signOut exige o JWT do alvo, indisponível server-side; o ban bloqueia o refresh e o RLS nega leituras imediatamente"
  - "Cleanup de convites de teste escopado à org do gestor seed para não interferir em suítes paralelas"
metrics:
  duration: "~15 min"
  completed: "2026-07-10"
requirements: [AUTH-05, AUTH-04]
status: complete
---

# Phase 01 Plan 07: Remoção de membros e admin da Elite Juris Summary

Remoção de advogado com efeito imediato (ban + RLS) e histórico preservado, mais provisioning de escritórios pelo super-admin com convite de gestor pelo fluxo único do 01-05 — tudo auditado em audit_log.

## Entregas

- **`DELETE /api/members/[userId]`** (soft-removal, D-11): `profiles.status='removed'` + `removed_at` — NUNCA delete de `profiles`/`auth.users`. Revogação de sessão via `auth.admin.updateUserById(userId, { ban_duration: '876000h' })`. Proteções: auto-remoção bloqueada (400 "Você não pode remover a si mesmo."), último gestor ativo da org não removível (400), 404 cross-org sem vazar existência. Auditado com `member.removed`.
- **`POST /api/admin/organizations`** (super_admin only): cria organização com SOMENTE o nome (D-04) e convida o primeiro gestor pela MESMA mecânica de convite do 01-05 (D-03: token 32 bytes, hash SHA-256, 7 dias, e-mail via `sendEmail`). Auditado com `org.created` e `gestor.invited`. `GET` lista organizações com membros ativos e convites pendentes (visão de suporte, D-02).
- **`/admin`**: guarda dupla (gate do proxy + checagem server-side de `super_admin` com `redirect('/')`), lista de organizações com contagens e formulário nome do escritório + e-mail do gestor ("Organização criada. Convite enviado ao gestor.").
- **`/equipe`**: botão "Remover" por membro ativo (exceto o próprio usuário) com confirmação em pt-BR explicando D-11: "O acesso é bloqueado imediatamente. As conversas e notas dele continuam visíveis no painel."
- **`logAudit()`** em `apps/web/lib/audit.ts`: insert em `audit_log` via `createAdminClient` (tabela sem policy de escrita para `authenticated`, leitura só por super_admin — by design do 01-02).
- **Helper compartilhado** `createInvitationAndSendEmail()` extraído para `apps/web/lib/invitations/create.ts` e usado pelos dois fluxos (gestor e admin) — D-03 garantido por construção.

## Verificação

- `pnpm --filter web exec vitest run tests/members-admin.test.ts` — **6 testes verdes** (5 comportamentos do plano + regras de proteção).
- Suíte completa `vitest run --exclude tests/skeleton.test.ts` — **26 testes verdes** (invitations 10/10 continua verde após o refactor do helper).
- `pnpm --filter web build` — passou; rotas `/admin`, `/api/admin/organizations` e `/api/members/[userId]` presentes no output.
- Greps do plano: `ban_duration` e `logAudit` no endpoint de remoção; `super_admin` em `app/admin/page.tsx`.

## Prova do fluxo D-12 e do /admin

- **D-12 ponta a ponta (teste 4):** advogado removido pelo endpoint → reconvidado pelo gestor → aceita → profile volta a `active`, `removed_at null`, **mesmo `user_id`** (histórico reassumido; unban no accept do 01-05).
- **Provisioning (teste 5, substitui a prova manual):** super_admin seedado no teste cria escritório via `POST /api/admin/organizations` → convite `pending` de `gestor` verificado no banco → linhas `org.created` e `gestor.invited` em `audit_log` com o `actor_user_id` do super-admin → o convite é aceito pelo MESMO fluxo `/api/invitations/accept` do 01-05, resultando em profile `gestor` ativo na org nova. Gestor comum recebe 403 no mesmo POST.

## Deviations from Plan

### Auto-fixed Issues

**1. [A5 validada — comportamento real documentado] `auth.admin.signOut` não aceita userId**
- **Found during:** Task 2
- **Issue:** O plano prescrevia `auth.admin.signOut(userId, 'global')` + ban. Na supabase-js 2.110, `GoTrueAdminApi.signOut(jwt, scope)` exige o **JWT do próprio usuário** — indisponível no servidor na remoção.
- **Fix:** Revogação implementada só com ban (`ban_duration: '876000h'`). Comportamento real verificado pelo teste 2: token antigo lê **0 linhas** de organizations/conversations sem refresh (RLS por lookup) e o **refresh token é recusado** pelo GoTrue para usuário banido — a semântica pedida por D-11 está integralmente coberta. O plano pré-autorizava exatamente esta documentação ("se a semântica de revogação do GoTrue divergir, documentar o comportamento real no SUMMARY").
- **Files modified:** apps/web/app/api/members/[userId]/route.ts
- **Commit:** 95b48e7

**2. [Rule 3 - Blocking] Convites de teste acumulados estouravam o limite de 20 pendentes**
- **Found during:** Task 3 (verificação da suíte completa)
- **Issue:** Execuções repetidas de `invitations.test.ts` desde o 01-05 acumularam convites `pending` na org do gestor seed; o limite de 20 do endpoint passou a devolver 429 e derrubou 6 testes.
- **Fix:** `afterAll` em `invitations.test.ts` apaga convites `%@example.test` escopados à org do gestor seed (não interfere nas orgs descartáveis de suítes paralelas). Primeiro run purgou o backlog.
- **Files modified:** apps/web/tests/invitations.test.ts
- **Commit:** 56abb5c

**3. [Rule 2 - Missing critical] Suporte a helpers compartilhados**
- **Found during:** Tasks 2-3
- **Issue:** `logAudit` precisava do tipo `Json` (não re-exportado por `@copiloto/shared`) e o endpoint de membros precisava do `getActorContext` com mensagem 403 adequada (o texto era específico de convites).
- **Fix:** Re-export de `Json` em `packages/shared/src/index.ts`; parâmetro opcional `forbiddenMessage` em `getActorContext` (backward-compatible — suíte de convites verde).
- **Files modified:** packages/shared/src/index.ts, apps/web/app/api/invitations/_helpers.ts
- **Commit:** 95b48e7

### Additions

- Teste extra "regras de proteção" (além dos 5 do plano) cobrindo auto-remoção (400) e último gestor ativo (400) — as duas regras exigidas pelos acceptance criteria da Task 2.

## Known Stubs

Nenhum — todos os fluxos estão ligados a dados reais do Supabase hospedado.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. T-1-26 a T-1-30 mitigadas e provadas por teste (revogação imediata, 404 cross-org, auditoria obrigatória, último gestor protegido, soft-removal sem delete).

## Commits

- `3d0db32 test(01-07): add failing tests for member removal and admin provisioning`
- `95b48e7 feat(01-07): add member removal with session revocation and audit`
- `56abb5c feat(01-07): add super-admin org provisioning with audit trail`

## Notas

- O acesso do usuário removido morre em duas camadas independentes: RLS (imediato, mesmo com access token válido) e ban (refresh recusado). A reativação D-12 remove o ban (`ban_duration: "none"`) no accept — já existente desde o 01-05 e agora exercitada de ponta a ponta.
- A interface `/admin` usa o server client com RLS (policies `is_super_admin()`), não o service_role — o service_role fica restrito aos Route Handlers.

## Self-Check: PASSED

Todos os 8 arquivos criados existem no disco; commits 3d0db32, 95b48e7 e 56abb5c presentes no git log.
