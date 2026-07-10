---
phase: 01-funda-o-backend-multi-tenant
plan: 02
subsystem: database
tags: [supabase, postgres, rls, auth, seed, lgpd]
requires:
  - phase: 01-01
    provides: "Monorepo pnpm, app web e teste de esqueleto vermelho"
provides:
  - "Projeto Supabase hospedado em sa-east-1"
  - "Schema inicial multi-tenant com 7 tabelas e RLS"
  - "Seed idempotente com super-admin, gestor demo e advogado demo"
  - "Tipos TypeScript gerados do banco remoto"
  - "Teste de esqueleto verde contra Supabase hospedado"
affects: [phase-01, phase-02, auth, dashboard, rls, lgpd]
tech-stack:
  added:
    - "supabase remote project nifjhvkamwzqcfedbcww"
    - "tsx@4.21.0"
    - "@supabase/supabase-js@2.110.1 at workspace root"
  patterns:
    - "RLS keyed por organization_id com helpers security definer"
    - "Seeds idempotentes via service_role em script server-only"
key-files:
  created:
    - "supabase/config.toml"
    - "supabase/migrations/20260710012345_initial_schema.sql"
    - "supabase/templates/recovery.html"
    - "scripts/seed.ts"
    - "packages/shared/src/database.types.ts"
  modified:
    - ".env.example"
    - "package.json"
    - "pnpm-lock.yaml"
key-decisions:
  - "Projeto remoto criado em sa-east-1 para cumprir LGPD-01; projetos existentes em us-east-1 nao foram reutilizados."
  - "Criptografia em repouso segue a plataforma Supabase AES-256, conforme Assumption A1 da pesquisa."
  - "Template de recovery fica versionado, mas aplicacao remota depende de SMTP customizado/plano pago."
patterns-established:
  - "Toda tabela publica criada pela fase nasce com RLS habilitado."
  - "Claims de papel/organizacao sao conveniencia de UI; autorizacao real le profiles via RLS."
requirements-completed: [AUTH-04, LGPD-01]
duration: 65min
completed: 2026-07-10
status: complete
---

# Phase 01: Supabase Multi-Tenant Foundation Summary

**Supabase em sa-east-1 com schema multi-tenant, RLS deny-by-default, seed demo e skeleton verde**

## Performance

- **Duration:** 65 min
- **Started:** 2026-07-10T00:45:00Z
- **Completed:** 2026-07-10T01:50:32Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Criado projeto Supabase `copiloto-juridico` em `sa-east-1`, ref `nifjhvkamwzqcfedbcww`.
- Aplicada a migration remota `20260710012345_initial_schema.sql` com 7 tabelas publicas e RLS.
- Criado seed idempotente para Elite Juris interna, Escritorio Demo, gestor demo e advogado demo.
- Gerados tipos TypeScript do schema remoto em `packages/shared/src/database.types.ts`.
- Teste `apps/web/tests/skeleton.test.ts` passou contra o Supabase hospedado.

## Task Commits

1. **Task 1: Migration inicial — schema multi-tenant, RLS, helpers e hook de claims** - `aa729c5` (feat)
2. **Task 2: Criar projeto sa-east-1, aplicar schema, semear e ficar verde** - `2790c16` (feat)
3. **Compatibilidade Free tier: storage.vector=false** - `305aeff` (fix)

## Files Created/Modified

- `supabase/config.toml` - Auth, hook custom access token, template local e config Free-compatible.
- `supabase/migrations/20260710012345_initial_schema.sql` - enums, tabelas, indices, helpers e policies RLS.
- `supabase/templates/recovery.html` - template pt-BR de recovery versionado.
- `scripts/seed.ts` - seed idempotente usando service role.
- `packages/shared/src/database.types.ts` - tipos gerados do schema remoto.
- `.env.example` - defaults dos e-mails de seed.
- `package.json` / `pnpm-lock.yaml` - script `db:seed`, `tsx` e Supabase JS na raiz.

## Decisions Made

- Os projetos Supabase existentes `dash` e `academia` foram recusados porque estao em `us-east-1`; a regiao e imutavel e LGPD-01 exige Sao Paulo.
- `storage.vector` foi deixado `false` porque vector buckets exigem tier pago e nao sao necessarios nesta fase.
- O seed usa `Escritorio Demo` sem acento para manter consistencia com o teste de esqueleto criado no plano 01-01.

## Deviations from Plan

### Auto-fixed Issues

**1. Root dependency para seed**
- **Found during:** Task 2
- **Issue:** `scripts/seed.ts` roda da raiz e nao conseguia resolver `@supabase/supabase-js`, que existia apenas em `apps/web`.
- **Fix:** Adicionado `@supabase/supabase-js@2.110.1` na raiz e `tsx@4.21.0` para executar o script.
- **Verification:** `pnpm db:seed` passou duas vezes.
- **Committed in:** `2790c16`

**2. Config push limitado pelo Free tier**
- **Found during:** `supabase config push`
- **Issue:** Supabase Free com provedor de e-mail padrao rejeitou customizacao de template; config gerada tambem tentou ativar `storage.vector`, recurso pago.
- **Fix:** `storage.vector=false` no config local. Template recovery permanece versionado, mas precisa de SMTP customizado/plano compativel para aplicar no remoto.
- **Verification:** Migration, seed e skeleton passaram; pendencia registrada para plano 01-08/billing-operacional.
- **Committed in:** `305aeff`

---

**Total deviations:** 2 auto-fixed
**Impact on plan:** O schema, RLS, seed e skeleton estao completos. A unica pendencia operacional e aplicar o template remoto quando SMTP customizado/Resend estiver configurado.

## Issues Encountered

- A Supabase CLI precisou de acesso a `~/.supabase` e rede para listar/criar/linkar projetos.
- `supabase db push` aplicou a migration, mas avisou que nao conseguiu cachear catalogo por ausencia de Docker local. Isso nao impediu a migration remota.
- `supabase config push` nao conseguiu aplicar o template de recovery no Free tier com e-mail provider padrao.

## Verification

- `supabase projects list -o json` - PASS: `nifjhvkamwzqcfedbcww`, `sa-east-1`, `ACTIVE_HEALTHY`.
- `supabase db push` - PASS: migration `20260710012345_initial_schema.sql` aplicada.
- `supabase migration list --linked` - PASS: migration local/remota `20260710012345`.
- `pnpm db:seed` - PASS duas vezes seguidas, sem duplicar dados.
- `pnpm --filter web exec vitest run tests/skeleton.test.ts` - PASS.
- `pnpm --filter web build` - PASS.
- `packages/shared/src/database.types.ts` - PASS: contem `organizations`, `profiles`, `invitations`, `conversations`, `messages`, `diagnostics`.

## User Setup Required

Antes do beta real, configurar SMTP customizado/Resend ou plano compativel para aplicar `supabase/templates/recovery.html` no hosted Auth. O template ja esta versionado e pronto.

## Next Phase Readiness

O plano 01-03 pode construir pgTAP/CI sobre a migration aplicada. O plano 01-04 pode usar o Supabase hospedado e o seed demo para implementar login e dashboard minimo.

---
*Phase: 01-funda-o-backend-multi-tenant*
*Completed: 2026-07-10*
