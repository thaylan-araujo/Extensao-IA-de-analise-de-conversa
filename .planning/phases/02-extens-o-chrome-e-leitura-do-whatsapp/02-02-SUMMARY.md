---
phase: 02-extens-o-chrome-e-leitura-do-whatsapp
plan: 02
subsystem: database
tags: [supabase, postgres, rls, dedup, kill-switch, pgtap, ext-04, ext-05]
requires:
  - phase: 01-02
    provides: "Schema multi-tenant com RLS, helpers private.* e projeto hospedado sa-east-1"
  - phase: 01-03
    provides: "Infra pgTAP (helpers de JWT simulado) e workflow db-tests.yml no CI"
provides:
  - "Dedup de mensagens garantido no banco: unique index (conversation_id, wa_message_id)"
  - "Identidade estável de conversa por advogado: unique index (profile_id, wa_chat_id)"
  - "Policy UPDATE em conversations (upsert de contact_name/updated_at)"
  - "Kill-switch remoto app_settings com seed reader_enabled=true (D-15)"
  - "Heartbeat de saúde reader_status com RLS dono+super-admin (D-14)"
  - "Contrato MessageDTO/MessageKind/ReaderHealth em @copiloto/shared"
affects: [02-04, 02-05, 02-06, extension, sync, rls]
tech-stack:
  added: []
  patterns:
    - "Idempotência de sync no banco via unique index + ON CONFLICT DO NOTHING (nunca só no cliente)"
    - "Unique indexes de dedup NÃO parciais para compatibilidade com upsert do PostgREST"
    - "Flags remotas em app_settings key/value jsonb, escrita restrita a super-admin"
key-files:
  created:
    - "supabase/migrations/20260712000000_extension_sync.sql"
    - "supabase/tests/05-extension-sync.test.sql"
    - "supabase/tests/06-app-settings.test.sql"
    - "apps/web/tests/extension-schema.test.ts"
  modified:
    - "packages/shared/src/index.ts"
    - "packages/shared/src/database.types.ts"
key-decisions:
  - "Unique indexes de dedup NÃO parciais (desvio documentado do Pattern 5): PostgREST gera ON CONFLICT sem predicado WHERE e o Postgres não infere index parcial — NULLS DISTINCT preserva linhas legadas com ids nulos"
  - "Grant UPDATE em conversations adicionado (Rule 2): a policy UPDATE nova seria inerte sem o privilégio de tabela, ausente nos grants da Fase 1"
  - "Schemas Zod de validação ficam no app da extensão (02-06), não em packages/shared — pacote segue sem dependências"
  - "Descrições pgTAP em português sem acento, seguindo a convenção real das suítes 01-04"
metrics:
  duration: "20min (pausa de checkpoint para db push manual do usuário)"
  completed: "2026-07-12"
requirements-completed: [EXT-04, EXT-05]
duration: 20min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 02: Schema de Sincronização da Extensão Summary

**Dedup de mensagens por unique index no banco (EXT-04), kill-switch app_settings e saúde reader_status sob RLS (EXT-05), aplicados no hospedado e provados por pgTAP + integração**

## Performance

- **Duration:** ~20 min de execução (com pausa de checkpoint para o push manual)
- **Started:** 2026-07-12T10:03:55Z
- **Completed:** 2026-07-12T10:23:34Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Migration `20260712000000_extension_sync.sql`: colunas `wa_message_id`/`from_me`/`kind` em messages, 2 unique indexes de dedup, policy `"members update own conversations"`, tabelas `app_settings` (seed `reader_enabled=true`) e `reader_status` com RLS e grants.
- Migration aplicada no projeto hospedado sa-east-1 (`nifjhvkamwzqcfedbcww`) — `supabase migration list --linked` confirma `20260712000000` local/remota.
- Tipos regenerados em `packages/shared/src/database.types.ts` com as novas tabelas/colunas; contrato `MessageKind`/`ReaderHealth`/`MessageDTO` publicado em `@copiloto/shared`.
- Suítes pgTAP 05 (6 testes: dedup de messages e conversations, RLS cross-org, UPDATE próprio vs alheio) e 06 (8 testes: leitura da flag por qualquer autenticado, escrita só super-admin, heartbeat só da própria linha, leitura agregada só super-admin).
- Teste de integração env-gated `extension-schema.test.ts` verde contra o hospedado (3/3): upsert duplo de conversation, dedup de message com `ignoreDuplicates`, flag seed.
- CI `db-tests.yml` run 14 (SHA `145e6f6`): **success** — pgTAP 01-06 + vitest.

## Task Commits

1. **Task 1: Migration de sync da extensão (dedup + kill-switch + saúde)** - `ec39ca9` (feat)
2. **Task 2: db push + regeneração de tipos + contrato em @copiloto/shared** - `d58e33c` (feat) — push executado manualmente pelo usuário (ver Gates)
3. **Task 3: Provas pgTAP + teste de integração do schema** - `145e6f6` (test)

