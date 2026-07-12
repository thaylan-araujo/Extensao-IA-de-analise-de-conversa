---
phase: 02-extens-o-chrome-e-leitura-do-whatsapp
plan: 05
subsystem: admin-web
tags: [next, route-handler, rls, kill-switch, reader-health, audit, ext-05]
requires:
  - phase: 02-02
    provides: "Tabelas app_settings (seed reader_enabled=true) e reader_status com RLS super-admin"
  - phase: 01-06
    provides: "Tela /admin com guarda dupla, getActorContext, jsonError e logAudit"
provides:
  - "Kill-switch global D-15 acionável pela tela /admin: GET/POST /api/admin/settings sobre app_settings.reader_enabled"
  - "Escrita da flag negada a não super-admin (403 provado por teste) sob guarda dupla handler+RLS"
  - "Auditoria reader.kill_switch.toggled em todo acionamento"
  - "Tabela de saúde da leitura D-14 em /admin: status ok/drift/broken, versão da extensão e último heartbeat por advogado"
affects: [02-06, 02-07, extension, admin]
tech-stack:
  added: []
  patterns:
    - "Escrita de flag global sob RLS com a sessão do super-admin (service_role só na auditoria)"
    - "Join reader_status → profile/organização em memória no RSC, mesmo padrão das contagens da página"
key-files:
  created:
    - "apps/web/app/api/admin/settings/route.ts"
    - "apps/web/app/admin/kill-switch-toggle.tsx"
    - "apps/web/tests/admin-settings.test.ts"
  modified:
    - "apps/web/app/admin/page.tsx"
key-decisions:
  - "Join da tabela de saúde feito em memória (opção prevista no plano): select de profiles do Promise.all estendido com user_id/full_name em vez de depender do embed por FK do PostgREST"
  - "Estado da flag interpretado estritamente como value === true (jsonb): linha ausente ou valor corrompido aparece como desativada, nunca como ativa por engano"
  - "POST valida o body (zod) antes da guarda de papel, na mesma ordem do template organizations/route.ts"
metrics:
  duration: "6min"
  completed: "2026-07-12"
requirements-completed: [EXT-05]
duration: 6min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 05: Kill-Switch e Saúde da Leitura no Admin Summary

**Kill-switch global D-15 como toggle auditado em /admin (POST super-admin only sobre app_settings.reader_enabled) e tabela de saúde D-14 exibindo reader_status por advogado, provados por 5 testes de integração contra o hosted**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-12T10:41:07Z
- **Completed:** 2026-07-12T10:47:30Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Route handler `GET/POST /api/admin/settings`: leitura e toggle de `app_settings.reader_enabled` com guarda dupla (getActorContext role super_admin no handler + policy RLS "super admins manage settings" no banco — T-02-16), zod no body e erros pt-BR no shape jsonError.
- Toda mutação grava `reader.kill_switch.toggled` em audit_log com o novo valor nos details (T-02-17).
- `KillSwitchToggle` no padrão create-org-form: confirmação explícita em pt-BR explicando o efeito global (T-02-19), POST ao route handler, `router.refresh()` no sucesso.
- Tela `/admin` estendida sem tocar a guarda dupla: seção "Leitura do WhatsApp" com o toggle e seção "Saúde da leitura" com tabela de reader_status (Advogado, Escritório, Status com badges "Leitura OK"/"Drift de seletor"/"Quebrada", Versão, Último sinal em pt-BR; linha vazia "Nenhuma extensão reportou ainda.").
- Suíte `admin-settings.test.ts` (TDD red→green, 5 comportamentos): GET estado, POST desliga+persiste+audita, 403 gestor com valor inalterado, 400 body inválido, round-trip religando — teardown sempre restaura `reader_enabled = true` no hosted.

## Task Commits

1. **Task 1 (RED): testes de integração do kill-switch** - `9538e41` (test)
2. **Task 1 (GREEN): route handler super-admin only auditado** - `8dad5e6` (feat)
3. **Task 2: seção kill-switch + tabela de saúde em /admin** - `5f1174b` (feat)

## Files Created/Modified

- `apps/web/app/api/admin/settings/route.ts` - GET (estado) e POST (toggle) de reader_enabled, super-admin only, com logAudit.
- `apps/web/app/admin/kill-switch-toggle.tsx` - componente cliente do toggle com confirmação e estados de erro/loading.
- `apps/web/app/admin/page.tsx` - selects de app_settings e reader_status no Promise.all existente + duas seções novas no padrão visual da página.
- `apps/web/tests/admin-settings.test.ts` - 5 testes de integração contra o hosted com usuários descartáveis via service role.

## Decisions Made

- Join da saúde em memória: o select de `profiles` já existente no Promise.all foi estendido com `user_id, full_name` (sem quebrar as contagens) e o nome da organização vem do select de organizations já presente — evita depender da inferência de FK do embed do PostgREST, como o plano previa como alternativa.
- `value === true` estrito para interpretar a flag jsonb: qualquer estado inesperado aparece como "Leitura desativada" (fail-closed na UI), nunca como ativa por engano.
- Body inválido retorna 400 antes da checagem de papel (ordem idêntica ao template `organizations/route.ts` — consistência do admin).

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Task 1 (`tdd="true"`): RED provado (5/5 falhando por módulo inexistente) em `9538e41` (test), GREEN (5/5 verdes contra o hosted) em `8dad5e6` (feat). Refactor não necessário — implementação nasceu no template estabelecido.

## Threat Model Coverage

- T-02-16 (EoP): guarda dupla handler + RLS; 403 do gestor provado no teste 3.
- T-02-17 (Repudiation): logAudit em toda mutação; auditoria verificada nos testes 2 e 5.
- T-02-18 (Info disclosure): tabela de saúde só na página /admin com guarda dupla intacta; details de reader_status não são exibidos.
- T-02-19 (DoS aceito): confirmação explícita no toggle + trilha de auditoria.

## Issues Encountered

None.

## Verification

- `pnpm --filter web exec vitest run tests/admin-settings.test.ts` - PASS (5/5 contra o hosted).
- `pnpm --filter web build` - PASS com `/admin` e `/api/admin/settings` no output de rotas.
- Checagem de conteúdo da página (reader_status, app_settings, "Saúde da leitura", KillSwitchToggle) - PASS.
- Suíte web completa `vitest run --exclude tests/skeleton.test.ts` - PASS (6 arquivos, 38 testes — nenhuma regressão).

## Next Phase Readiness

- O caminho de resposta a quebras está pronto no lado web: admin vê "broken" → aciona o kill-switch → corrige → reativa.
- Plano 02-06 (lado da extensão) consome a mesma flag `reader_enabled` via poll e alimenta `reader_status` — os dois lados do contrato D-14/D-15 se encontram lá.

## Self-Check: PASSED

- FOUND: apps/web/app/api/admin/settings/route.ts
- FOUND: apps/web/app/admin/kill-switch-toggle.tsx
- FOUND: apps/web/app/admin/page.tsx (seções novas)
- FOUND: apps/web/tests/admin-settings.test.ts
- FOUND: commits 9538e41, 8dad5e6, 5f1174b

---
*Phase: 02-extens-o-chrome-e-leitura-do-whatsapp*
*Completed: 2026-07-12*
