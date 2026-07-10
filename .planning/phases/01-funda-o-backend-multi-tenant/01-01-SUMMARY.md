---
phase: 01-funda-o-backend-multi-tenant
plan: 01
subsystem: foundation
tags: [pnpm, nextjs, react, tailwind, vitest, supabase, typescript]
requires: []
provides:
  - "Monorepo pnpm com apps/web e packages/shared"
  - "App Next.js 16.2.10 compilando"
  - "Teste de esqueleto vermelho para login gestor e leitura da organizacao"
  - "Contrato inicial de variaveis de ambiente"
affects: [phase-01, phase-02, auth, dashboard, shared-types]
tech-stack:
  added:
    - "next@16.2.10"
    - "react@19.2.7"
    - "typescript@~5.9.3"
    - "@supabase/supabase-js@2.110.1"
    - "@supabase/ssr@0.12.0"
    - "tailwindcss@4.3.2"
    - "vitest@4.1.10"
    - "supabase@2.109.1"
  patterns:
    - "pnpm workspace com apps/* e packages/*"
    - "Teste vermelho explicito para dependencias ainda nao provisionadas"
key-files:
  created:
    - "pnpm-workspace.yaml"
    - "package.json"
    - "pnpm-lock.yaml"
    - "apps/web/package.json"
    - "apps/web/app/layout.tsx"
    - "apps/web/app/page.tsx"
    - "apps/web/tests/skeleton.test.ts"
    - "packages/shared/src/index.ts"
    - ".env.example"
  modified: []
key-decisions:
  - "Usar pnpm workspaces puro, sem Turborepo, conforme pesquisa da fase."
  - "Manter o teste de esqueleto vermelho por ausencia de Supabase seedado, sem skip."
patterns-established:
  - "Tipos compartilhados de papeis/status vivem em packages/shared."
  - "Configs de toolchain ficam pinadas no workspace para evitar latest implicito."
requirements-completed: [AUTH-04]
duration: 80min
completed: 2026-07-10
status: complete
---

# Phase 01: Scaffold Monorepo Summary

**Monorepo pnpm com app Next.js 16 compilando, tipos compartilhados e teste vermelho do walking skeleton**

## Performance

- **Duration:** 80 min
- **Started:** 2026-07-09T20:03:36Z
- **Completed:** 2026-07-10T01:20:34Z
- **Tasks:** 2/2
- **Files modified:** 19

## Accomplishments

- Criado o workspace pnpm com `apps/web` e `packages/shared`.
- Criado o app Next.js 16.2.10 com Tailwind 4, TypeScript 5.9 e build verde.
- Criado o teste de esqueleto que falha claramente enquanto Supabase e seed demo ainda nao existem.
- Criado o contrato inicial de `.env.example` e tipos compartilhados de papel/status.

## Task Commits

1. **Task 1: Aprovar auditoria de legitimidade dos pacotes npm** - aprovado pelo usuario, sem commit de codigo.
2. **Task 2: Scaffold do monorepo pnpm com versoes pinadas e teste de esqueleto vermelho** - `e643f5e` (feat)

## Files Created/Modified

- `pnpm-workspace.yaml` - workspace e permissoes estreitas de build para transitive deps.
- `package.json` - scripts raiz e devDependencies compartilhadas.
- `pnpm-lock.yaml` - lockfile das versoes pinadas.
- `.gitignore` - ignora envs reais, builds, node_modules e store local.
- `.env.example` - contrato de variaveis para Supabase e usuarios seed.
- `README.md` - comandos locais e expectativa do teste vermelho.
- `apps/web/package.json` - dependencias pinadas do app web.
- `apps/web/app/*` - layout, pagina inicial e CSS global do App Router.
- `apps/web/vitest.config.ts` - configuracao de testes com carregamento simples de `.env.local`.
- `apps/web/tests/skeleton.test.ts` - teste vermelho do gestor demo.
- `packages/shared/src/index.ts` - tipos `UserRole`, `ProfileStatus` e `InvitationStatus`.

## Decisions Made

- `@tailwindcss/postcss` foi declarado como devDependency direta porque o plano exige Tailwind 4 via PostCSS e o build do Next precisa do plugin disponivel.
- `allowBuilds` foi limitado a `esbuild` e `sharp`, transitive deps esperadas de Vitest/Vite e Next, para satisfazer o pnpm 11 sem liberar scripts genericamente.
- `vitest.config.ts` evita importar `vite` diretamente; usa `vitest/config` e parser local simples de `.env.local`.

## Deviations from Plan

### Auto-fixed Issues

**1. Tailwind 4 PostCSS plugin declarado diretamente**
- **Found during:** Task 2
- **Issue:** O plano mencionava `@tailwindcss/postcss` em `postcss.config.mjs`, mas a lista de dependencias so citava `tailwindcss`.
- **Fix:** Adicionado `@tailwindcss/postcss@4.3.2` em `apps/web/package.json`.
- **Verification:** `pnpm --filter web build` passou.
- **Committed in:** `e643f5e`

**2. pnpm 11 exigiu aprovacao explicita de build scripts transitivos**
- **Found during:** `pnpm install`
- **Issue:** `esbuild` e `sharp` tiveram scripts bloqueados e o install retornou erro.
- **Fix:** Adicionado `allowBuilds` para `esbuild` e `sharp` no workspace.
- **Verification:** `pnpm install` terminou com exit 0.
- **Committed in:** `e643f5e`

**3. Vitest config removida de import direto de vite**
- **Found during:** `pnpm --filter web build`
- **Issue:** Typecheck do Next falhou porque `vitest.config.ts` importava `vite` sem dependencia direta.
- **Fix:** Usado `vitest/config` e leitura local de `.env.local`.
- **Verification:** `pnpm --filter web build` passou.
- **Committed in:** `e643f5e`

---

**Total deviations:** 3 auto-fixed
**Impact on plan:** Mantem o escopo do scaffold e melhora reprodutibilidade; nenhuma funcionalidade fora da fase foi adicionada.

## Issues Encountered

- O sandbox bloqueou rede durante `pnpm install`; a instalacao foi concluida com permissao de rede.
- O sandbox bloqueou o Turbopack ao tentar criar processo/bindar porta; o build foi verificado fora do sandbox e passou.

## Verification

- `pnpm install` - PASS
- `pnpm --filter web build` - PASS
- `pnpm --filter web exec vitest run tests/skeleton.test.ts` - PASS como vermelho esperado (exit 1)
- `node -e "const v=require('./apps/web/node_modules/typescript/package.json').version; if(!v.startsWith('5.9')) process.exit(1)"` - PASS (`5.9.3`)
- Checks de versao, tipos compartilhados, `.env.example` e README - PASS

## User Setup Required

None for this plan. Supabase e seeds entram no plano 01-02.

## Next Phase Readiness

O monorepo esta pronto para o plano 01-02 criar `supabase/`, migrations, seed e types. O teste vermelho em `apps/web/tests/skeleton.test.ts` define o alvo inicial para ficar verde quando o projeto Supabase e o gestor demo existirem.

---
*Phase: 01-funda-o-backend-multi-tenant*
*Completed: 2026-07-10*
