# 01-03 Summary — Prova de isolamento cross-tenant

## Resultado

Plano concluído. A suíte pgTAP de isolamento multi-tenant está versionada e o workflow `db-tests` passou no GitHub Actions.

Run verde: https://github.com/thaylan-araujo/Extensao-IA-de-analise-de-conversa/actions/runs/29115308883

## Entregas

- Criada suíte pgTAP para cross-tenant, papéis, remoção imediata e cobertura estrutural de RLS.
- Criado workflow `.github/workflows/db-tests.yml` com jobs `rls` e `web-tests`.
- Adicionada migration de grants para permitir que o role `authenticated` alcance as policies RLS nas tabelas de domínio.
- Ajustados helpers de teste para a versão atual do schema `auth.identities` do Supabase local.
- Ajustados testes para permitir leitura do fixture temporário pelo role autenticado durante asserções RLS.

## Arquivos principais

- `.github/workflows/db-tests.yml`
- `supabase/tests/helpers/00-helpers.inc`
- `supabase/tests/01-cross-tenant.test.sql`
- `supabase/tests/02-roles.test.sql`
- `supabase/tests/03-removal.test.sql`
- `supabase/tests/04-rls-coverage.test.sql`
- `supabase/migrations/20260710183300_grant_authenticated_domain_access.sql`

## Verificação

- `pnpm --filter web exec vitest run --exclude tests/skeleton.test.ts --passWithNoTests` passou localmente.
- GitHub Actions `db-tests` run #5 passou:
  - `web-tests`: success
  - `rls`: success

## Notas

- Docker local continuou indisponível, então o gate autoritativo foi o GitHub Actions, conforme previsto no plano.
- O arquivo helper planejado como `supabase/tests/00-helpers.sql` foi movido para `supabase/tests/helpers/00-helpers.inc` para evitar que `supabase test db` o execute como teste TAP independente.
