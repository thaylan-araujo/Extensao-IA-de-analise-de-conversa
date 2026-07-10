# 01-04 Summary — Login do painel e gate de papéis

## Resultado

Plano concluído. O painel web agora tem login Supabase, proxy de sessão no padrão Next 16, gate por papel e dashboard mínimo lendo dados reais via RLS.

## Entregas

- Criados clientes Supabase browser/server/admin, com `SUPABASE_SERVICE_ROLE_KEY` isolada em `apps/web/lib/supabase/admin.ts`.
- Criado `apps/web/proxy.ts` delegando para `updateSession`, sem `middleware.ts`.
- Implementado `decideRedirect` com cobertura para rotas públicas, gestor, advogado e super_admin.
- Criada tela de login com `signInWithPassword`, erro em pt-BR e refresh pós-login.
- Criada rota `POST /auth/signout`.
- Criado dashboard protegido em `/`, lendo organização e contagem de membros ativos via RLS.
- Criada página `/sem-acesso` para advogados, direcionando o uso para a extensão no WhatsApp Web.

## Arquivos principais

- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/admin.ts`
- `apps/web/lib/supabase/proxy-session.ts`
- `apps/web/proxy.ts`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/login/login-form.tsx`
- `apps/web/app/(dashboard)/layout.tsx`
- `apps/web/app/(dashboard)/page.tsx`
- `apps/web/app/auth/signout/route.ts`
- `apps/web/app/sem-acesso/page.tsx`
- `apps/web/tests/proxy-gate.test.ts`

## Verificação

- `pnpm --filter web exec vitest run tests/proxy-gate.test.ts` passou com 6 testes.
- `pnpm --filter web build` passou.
- `grep -rl "SUPABASE_SERVICE_ROLE_KEY" apps/web/lib/supabase/` retornou apenas `apps/web/lib/supabase/admin.ts`.
- Servidor local `pnpm --filter web dev`:
  - `HEAD /` sem sessão retornou `307` para `/login`.
  - `HEAD /login` retornou `200`.
  - `HEAD /sem-acesso` retornou `200`.
- Validação Supabase hospedado com seeds:
  - gestor autenticou com role `gestor`, leu organização `Escritorio Demo` e `2` membros ativos via RLS.
  - advogado autenticou com role `advogado`.
  - super_admin autenticou com role `super_admin`.

## Commits

- `54ecb1d test(01-04): add failing proxy gate tests`
- `9ac46be feat(01-04): add Supabase auth clients`
- `ad866d2 feat(01-04): add web login gate`
- `322bcc8 feat(01-04): add manager dashboard shell`

## Notas

- O plano exigia prova manual dos perfis seedados; ela foi feita por Supabase Auth/RLS direto contra o projeto hospedado, sem imprimir tokens ou senhas.
- A rota `/equipe` fica para o próximo plano (`01-05`), que cobre convites ponta a ponta e tela de equipe.
