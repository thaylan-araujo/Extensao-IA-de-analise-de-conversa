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

## Deploy

O painel roda na Vercel (projeto `elite-juris/copiloto-juridico`), com as funcoes na regiao `gru1` (Sao Paulo) e o banco no Supabase `sa-east-1`.

- **URL de producao:** https://copiloto-juridico.vercel.app
- **Config do deploy:** `vercel.json` na raiz (regiao `gru1`, build do monorepo via `@vercel/next` apontando para `apps/web`)

### Variaveis de ambiente (Vercel, ambiente Production)

| Variavel | Descricao |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (`sa-east-1`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave publica (anon) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (sensivel, server-only) |
| `NEXT_PUBLIC_SITE_URL` | URL publica do deploy (usada em links de convite/reset) |
| `EMAIL_DRIVER` | `console` (logs da Vercel) ate o Resend estar verificado; depois `resend` |
| `EMAIL_FROM_NAME` | Nome do remetente dos e-mails |
| `EMAIL_FROM_ADDRESS` | Endereco do remetente (`nao-responda@elitejuris.com.br`) |

Para gerenciar: `pnpm dlx vercel env ls production` / `pnpm dlx vercel env add NOME production`.

### Redeploy

```bash
pnpm dlx vercel --prod --yes
```

O deploy usa o projeto linkado em `.vercel/` (gerado por `pnpm dlx vercel link --yes --project copiloto-juridico`). Os redirects de auth do Supabase (reset de senha) ja incluem a URL de producao (`supabase/config.toml` -> `additional_redirect_urls`).
