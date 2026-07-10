# 01-06 Summary — Redefinição de senha

## Resultado

Plano concluído. O fluxo de redefinição de senha usa o mecanismo nativo do Supabase: pedido do link, confirmação por `/auth/confirm`, sessão temporária e definição de nova senha em `/nova-senha`.

## Entregas

- Criada página `/recuperar-senha` com resposta única anti-enumeração.
- Criado handler `GET /auth/confirm` com `verifyOtp` para `type: "recovery"`.
- Criada validação de `next` interno para evitar open redirect.
- Criada página `/nova-senha` com validação de senha mínima de 8 caracteres e confirmação.
- Login agora exibe avisos de conta criada e senha alterada.

## Arquivos principais

- `apps/web/app/(auth)/recuperar-senha/page.tsx`
- `apps/web/app/(auth)/recuperar-senha/request-form.tsx`
- `apps/web/app/auth/confirm/route.ts`
- `apps/web/app/(auth)/nova-senha/page.tsx`
- `apps/web/app/(auth)/nova-senha/password-form.tsx`
- `apps/web/tests/auth-confirm.test.ts`

## Verificação

- `pnpm --filter web exec vitest run tests/auth-confirm.test.ts` passou com 4 testes.
- `pnpm --filter web build` passou.
- Greps de aceitação passaram para `resetPasswordForEmail`, `verifyOtp`, `recovery`, `updateUser` e senha mínima de 8 caracteres.
- Solicitação real de reset contra Supabase hospedado para o gestor seedado retornou `{ requested: true, error: null }`.

## Prova manual

- A parte de envio foi acionada no Supabase hospedado e aceita sem erro.
- A abertura do e-mail e troca real de senha não foi concluída nesta execução para não alterar a senha seedada usada nos testes locais; o handler de confirmação e a tela de nova senha estão cobertos por teste unitário e build.

## Commits

- `b132271 test(01-06): add password recovery confirm tests`
- `fa4d127 feat(01-06): add password recovery flow`

## Notas

- O SMTP customizado com Resend continua sendo a configuração operacional recomendada antes do beta; o fluxo do app já está preparado para o link do template `supabase/templates/recovery.html`.
