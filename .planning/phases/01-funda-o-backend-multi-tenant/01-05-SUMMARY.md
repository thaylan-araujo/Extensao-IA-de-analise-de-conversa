# 01-05 Summary — Convites e tela de equipe

## Resultado

Plano concluído. O gestor agora consegue criar, reenviar e cancelar convites pendentes, e o convidado aceita o link informando apenas nome completo e senha. Reconvite de usuário removido reativa o mesmo `user_id`, preservando histórico.

## Entregas

- Criado token de convite com `randomBytes(32)` e hash SHA-256; o banco guarda apenas `token_hash`.
- Criado driver de e-mail configurável por `EMAIL_DRIVER`, com `console` como default e `resend` como opção.
- Criado template pt-BR de convite com validade de 7 dias e tom profissional.
- Criadas rotas:
  - `POST /api/invitations`
  - `POST /api/invitations/[id]/resend`
  - `DELETE /api/invitations/[id]`
  - `POST /api/invitations/accept`
- Criada página pública `/convite/[token]` com formulário somente de nome completo e senha.
- Criada tela `/equipe` com membros, status removido, convites pendentes, convidar, reenviar e cancelar.

## Arquivos principais

- `apps/web/lib/invitations/token.ts`
- `apps/web/lib/email/index.ts`
- `apps/web/lib/email/console.ts`
- `apps/web/lib/email/resend.ts`
- `apps/web/lib/email/templates/invite.ts`
- `apps/web/app/api/invitations/route.ts`
- `apps/web/app/api/invitations/[id]/route.ts`
- `apps/web/app/api/invitations/[id]/resend/route.ts`
- `apps/web/app/api/invitations/accept/route.ts`
- `apps/web/app/(auth)/convite/[token]/page.tsx`
- `apps/web/app/(auth)/convite/[token]/accept-form.tsx`
- `apps/web/app/(dashboard)/equipe/page.tsx`
- `apps/web/app/(dashboard)/equipe/invite-form.tsx`
- `apps/web/app/(dashboard)/equipe/pending-invites.tsx`
- `apps/web/tests/invitations.test.ts`

## Verificação

- `pnpm --filter web exec vitest run tests/invitations.test.ts` passou com 10 testes.
- `pnpm --filter web exec vitest run --exclude tests/skeleton.test.ts` passou com 16 testes.
- `pnpm --filter web build` passou.
- `safeParse` presente nos 4 handlers de convite.
- `/equipe` não usa `createAdminClient`; leituras passam pelo cliente server com RLS.
- Greps do plano passaram para `Convites pendentes` e `Reenviar`.

## Prova do fluxo

- A suíte de integração usa `EMAIL_DRIVER=console`, autentica gestor seedado, cria convite, aceita o token, verifica profile ativo e convite `accepted`.
- O teste D-12 cria uma conta por convite, marca o profile como `removed`, cria novo convite para o mesmo e-mail e confirma que o aceite reativa o mesmo `user_id` com `status active` e `removed_at null`.
- O teste de autorização confirma `403` quando advogado tenta criar convite.

## Commits

- `38a2b86 test(01-05): add invitation lifecycle tests`
- `0a8e2f4 feat(01-05): add invitation API and accept flow`
- `7278e6d feat(01-05): add team invitation UI`

## Notas

- O envio real por Resend permanece opcional nesta fase; `EMAIL_DRIVER=console` mantém o fluxo funcional enquanto domínio/remetente são configurados.
- Remoção de membros e revogação imediata de sessão ficam para o plano `01-07`, conforme escopo original.
