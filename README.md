# Copiloto Juridico WhatsApp

Copiloto de IA para orientar atendimentos juridicos no WhatsApp e medir a conversao dos advogados em contratos fechados.

## Desenvolvimento local

```bash
corepack enable pnpm
pnpm install
pnpm --filter web dev
```

O app web roda contra o projeto Supabase hospedado em `sa-east-1` (Sao Paulo). Docker nao e necessario para desenvolver o painel; os testes pgTAP rodam no CI.

## Testes

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec vitest run tests/skeleton.test.ts
```

O teste de esqueleto nasce vermelho ate o schema, as policies e os usuarios demo serem criados nos proximos planos.
