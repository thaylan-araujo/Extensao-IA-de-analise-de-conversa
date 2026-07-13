# Copiloto Juridico WhatsApp

Copiloto de IA para orientar atendimentos juridicos no WhatsApp e medir a conversao dos advogados em contratos fechados.

## Extensão Chrome (apps/extension)

O painel lateral injeta-se diretamente no WhatsApp Web e lê a conversa ativa sem jamais escrever no DOM.

### Pré-requisitos

Copie o arquivo de variáveis de ambiente da extensão:

```bash
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com os valores do projeto Supabase
```

### Desenvolvimento (com HMR)

```bash
pnpm --filter extension dev
```

Abre o Chrome com a extensão já carregada via WXT. Acesse `web.whatsapp.com` — o painel lateral aparece automaticamente. Edições em `apps/extension/entrypoints/` recarregam o content script em tempo real.

### Build de produção

```bash
pnpm --filter extension build
# Saída: apps/extension/.output/chrome-mv3/
```

Em máquinas com memória limitada (<2 GB RAM livre), o `package.json` já inclui `NODE_OPTIONS=--max-old-space-size=512` no script de build para evitar OOM do esbuild.

### Gerar zip para a Chrome Web Store

```bash
pnpm --filter extension zip
# Saída: apps/extension/.output/*.zip
```

### Carregar sem compactação (desenvolvimento/QA)

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione `apps/extension/.output/chrome-mv3/`

### Testes

```bash
pnpm --filter extension test
```

### Distribuição (beta)

O modelo de distribuição do beta é via **link não listado da Chrome Web Store** (sem aparecer nos resultados de busca). O link é distribuído pela Elite Juris diretamente aos escritórios parceiros. O Chrome aplica atualizações automáticas — canal de hotfix crítico para reagir a mudanças do WhatsApp sem que os usuários precisem reinstalar.

O zip de submissão é gerado por `pnpm --filter extension zip`.

---

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