## Files Created/Modified

- `supabase/migrations/20260712000000_extension_sync.sql` - dedup, policy UPDATE, app_settings, reader_status, grants.
- `packages/shared/src/database.types.ts` - tipos regenerados do banco hospedado (+69 linhas).
- `packages/shared/src/index.ts` - `MessageKind`, `ReaderHealth`, `MessageDTO` (contrato DOM→sync dos planos 02-04/02-06).
- `supabase/tests/05-extension-sync.test.sql` - idempotência + RLS de conversations/messages.
- `supabase/tests/06-app-settings.test.sql` - RLS do kill-switch e do heartbeat.
- `apps/web/tests/extension-schema.test.ts` - round-trip contra o hospedado com usuários descartáveis via service role.

## Decisions Made

- Unique indexes NÃO parciais (desvio deliberado do Pattern 5 do RESEARCH, previsto no plano): o upsert do PostgREST emite `ON CONFLICT (cols)` sem predicado e falharia com index parcial; NULLS DISTINCT mantém linhas com ids nulos permitidas.
- Zod de validação de payloads fica no app da extensão (plano 02-06) — `packages/shared` permanece sem dependências (padrão da Fase 1).
- Descrições dos cenários pgTAP em português sem acento: o plano pedia "em inglês no padrão das suítes existentes", mas as suítes 01-04 usam português sem acento — a convenção real do projeto prevaleceu (nomes de POLICY seguem em inglês, como manda a convenção).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Grant UPDATE em conversations**
- **Found during:** Task 1
- **Issue:** O plano cria a policy `"members update own conversations"`, mas a migration de grants da Fase 1 só concedeu SELECT/INSERT em conversations — sem o privilégio de tabela UPDATE a policy é inerte e o upsert falharia com 42501.
- **Fix:** `grant update on table public.conversations to authenticated;` adicionado ao bloco de grants da migration, com comentário explicativo.
- **Verification:** Teste de integração prova o segundo upsert atualizando `contact_name`; pgTAP 05 prova UPDATE próprio ok e alheio 0 linhas.
- **Files modified:** `supabase/migrations/20260712000000_extension_sync.sql`
- **Commit:** `ec39ca9`

## Gates (checkpoint durante execução)

- **Permission gate no `supabase db push` (Task 2):** o classificador de permissões negou a aplicação da migration no banco remoto (deploy em produção com bypass de confirmação). Conforme previsto no próprio plano ("Se o push exigir prompt impossível de suprimir, PARAR"), a execução pausou em checkpoint human-action; o usuário rodou `pnpm exec supabase db push` manualmente e a retomada verificou de forma independente via `supabase migration list --linked` (read-only) antes de prosseguir.

## TDD Gate Compliance

Task 3 estava marcada `tdd="true"`, mas a fase RED não se aplica: por design do plano, a implementação (migration) foi entregue nas Tasks 1-2 e aplicada no hospedado antes das provas — os testes nascem verdes contra schema existente (test-after de prova de comportamento, não red/green de feature nova). Commits: `feat` (`ec39ca9`, `d58e33c`) seguidos de `test` (`145e6f6`).

## Issues Encountered

- `gh` CLI não instalado — verificação do CI feita via API pública do GitHub (`/actions/workflows/db-tests.yml/runs`), run 14 concluído com `success`.
- pgTAP não roda localmente (sem Docker, mesma limitação da Fase 1) — validação das suítes 05/06 delegada ao CI, como o plano previa.

## Verification

- `supabase migration list --linked` - PASS: `20260712000000` local/remota.
- `pnpm --filter web exec vitest run tests/extension-schema.test.ts` - PASS: 3/3 contra o hospedado.
- `pnpm --filter web build` - PASS após regeneração de tipos.
- CI `db-tests.yml` run 14 (SHA `145e6f6`) - PASS (`completed success`), incluindo 05-extension-sync e 06-app-settings.
- Teste de integração usa usuários descartáveis via service role (sem credenciais seed) - PASS.

## Next Phase Readiness

- Planos 02-05 (kill-switch/status na UI) e 02-06 (sync engine) podem consumir `app_settings`, `reader_status` e o contrato `MessageDTO` — a idempotência já é garantia do banco.
- Plano 02-04 (reader DOM) tem o contrato literal `MessageKind` para classificar mensagens.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260712000000_extension_sync.sql
- FOUND: packages/shared/src/index.ts
- FOUND: packages/shared/src/database.types.ts
- FOUND: supabase/tests/05-extension-sync.test.sql
- FOUND: supabase/tests/06-app-settings.test.sql
- FOUND: apps/web/tests/extension-schema.test.ts
- FOUND: commits ec39ca9, d58e33c, 145e6f6

---
*Phase: 02-extens-o-chrome-e-leitura-do-whatsapp*
*Completed: 2026-07-12*
