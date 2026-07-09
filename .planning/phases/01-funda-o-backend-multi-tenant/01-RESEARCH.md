# Phase 1: Fundação Backend Multi-Tenant - Research

**Researched:** 2026-07-08
**Domain:** Supabase multi-tenant (Postgres + Auth + RLS) · Next.js 16 App Router · monorepo greenfield · LGPD (criptografia em repouso, região BR)
**Confidence:** MEDIUM-HIGH (docs oficiais Supabase/Next.js citadas; versões verificadas ao vivo no npm em 2026-07-08)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Criação de organizações no beta
- **D-01:** Organizações são criadas **manualmente pela Elite Juris** no beta fechado — não há auto-cadastro de escritório. Auto-cadastro self-service permanece na v2 (SAAS-01).
- **D-02:** Existe um papel **super-admin** (Elite Juris) desde a Fase 1: cria organizações e gestores, e pode visualizar dados de qualquer organização (suporte + calibração da IA na Phase 7). A interface admin pode ser mínima/simples — o que importa é o papel existir no schema e nas policies de acesso.
- **D-03:** O primeiro gestor de um escritório recebe acesso por **e-mail de convite com link** para definir a própria senha — mesmo mecanismo do convite de advogados (um fluxo único de convite; nenhuma senha temporária circula).
- **D-04:** Cadastro de organização é mínimo: **só nome do escritório** (+ e-mail do gestor convidado). CNPJ e dados de faturamento entram na Fase 6 (Stripe).

#### Papéis e permissões
- **D-05:** Uma organização pode ter **múltiplos gestores**, todos com os mesmos poderes (ver tudo da organização, convidar, remover). Papel é atributo por usuário.
- **D-06:** **Gestor também atende**: pode usar a extensão como advogado, e as conversas dele aparecem no painel junto com as da equipe. Isso cobre o advogado solo (uma pessoa com papel gestor que também atende — não precisa de duas contas).
- **D-07:** **Advogado (não-gestor) não acessa o painel web na v1** — usa apenas a extensão. Painel web é exclusivo de gestores e super-admin. Se um advogado tentar entrar no painel, vê um aviso amigável em pt-BR. (ADV-01, visão do próprio desempenho, permanece v2.)
- **D-08:** **1 usuário (e-mail) pertence a exatamente 1 organização.** Multi-organização fica fora da v1 — simplifica login, extensão e isolamento.

#### Convite e remoção de advogados
- **D-09:** Convite por e-mail com **link com validade** (ex.: 7 dias). Gestor pode **reenviar ou cancelar** convites pendentes na tela de equipe.
- **D-10:** Cadastro do advogado convidado é mínimo: **nome completo + senha** (o e-mail já vem do convite). Sem celular, sem OAB.
- **D-11:** **Remoção preserva o histórico**: o advogado perde o acesso imediatamente, mas conversas, notas, diagnósticos e conversão dele continuam visíveis ao gestor, marcados como de membro "removido". Métricas do time não mudam retroativamente.
- **D-12:** **Reconvite reativa a conta**: se o mesmo e-mail for convidado de novo para o mesmo escritório, a conta é reativada e reassume o histórico antigo (não duplica pessoa nas métricas).

#### Identidade dos e-mails do sistema
- **D-13:** Remetente dos e-mails transacionais (convite, redefinição de senha) usa a **marca Elite Juris** (ex.: `Elite Juris <nao-responda@elitejuris.com.br>`) enquanto o nome do produto é provisório. Configurável para trocar pela marca do produto depois, sem retrabalho.
- **D-14:** Tom dos e-mails: **profissional e direto** — tratamento por "você", texto curto e objetivo, sem emojis. Todo conteúdo em pt-BR.

### Claude's Discretion
- Detalhes técnicos de RLS/policies, modelagem exata do schema, mecanismo de criptografia (Supabase AES-256 em repouso), duração exata da validade do convite e do link de redefinição, política de senha — decisões do pesquisador/planner dentro da stack já definida em `.claude/CLAUDE.md`.
- Formato da "interface admin simples" do super-admin na v1 (pode ser tela mínima ou operação assistida por ferramenta interna), desde que criar organização + convidar gestor seja possível sem mexer no banco na mão.

### Deferred Ideas (OUT OF SCOPE)
- **Auto-cadastro de organização com trial** — já registrado como SAAS-01 (v2), reconfirmado nesta discussão.
- **Advogado ver o próprio desempenho no painel web** — já registrado como ADV-01 (v2), reconfirmado nesta discussão.
- **Usuário multi-organização** — fora da v1 por decisão desta discussão; revisitar apenas se aparecer demanda real no beta.
- **Marca/nome definitivo do produto** — e-mails saem como Elite Juris por ora; troca de identidade quando o nome for definido (configuração, não código).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-03 | Usuário pode redefinir a senha via link por e-mail | Fluxo PKCE nativo do Supabase Auth: `resetPasswordForEmail` → `/auth/confirm` com `verifyOtp(type:'recovery')` → `updateUser({password})`. Template pt-BR + SMTP customizado (remetente Elite Juris). Ver "Pattern 4" e "Code Examples". |
| AUTH-04 | Gestor faz login no painel web; papéis separados (gestor vê tudo, advogado não vê dados dos colegas) | Supabase Auth e-mail/senha + `@supabase/ssr` no Next.js 16 (proxy.ts para refresh de sessão); RLS keyed em `organization_id` com helpers `security definer` lendo `profiles` (revogação imediata, D-11); papéis `super_admin`/`gestor`/`advogado` no schema. Ver "Pattern 1/2/5". |
| AUTH-05 | Gestor convida e remove advogados da organização por e-mail | Tabela `invitations` própria (token hasheado, validade 7 dias, status pending/accepted/cancelled) + envio via Resend + endpoint de aceite com `admin.createUser`. Motivo: links nativos do Supabase expiram em no máx. 24h — não atendem D-09. Remoção = `profiles.status='removed'` + revogação de sessões via Admin API (D-11); reconvite reativa (D-12). Ver "Pattern 3". |
| LGPD-01 | Transcrições e análises armazenadas criptografadas em repouso, em região brasileira (São Paulo) | Projeto Supabase criado em **sa-east-1** (região é imutável pós-criação); criptografia AES-256 em repouso é padrão da plataforma, sempre habilitada. pgsodium/TCE está deprecado — NÃO usar criptografia por coluna na v1. Tabelas centrais (`conversations`, `messages`, `diagnostics`) criadas nesta fase com `organization_id` + cascata de exclusão. Ver "Pitfall 1" e "Assumptions A1". |
</phase_requirements>

## Summary

Esta fase é um problema clássico de SaaS multi-tenant sobre a stack já travada em `.claude/CLAUDE.md`: Supabase (Postgres + Auth + RLS) e Next.js 16 App Router, em monorepo pnpm. A pesquisa confirmou que todos os fluxos exigidos têm caminho oficial e bem documentado, com **uma exceção importante**: o convite nativo do Supabase (`inviteUserByEmail`) tem validade máxima de 24h e não oferece listagem/cancelamento de convites pendentes — insuficiente para D-09 (validade de ~7 dias, reenviar, cancelar) e D-12 (reconvite reativa). A recomendação é uma **tabela `invitations` própria** (token aleatório hasheado, `expires_at`, status) com envio de e-mail via Resend e aceite via Route Handler com `service_role`. A redefinição de senha (AUTH-03), por outro lado, usa o fluxo nativo do Supabase sem customização estrutural — só template pt-BR e SMTP customizado para o remetente Elite Juris (D-13).

Para o isolamento multi-tenant (AUTH-04), o padrão prescrito é RLS em **todas** as tabelas, com policies que obtêm `organization_id` e papel via funções `security definer` (schema `private`) que leem a tabela `profiles` — e não via claims do JWT. Motivo: claims de JWT ficam obsoletos até o refresh do token (~1h), o que violaria D-11 ("perde o acesso imediatamente" na remoção). O custom access token hook ainda é usado, mas apenas como conveniência de UI (o painel sabe o papel sem query extra). Testes cross-tenant rodam com **pgTAP via `supabase test db`** em GitHub Actions (Docker disponível no runner), usando os helpers do basejump (`tests.create_supabase_user`, `tests.authenticate_as`) para simular dois escritórios e provar que nenhuma consulta vaza entre organizações.

Para LGPD-01, a decisão crítica é **criar o projeto Supabase em sa-east-1 desde o primeiro dia** — a região é imutável após a criação. A criptografia em repouso (AES-256) é padrão da plataforma e sempre habilitada; criptografia por coluna via pgsodium/TCE está **deprecada pela Supabase** e não deve ser usada. As tabelas centrais das fases futuras (conversas, mensagens/transcrições, diagnósticos) são criadas já nesta fase com `organization_id` e cascata de exclusão (`ON DELETE CASCADE`), cumprindo a decisão de projeto de que LGPD se resolve no schema, não em retrofit.

**Primary recommendation:** Monorepo pnpm workspaces (sem Turborepo) com `apps/web` (Next.js 16.2 + @supabase/ssr) e `packages/shared`; projeto Supabase hospedado em sa-east-1 + Supabase CLI local para migrations e testes pgTAP; tabela `invitations` própria para convites de 7 dias; RLS com helpers `security definer` lendo `profiles` (não JWT) para revogação imediata; e-mails transacionais via Resend com remetente configurável por env var.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login e-mail/senha, sessão do painel | Frontend Server (Next.js proxy.ts + @supabase/ssr) | Supabase Auth | Cookies httpOnly gerenciados server-side; refresh de token no proxy porque Server Components não escrevem cookies |
| Isolamento multi-tenant (org A não vê org B) | Database (RLS Postgres) | — | Enforced no banco em toda query, independente de bug na aplicação — padrão travado em CLAUDE.md |
| Papéis (super_admin / gestor / advogado) | Database (tabela `profiles` + RLS) | API (Route Handlers para gates de UI) | Fonte de verdade no banco; JWT claims só para conveniência de UI (staleness inaceitável para autorização com D-11) |
| Convite (criar, reenviar, cancelar, aceitar) | API / Backend (Route Handlers com service_role) | Database (tabela `invitations`) | Criação de usuário exige Admin API (service_role) — nunca no cliente |
| Envio de e-mails (convite) | API / Backend (Resend SDK server-side) | — | Chave da Resend é secret; remetente configurável (D-13) |
| Envio de e-mails (reset de senha) | Supabase Auth (SMTP customizado) | — | Fluxo nativo; SMTP Resend configurado no projeto Supabase para remetente Elite Juris |
| Redefinição de senha | Supabase Auth + Frontend Server | — | Fluxo PKCE nativo; página de nova senha no dashboard |
| Criptografia em repouso + região BR | Database / Storage (plataforma Supabase) | — | AES-256 padrão da plataforma; região sa-east-1 escolhida na criação do projeto |
| Testes cross-tenant | Database (pgTAP via supabase test db) | CI (GitHub Actions) | Testa as policies onde elas vivem — no Postgres |
| Interface admin do super-admin | Frontend Server (rota /admin no dashboard) | API (Route Handlers service_role) | Tela mínima; criar org + convidar gestor sem tocar no banco na mão (D-02, discretion) |

## Project Constraints (from CLAUDE.md)

Diretivas do `.claude/CLAUDE.md` que restringem esta fase:

- **Stack travada:** TypeScript, Next.js 16 App Router (painel + API no mesmo deploy), Supabase (Postgres + Auth + RLS em `organization_id`, sa-east-1, criptografia em repouso), Tailwind 4, shadcn/ui, TanStack Query 5, Zod 4, monorepo com extensão WXT (Fase 2).
- **RLS multi-tenant enforced no banco, não na aplicação** — padrão estabelecido.
- **Migrations do Supabase CLI versionadas no repo; testes de RLS com chaves `anon` vs `service_role`.**
- **`@supabase/ssr` no dashboard; `supabase-js` + adapter `chrome.storage` na extensão (Fase 2).**
- **NÃO usar:** NextAuth/Auth.js (usar Supabase Auth); MongoDB/DynamoDB (usar Postgres); chave da Anthropic na extensão (irrelevante nesta fase, mas o proxy server-side nasce aqui como padrão); Plasmo.
- **Drizzle ORM é opcional** — "plain `supabase-js` is enough for v1".
- **Vercel** para hospedar o app Next.js.
- **GSD workflow enforcement:** mudanças de arquivo passam por comandos GSD.
- **Idioma:** interface e conteúdo em pt-BR.

## Standard Stack

Versões verificadas ao vivo no registry npm em 2026-07-08 [VERIFIED: npm registry — todas já constavam da pesquisa de stack em CLAUDE.md, fonte autoritativa do projeto].

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.10 | Painel web + API (Route Handlers) | Travado em CLAUDE.md; App Router; **atenção: `middleware.ts` virou `proxy.ts` no Next 16** [CITED: nextjs.org/docs/messages/middleware-to-proxy] |
| `react` / `react-dom` | 19.2.7 | UI do dashboard | Exigido pelo Next 16 |
| `@supabase/supabase-js` | 2.110.1 | Cliente Supabase (queries + auth) | Travado em CLAUDE.md |
| `@supabase/ssr` | 0.12.0 | Sessão por cookies no App Router | Padrão oficial Supabase para Next.js server-side [CITED: supabase.com/docs/guides/auth/server-side/creating-a-client] |
| `typescript` | **5.9.3 (pin!)** | Linguagem | ⚠️ `npm view typescript version` hoje retorna **7.0.2** — instalar `typescript@~5.9.3` explicitamente; CLAUDE.md trava 5.x. Ver Pitfall 2 |
| `zod` | 4.4.3 | Validação de payloads nos Route Handlers | Travado em CLAUDE.md |
| `tailwindcss` | 4.3.2 | Estilo do dashboard | Travado em CLAUDE.md |
| `resend` | 6.17.2 | Envio de e-mails de convite (API) + SMTP p/ Supabase Auth | Provider recomendado pela própria Supabase para SMTP customizado [CITED: supabase.com/docs/guides/auth/auth-smtp]; escolha dentro da discretion (ver A2) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase` (CLI, devDep) | 2.109.1 | Migrations, stack local, `supabase test db` | Sempre — migrations versionadas são contrato do projeto |
| `@tanstack/react-query` | 5.101.2 | Data fetching no dashboard | Telas de equipe/convites |
| shadcn/ui | latest (CLI) | Componentes do dashboard | Tabelas, dialogs, forms da tela de equipe |
| `vitest` | 4.1.10 | Testes unitários/integração TS | Route Handlers (convite, aceite, remoção) |
| basejump `supabase_test_helpers` | ~0.0.6 (SQL) | Helpers pgTAP (`tests.create_supabase_user`, `tests.authenticate_as`) | Testes cross-tenant em pgTAP [CITED: usebasejump.com/blog/testing-on-supabase-with-pgtap] |
| pnpm | 10.x (via corepack) | Package manager do monorepo | Node 22 já traz corepack: `corepack enable pnpm` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tabela `invitations` própria | `auth.admin.inviteUserByEmail` nativo | Nativo é mais simples, mas expira em ≤24h (limite da plataforma), não lista/cancela convites pendentes e não cobre reativação D-12. Só aceitável se o usuário relaxar D-09 para 24h |
| pgTAP (`supabase test db`) | Testes de integração Vitest + supabase-js contra stack local | Vitest testa o app inteiro mas exige orquestrar auth real no teste; pgTAP testa as policies direto no Postgres, roda com um comando no CI. Usar ambos: pgTAP para RLS, Vitest para Route Handlers |
| RLS via `security definer` lendo `profiles` | RLS via claims do JWT (`auth.jwt()`) | JWT é mais rápido (sem lookup), mas claims ficam obsoletos até o refresh (~1h) — viola D-11 (remoção imediata). Com `(select ...)` initPlan, o lookup roda 1x por query — custo aceitável |
| Resend | AWS SES / Postmark / Brevo | Qualquer SMTP serve para o Supabase Auth; Resend tem DX melhor e SDK Node limpo para os e-mails de convite. Trocável por env var |
| pnpm workspaces puro | Turborepo | Turborepo só agrega cache de build — desnecessário com 2 apps e time solo; adicionar depois se CI ficar lento |

**Installation:**
```bash
# raiz do monorepo
corepack enable pnpm
pnpm init  # + pnpm-workspace.yaml

# apps/web
pnpm create next-app@latest apps/web --typescript --tailwind --app --no-src-dir
pnpm --filter web add @supabase/supabase-js @supabase/ssr zod @tanstack/react-query resend
pnpm --filter web add -D typescript@~5.9.3 vitest

# raiz (devDeps compartilhadas)
pnpm add -D -w supabase typescript@~5.9.3
```

**Version verification:** Todas as versões acima confirmadas com `npm view <pkg> version` em 2026-07-08 [VERIFIED: npm registry].

## Package Legitimacy Audit

Seam `package-legitimacy check` executado em 2026-07-08 (ecosystem npm). Vários pacotes canônicos receberam verdict `SUS` com razão única `too-new` — o **último release** tem menos de ~7 dias (ciclo de release rápido dos projetos), não indício de slopsquatting: todos têm dezenas de milhões de downloads semanais e repositório oficial confirmado.

| Package | Registry | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-------------|---------|-------------|
| react / react-dom | npm | 141M/wk | github.com/facebook/react | OK | Approved |
| zod | npm | 211M/wk | github.com/colinhacks/zod | OK | Approved |
| next | npm | 38M/wk | github.com/vercel/next.js | SUS (too-new) | Flagged — release recente; repo oficial Vercel; planner adiciona verificação leve antes do install (pin de versão 16.2.x resolve) |
| @supabase/supabase-js | npm | 21M/wk | github.com/supabase/supabase-js | SUS (too-new) | Flagged — idem; pin 2.110.x |
| @supabase/ssr | npm | 4.6M/wk | github.com/supabase/ssr | SUS (too-new) | Flagged — idem; pin 0.12.x |
| tailwindcss | npm | 118M/wk | github.com/tailwindlabs/tailwindcss | SUS (too-new) | Flagged — idem; pin 4.3.x |
| typescript | npm | 211M/wk | github.com/microsoft/TypeScript | SUS (too-new) | Flagged — **pin `~5.9.3` obrigatório** (latest é 7.0.2, ver Pitfall 2) |
| vitest | npm | 68M/wk | github.com/vitest-dev/vitest | SUS (too-new) | Flagged — idem; pin 4.1.x |
| supabase (CLI) | npm | 1.9M/wk | github.com/supabase/cli | SUS (too-new) | Flagged — idem; pin 2.109.x |
| @tanstack/react-query | npm | 57M/wk | github.com/TanStack/query | SUS (too-new) | Flagged — idem; pin 5.101.x |
| playwright | npm | 64M/wk | github.com/microsoft/playwright | SUS (too-new) | Flagged — opcional nesta fase |
| resend | npm | 7M/wk | github.com/resend/resend-node | SUS (too-new) | Flagged — sem postinstall; pin 6.17.x |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** todos por `too-new` (recência do último release). Mitigação prescrita ao planner: **pinar versões exatas verificadas acima** (em vez de `latest`) em uma única task de scaffold — isso neutraliza o vetor de release recém-publicado sem checkpoint humano por pacote. Nenhum pacote tem `postinstall` suspeito (verificado para `resend`; demais são canônicos).

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │  Vercel (Next.js 16 App Router)             │
  Browser (gestor/       │                                             │
  super-admin)           │  proxy.ts ── refresh sessão (cookies)       │
      │                  │     │                                       │
      │ HTTPS            │     ▼                                       │
      ├─────────────────▶│  Server Components / Pages (dashboard)      │
      │                  │     │  createServerClient (@supabase/ssr)   │
      │                  │     │  → queries com JWT do usuário (RLS)   │
      │                  │     │                                       │
      │                  │  Route Handlers (API)                       │
      │                  │   ├─ /api/invitations  (service_role) ──────┼──▶ Resend API
      │                  │   ├─ /api/invitations/accept (service_role) │    (e-mail convite,
      │                  │   ├─ /api/members/remove (service_role)     │     remetente Elite Juris)
      │                  │   └─ /auth/confirm (verifyOtp recovery)     │
      │                  └───────────────┬─────────────────────────────┘
      │                                  │
      │                                  ▼
      │                  ┌─────────────────────────────────────────────┐
      │                  │  Supabase (sa-east-1 São Paulo)             │
      │  reset de senha  │                                             │
      └─────────────────▶│  Auth (GoTrue) ── SMTP customizado (Resend) │
         (e-mail nativo) │     │ custom access token hook (claims UI)  │
                         │     ▼                                       │
                         │  Postgres + RLS (AES-256 em repouso)        │
                         │   organizations ─ profiles ─ invitations    │
                         │   conversations ─ messages ─ diagnostics    │
                         │   (todas com organization_id + RLS)         │
                         └─────────────────────────────────────────────┘

  CI (GitHub Actions): supabase start (Docker) → migrations → supabase test db (pgTAP cross-tenant)
```

Fluxo primário (convite): gestor clica "Convidar" no dashboard → Route Handler valida (Zod) + confere papel gestor → insere em `invitations` (token hasheado, expires_at = now()+7d) → envia e-mail via Resend → convidado abre `/convite/[token]` → formulário nome+senha → Route Handler (service_role) valida token/validade → `auth.admin.createUser({email_confirm: true})` ou reativa perfil removido → insere/atualiza `profiles` → marca convite `accepted` → redireciona para login.

### Recommended Project Structure

```
/ (raiz do monorepo)
├── pnpm-workspace.yaml        # packages: apps/*, packages/*
├── package.json               # devDeps compartilhadas (supabase CLI, typescript)
├── apps/
│   └── web/                   # Next.js 16 — painel + API (apps/extension chega na Fase 2)
│       ├── proxy.ts           # refresh de sessão (ex-middleware.ts)
│       ├── app/
│       │   ├── (auth)/login/  ├── (auth)/recuperar-senha/  ├── (auth)/nova-senha/
│       │   ├── (auth)/convite/[token]/        # aceite de convite (nome + senha)
│       │   ├── (dashboard)/equipe/            # lista membros + convites pendentes
│       │   ├── (dashboard)/sem-acesso/        # aviso pt-BR para advogado (D-07)
│       │   ├── admin/                         # super-admin: criar org + convidar gestor (D-02)
│       │   ├── auth/confirm/route.ts          # verifyOtp (recovery)
│       │   └── api/invitations/ · api/members/
│       └── lib/supabase/      # createServerClient / createBrowserClient / admin client
├── packages/
│   └── shared/                # tipos, schemas Zod compartilhados (extensão usará na Fase 2)
└── supabase/
    ├── config.toml            # config local (auth, templates de e-mail versionados)
    ├── migrations/            # SQL versionado (schema + RLS + hook)
    └── tests/                 # pgTAP: 00-setup.sql, 01-rls-cross-tenant.test.sql, ...
```

### Pattern 1: RLS multi-tenant com helpers `security definer` (autorização no banco)

**What:** Toda tabela de domínio tem `organization_id not null references organizations(id)` e RLS habilitado. Policies obtêm org e papel do usuário via funções `security definer` em schema `private`, lendo `profiles` com `status = 'active'`.
**When to use:** Todas as tabelas. É o padrão de autorização do produto inteiro.
**Why not JWT claims:** claims ficam obsoletos até o refresh do token — advogado removido continuaria lendo dados por até ~1h, violando D-11. O lookup em `profiles` reflete a remoção imediatamente. [CITED: supabase.com/docs/guides/database/postgres/row-level-security — "A JWT is not always 'fresh' ... will not be reflected using auth.jwt() until the user's JWT is refreshed"]

```sql
-- Source: adaptado de supabase.com/docs/guides/database/postgres/row-level-security
create schema if not exists private;

create or replace function private.current_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select organization_id from public.profiles
  where user_id = (select auth.uid()) and status = 'active'
$$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'super_admin' and status = 'active'
  )
$$;

alter table public.conversations enable row level security;

create policy "org members read own org conversations"
on public.conversations for select
to authenticated
using (
  organization_id = (select private.current_org_id())
  or (select private.is_super_admin())
);
```

Regras de performance obrigatórias [CITED: supabase.com/docs/guides/database/postgres/row-level-security]:
- **Sempre** envolver `auth.uid()`, `auth.jwt()` e funções `security definer` em `(select ...)` — o otimizador roda 1x por query (initPlan), ~95% mais rápido.
- **Sempre** declarar `to authenticated` — evita avaliar policy para `anon` (~99.7% mais rápido).
- Criar índice btree em `organization_id` de toda tabela com policy.

### Pattern 2: Papéis no schema + custom access token hook (claims só para UI)

**What:** Enum `user_role ('super_admin','gestor','advogado')` na tabela `profiles` (fonte de verdade). O custom access token hook injeta `user_role` e `organization_id` em `app_metadata` do JWT **apenas** para o dashboard decidir o que renderizar sem query extra (ex.: bloquear advogado no painel, D-07). Autorização de dados continua nas policies do Pattern 1.
**When to use:** Configurar o hook na migration inicial; dashboard lê claims para gates de UI; nunca usar claims como única barreira de acesso a dados.

```sql
-- Source: supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb; p record;
begin
  select role, organization_id into p
  from public.profiles where user_id = (event->>'user_id')::uuid and status = 'active';
  claims := event->'claims';
  if p is not null then
    claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(p.role::text));
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(p.organization_id::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end; $$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
```

O hook precisa ser habilitado em Auth > Hooks (dashboard) e em `supabase/config.toml` para o ambiente local [CITED: supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook].

### Pattern 3: Convites com tabela própria (7 dias, reenviar, cancelar, reativar)

**What:** Tabela `invitations(id, organization_id, email, role, token_hash, expires_at, status, invited_by, created_at)`. Token = 32 bytes aleatórios (`crypto.randomBytes`), enviado no link, armazenado **hasheado** (SHA-256). Status: `pending | accepted | cancelled | expired`.
**When to use:** Convite de gestor (pelo super-admin, D-03) e de advogado (pelo gestor, D-09) — um fluxo único.
**Why:** links nativos do Supabase (`inviteUserByEmail`, `generateLink`) expiram conforme o "email OTP expiration", máx. 24h [CITED: github.com/orgs/supabase/discussions/27224 + docs Auth Settings] — não atendem D-09 (7 dias) nem oferecem listagem/cancelamento; e o aceite customizado é o ponto natural para a reativação D-12.

Fluxo de aceite (Route Handler, service_role):
1. Busca convite por `token_hash` com `status='pending'` e `expires_at > now()`.
2. **Reativação (D-12):** se já existe usuário Auth com o e-mail e `profiles.status='removed'` na mesma org → `admin.updateUserById` (unban + nova senha), `profiles.status='active'` — histórico preservado.
3. Caso novo: `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` + insert em `profiles`.
4. Marca convite `accepted`. Reenviar = novo token + novo e-mail (invalida o anterior); cancelar = `status='cancelled'`.

Remoção (D-11): `profiles.status='removed'` (nunca delete) + `auth.admin.signOut(user_id, 'global')` e/ou ban via `admin.updateUserById({ ban_duration: '876000h' })` para matar sessões ativas. RLS do Pattern 1 já nega novas queries imediatamente. [ASSUMED — combinação exata de signOut global + ban precisa ser confirmada na implementação; a semântica de revogação de refresh tokens do GoTrue deve ser testada]

### Pattern 4: Redefinição de senha (fluxo nativo PKCE)

**What:** Fluxo oficial Supabase para SSR [CITED: supabase.com/docs/guides/auth/passwords]:
1. Página "Esqueci minha senha" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<site>/auth/confirm?next=/nova-senha' })`. `redirectTo` precisa estar na allow-list de Redirect URLs.
2. Template de e-mail (pt-BR, remetente Elite Juris) com link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-senha`.
3. Route Handler `/auth/confirm`: `supabase.auth.verifyOtp({ type: 'recovery', token_hash })` → sessão estabelecida → redirect para `/nova-senha`.
4. Página nova senha: `supabase.auth.updateUser({ password })`.

Discretion aplicada: validade do link de reset = **1 hora** (configurar `otp_expiry` / e-mail link expiry); política de senha = **mínimo 8 caracteres** (configurável em Auth settings). Proteção contra senhas vazadas (HaveIBeenPwned) é plan-gated — ligar quando o projeto estiver em plano Pro (ver A3).

### Pattern 5: Sessão no Next.js 16 — `proxy.ts`, não `middleware.ts`

**What:** Next 16 renomeou `middleware.ts` → `proxy.ts` e a função exportada `middleware` → `proxy` [CITED: nextjs.org/docs/messages/middleware-to-proxy]. O proxy roda em runtime Node.js por padrão (sem a fricção antiga de Edge com `@supabase/ssr`). Responsabilidades do proxy: refresh de token expirado (Server Components não escrevem cookies), redirect de não-autenticados para `/login`, e redirect de advogado (claim `user_role='advogado'`) para `/sem-acesso` (D-07). Autorização de dados fica no RLS.
**Gotcha:** a maioria dos tutoriais e até partes das docs Supabase ainda mostram `middleware.ts` — adaptar o snippet oficial (`updateSession`) para `proxy.ts` com `export function proxy(...)`. `cookies()` do Next é assíncrono (`await cookies()`).

### Pattern 6: Schema forward-looking com cascata LGPD

**What:** Criar nesta fase as tabelas centrais das fases 2–5 — `conversations`, `messages` (transcrição), `diagnostics` — mesmo sem uso ainda, com: `organization_id not null` (RLS desde o dia 1), `profile_id` do advogado (histórico sobrevive à remoção via `status='removed'`, D-11), e cadeia `ON DELETE CASCADE` a partir de `organizations` e de `conversations` (LGPD-04 chega na Fase 6, mas a cascata é decidida agora). Os testes cross-tenant cobrem essas tabelas desde já — e o success criterion 5 (transcrições gravadas criptografadas em sa-east-1) é demonstrável com um insert real via app.

### Anti-Patterns to Avoid

- **Autorizar por claims do JWT (`auth.jwt()`) como única barreira:** claims obsoletos até refresh; remoção não teria efeito imediato (viola D-11). Usar lookup em `profiles` via security definer.
- **Usar `raw_user_meta_data` em policies:** o usuário pode editar os próprios `user_metadata` — inseguro para autorização. Só `app_metadata`/tabelas servem. [CITED: docs RLS Supabase]
- **`service_role` no cliente ou em env `NEXT_PUBLIC_*`:** bypassa RLS; só em Route Handlers server-side.
- **Criptografia por coluna com pgsodium/TCE:** deprecada pela Supabase, alto risco de misconfiguração [CITED: supabase.com/docs/guides/database/extensions/pgsodium]. AES-256 da plataforma cobre LGPD-01.
- **Tabela sem RLS habilitado:** default do Postgres é sem RLS — habilitar na mesma migration que cria a tabela; incluir teste pgTAP que varre `pg_tables` e falha se alguma tabela `public` estiver sem RLS.
- **Views sem `security_invoker`:** views executam com permissão do dono e podem vazar através do RLS — criar views com `security_invoker = true` (PG15+). [ASSUMED — confirmar se alguma view será criada nesta fase]
- **Deletar usuário na remoção:** apaga histórico via FK — viola D-11. Sempre soft-removal em `profiles.status`.
- **e-mail hardcoded:** remetente/branding em env vars (`EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`) — D-13 exige troca de marca sem retrabalho.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autenticação, hash de senha, sessão | Sistema de login próprio | Supabase Auth (GoTrue) | bcrypt/argon, refresh tokens, PKCE, rate limits — tudo resolvido e auditado |
| Isolamento multi-tenant | Filtros `where organization_id = ?` na aplicação | RLS no Postgres | Um `where` esquecido = vazamento entre escritórios; RLS falha fechado |
| Fluxo de reset de senha | Tokens de reset próprios | `resetPasswordForEmail` + `verifyOtp` | Fluxo nativo com expiração, invalidação e template — só customizar texto/remetente |
| Entrega de e-mail | SMTP próprio / sendmail | Resend (API + SMTP) | Deliverability, SPF/DKIM no domínio elitejuris.com.br, bounce handling |
| Harness de teste de RLS | Mocks de JWT manuais em SQL | basejump `supabase_test_helpers` | `tests.authenticate_as()` troca o contexto de usuário corretamente (JWT claims + role) dentro do pgTAP |
| Criptografia em repouso | pgcrypto/pgsodium por coluna | AES-256 da plataforma Supabase | pgsodium deprecado; plataforma cobre LGPD-01 sem gestão de chaves própria |
| Migrations | Scripts SQL ad-hoc | Supabase CLI (`supabase migration new/up`, `db push`) | Versionamento, diff, replay idêntico no CI |

**Key insight:** o único componente legitimamente "custom" desta fase é a tabela `invitations` + endpoint de aceite — e mesmo ele delega criação de usuário, senha e sessão ao Supabase Auth. Todo o resto é configuração de plataforma + SQL de policies.

## Common Pitfalls

### Pitfall 1: Região errada na criação do projeto Supabase
**What goes wrong:** Projeto criado em us-east-1 (default) — LGPD-01 exige São Paulo e a região é **imutável** após a criação (migrar = novo projeto + dump/restore).
**How to avoid:** Primeira task de infra: criar o projeto explicitamente em **sa-east-1 (South America — São Paulo)**. Registrar screenshot/ID do projeto como evidência do criterion 5.
**Warning signs:** URL do projeto/latência; `Settings > General > Region` no dashboard.

### Pitfall 2: `npm install typescript` instala TypeScript 7
**What goes wrong:** `latest` no npm hoje é **7.0.2** (port nativo); a stack do projeto trava 5.x e o ecossistema (Next 16 toolchain) foi validado com 5.9. [VERIFIED: npm registry 2026-07-08]
**How to avoid:** Pinar `typescript@~5.9.3` em todos os package.json. 
**Warning signs:** erros estranhos de build/tsconfig logo após scaffold.

### Pitfall 3: Policies lentas por falta de `(select ...)` e `to authenticated`
**What goes wrong:** `using (auth.uid() = user_id)` reavalia a função por linha; sem `to authenticated`, policies rodam até para `anon`.
**How to avoid:** Convenção obrigatória: todo `auth.*()`/helper em `(select ...)`; todo policy com `to authenticated`; índice em `organization_id`. [CITED: docs RLS — ganhos de ~95% e ~99.7%]
**Warning signs:** dashboard lento com poucas linhas; `explain analyze` mostrando SubPlan em vez de InitPlan.

### Pitfall 4: Achar que remoção via JWT claim é imediata
**What goes wrong:** Advogado removido segue com JWT válido por até 1h; se o RLS depender de claims, ele continua lendo dados do escritório.
**How to avoid:** Pattern 1 (lookup em `profiles`) + revogar sessões via Admin API na remoção. Teste automatizado: remover usuário e assertar que a query seguinte retorna 0 linhas **sem** refresh de token.
**Warning signs:** teste de remoção só passa depois de re-login.

### Pitfall 5: SMTP default do Supabase em teste real
**What goes wrong:** O SMTP embutido só entrega para membros do time do projeto e tem limite de **2 e-mails/hora** — convites/resets para e-mails reais somem silenciosamente. [CITED: supabase.com/docs/guides/auth/auth-smtp]
**How to avoid:** Configurar SMTP customizado (Resend) com domínio `elitejuris.com.br` (SPF/DKIM) antes de qualquer teste com e-mail real; após habilitar, subir o rate limit default de 30/h conforme necessidade. Local: Mailpit do `supabase start` captura e-mails sem enviar.
**Warning signs:** e-mail "não chegou" em conta externa; logs de auth com rate limit.

### Pitfall 6: Seguir tutorial com `middleware.ts` no Next 16
**What goes wrong:** Docs/tutoriais (inclusive Supabase) ainda mostram `middleware.ts`; no Next 16 o arquivo é `proxy.ts` e a função `proxy` — o middleware antigo é ignorado/depreciado.
**How to avoid:** Criar `proxy.ts` desde o início; `cookies()` é assíncrono. [CITED: nextjs.org/docs/messages/middleware-to-proxy]
**Warning signs:** sessão expira e não renova; usuário deslogado "aleatoriamente" ao navegar entre Server Components.

### Pitfall 7: Docker ausente na máquina de dev
**What goes wrong:** `supabase start` e `supabase test db` exigem Docker — **não instalado nesta máquina** (verificado 2026-07-08). Sem ele, não há stack local nem pgTAP local.
**How to avoid:** Plano deve incluir task/checkpoint: instalar Docker Desktop ou OrbStack (macOS). Fallback viável para o walking skeleton: desenvolver contra o projeto hospedado (sa-east-1) com `supabase db push`, e rodar pgTAP apenas no CI (runners do GitHub Actions têm Docker).
**Warning signs:** `supabase start` falha com "Cannot connect to the Docker daemon".

### Pitfall 8: Convite nativo do Supabase não fecha com D-09/D-12
**What goes wrong:** `inviteUserByEmail` expira em ≤24h (limite de OTP), não expõe lista de convites pendentes nem cancelamento, e cria o usuário no ato do convite (complica reativação/cancelamento).
**How to avoid:** Tabela `invitations` própria (Pattern 3). Não misturar os dois mecanismos.
**Warning signs:** convite "expirado" no dia seguinte; e-mail já registrado no Auth ao cancelar convite.

### Pitfall 9: Hook de access token não habilitado no ambiente local/CI
**What goes wrong:** O hook existe como função SQL mas o GoTrue só o chama se estiver habilitado — no hospedado via dashboard (Auth > Hooks), no local via `supabase/config.toml` (`[auth.hook.custom_access_token]`). Claims ausentes quebram os gates de UI silenciosamente.
**How to avoid:** Versionar a habilitação no `config.toml`; teste que decodifica o JWT após login e asserta os claims.

## Code Examples

### Cliente Supabase server-side (App Router, Next 16)
```typescript
// Source: supabase.com/docs/guides/auth/server-side/creating-a-client (adaptado p/ Next 16)
// apps/web/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // async no Next 15+
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => all.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  )
}
```

### proxy.ts (refresh de sessão + gate do painel)
```typescript
// Source: padrão updateSession da Supabase, adaptado para Next 16 proxy
// apps/web/proxy.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy-session'

export async function proxy(request: NextRequest) {
  // updateSession: cria createServerClient com cookies do request,
  // chama supabase.auth.getUser() (refresh se expirado) e devolve response
  // com cookies atualizados; redireciona p/ /login se não autenticado
  // e p/ /sem-acesso se user_role === 'advogado' (D-07)
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|convite|auth).*)'],
}
```

### Teste pgTAP cross-tenant (o teste que prova o criterion 4)
```sql
-- Source: padrão basejump supabase_test_helpers (usebasejump.com/blog/testing-on-supabase-with-pgtap)
-- supabase/tests/01-cross-tenant.test.sql
begin;
select plan(4);

-- setup como service_role: duas orgs, um usuário em cada
select tests.create_supabase_user('gestor_a');
select tests.create_supabase_user('gestor_b');
-- (inserts em organizations/profiles/conversations para org A e org B via service_role)

select tests.authenticate_as('gestor_a');
select results_eq(
  'select count(*) from conversations',
  ARRAY[1::bigint],
  'gestor A vê somente a conversa da própria organização'
);
select is_empty(
  $$ select * from conversations where organization_id = tests.get_org('b') $$,
  'gestor A não vê nenhuma linha da organização B'
);

select tests.authenticate_as('gestor_b');
select is_empty(
  $$ select * from profiles where organization_id = tests.get_org('a') $$,
  'gestor B não vê membros da organização A'
);

-- toda tabela public tem RLS ligado
select results_eq(
  $$ select count(*) from pg_tables where schemaname='public' and not rowsecurity $$,
  ARRAY[0::bigint],
  'nenhuma tabela public sem RLS'
);

select * from finish();
rollback;
```

### CI GitHub Actions (pgTAP)
```yaml
# Source: supabase.com/docs/guides/deployment/ci/testing
name: db-tests
on: pull_request
jobs:
  rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase test db
```

### Envio do e-mail de convite (Resend, remetente configurável — D-13/D-14)
```typescript
// Source: resend.com docs (padrão SDK Node) — server-side only
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`, // "Elite Juris <nao-responda@elitejuris.com.br>"
  to: invitation.email,
  subject: 'Você foi convidado para a equipe', // pt-BR, direto, sem emoji (D-14)
  html: renderInviteEmail({ inviteUrl, organizationName, expiresInDays: 7 }),
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` / `export function middleware` | `proxy.ts` / `export function proxy` (runtime Node por padrão) | Next.js 16 (out/2025) | Todos os snippets Supabase de sessão precisam de adaptação de nome; fim da fricção Edge-runtime |
| pgsodium TCE / Server Key Management para colunas | Criptografia da plataforma (AES-256) + Vault só para secrets | Deprecação anunciada 2024–2025 | Não desenhar criptografia por coluna na v1 |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Usar somente `@supabase/ssr`; tutoriais antigos com auth-helpers estão obsoletos |
| `app_metadata` atualizado via Admin API para claims | Custom access token hook (função SQL) | GA ~2024 | Claims computados no login a partir de tabela — sem sincronização manual |
| TypeScript 5.x como `latest` | `latest` = 7.0.2 (port nativo Go) | 2026 | Pinar `~5.9.3` explicitamente (stack contract) |

**Deprecated/outdated:**
- `@supabase/auth-helpers-*`: substituído por `@supabase/ssr`.
- pgsodium (standalone): "pending deprecation", sem novos usos recomendados [CITED: supabase.com/docs/guides/database/extensions/pgsodium].
- `middleware.ts` no Next 16: renomeado, codemod disponível (`npx @next/codemod middleware-to-proxy`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Criptografia em repouso da plataforma (AES-256, disco) **satisfaz LGPD-01** ("criptografadas em repouso") sem criptografia por coluna adicional | Summary / Pattern 6 | Se o dono/DPO exigir criptografia por coluna (application-level), o design de leitura das transcrições muda (chaves, busca). Confirmar interpretação com o dono antes de fechar o criterion 5 |
| A2 | **Resend** como provedor de e-mail (API para convites + SMTP para o Supabase Auth) | Standard Stack | Baixo — qualquer SMTP serve; troca é configuração. Requer acesso DNS de elitejuris.com.br para SPF/DKIM (dependência do dono) |
| A3 | Proteção contra senhas vazadas (HaveIBeenPwned) é recurso pago (plano Pro) do Supabase Auth | Pattern 4 | Baixo — se for free, ligar já; senão fica para quando assinar Pro |
| A4 | Plano free do Supabase basta para o walking skeleton; **Pro recomendado antes do beta** (backups PITR, suporte, limites de auth) | Environment | Custo (~US$25/mês) e timing da assinatura; sem Pro, alguns controles LGPD operacionais (backup/retention) ficam mais fracos |
| A5 | Semântica exata de revogação imediata de sessão na remoção (`admin.signOut(user_id)` global + ban) funciona como descrito | Pattern 3 | Se refresh tokens não forem revogados como esperado, o teste de remoção imediata falha — validar na implementação (o RLS por lookup já mitiga o vazamento de dados) |
| A6 | Funções Vercel podem/devem rodar em `gru1` (São Paulo) para latência; **não** é requisito LGPD-01 (que trata de dados em repouso, cobertos pelo Supabase sa-east-1) | Deployment | Baixo — configuração de região no vercel.json; interpretação de residência de processamento a confirmar com o dono se houver dúvida jurídica |
| A7 | `basejump-supabase_test_helpers` instala-se copiando o SQL para `supabase/tests/` (ou via dbdev) e é compatível com a CLI 2.x atual | Validation | Se incompatível, escrever helpers próprios (~50 linhas de SQL) ou usar Vitest+supabase-js como harness principal dos testes cross-tenant |
| A8 | Validade de 7 dias para convite e 1h para link de reset são aceitáveis (discretion explícita do CONTEXT.md) | Pattern 3/4 | Nenhum — coberto pela discretion |

## Open Questions

1. **Acesso DNS ao domínio elitejuris.com.br (SPF/DKIM para Resend)**
   - What we know: D-13 exige remetente `nao-responda@elitejuris.com.br`; Resend exige verificação de domínio via DNS.
   - What's unclear: quem configura os registros DNS e quando.
   - Recommendation: planner deve incluir `checkpoint:human-verify` — o dono (ou responsável pelo domínio) adiciona os registros; até lá, testes usam Mailpit local/sandbox.
2. **Criptografia por coluna é exigência real do dono ou basta a da plataforma? (ver A1)**
   - What we know: LGPD-01 diz "criptografadas em repouso"; plataforma cobre por default; pgsodium deprecado.
   - What's unclear: expectativa do dono sobre "criptografia" (marketing/juridicamente pode querer mais).
   - Recommendation: seguir com plataforma-only na v1 e registrar a decisão para o dono confirmar no verify-work.
3. **Onde roda o e-mail de convite em dev/CI sem vazar e-mails reais**
   - What we know: `supabase start` inclui Mailpit para e-mails do Auth; e-mails do Resend (convite) são chamadas de API externas.
   - Recommendation: abstrair o envio atrás de uma interface com driver `console/mailpit` em dev e `resend` em prod (env var), permitindo testes de integração sem rede.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tudo | ✓ | v22.23.0 | — |
| npm | bootstrap | ✓ | 10.9.8 | — |
| pnpm | monorepo | ✗ | — | `corepack enable pnpm` (corepack já vem no Node 22 — resolve sem instalação global) |
| git | repo | ✓ | 2.50.1 | — |
| **Docker** | `supabase start` / `supabase test db` local | ✗ | — | **Instalar Docker Desktop ou OrbStack** (checkpoint no plano); fallback: dev contra projeto hospedado + pgTAP só no CI (runners GitHub têm Docker) |
| Supabase CLI | migrations, testes | ✗ | — | devDep npm `supabase@2.109.1` (`pnpm dlx supabase ...`) — não precisa de install global |
| Vercel CLI | deploy do skeleton | ✗ | — | Deploy via integração GitHub→Vercel (sem CLI) ou `pnpm dlx vercel` |
| gh CLI | CI/PRs | ✓ | instalado | — |
| Conta Supabase (projeto sa-east-1) | LGPD-01 | ? (externa) | — | Sem fallback — criação do projeto é task com envolvimento do dono (billing/e-mail da conta) |
| Conta Resend + DNS elitejuris.com.br | e-mails reais | ? (externa) | — | Mailpit local / driver console até o domínio ser verificado |

**Missing dependencies with no fallback:**
- Conta/projeto Supabase em sa-east-1 (bloqueia criterion 5; task inicial com o dono).

**Missing dependencies with fallback:**
- pnpm (corepack), Supabase CLI (devDep npm), Vercel CLI (integração GitHub), Docker (dev contra hospedado + CI para testes — mas instalar Docker é fortemente recomendado para DX e Mailpit local).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pgTAP (via `supabase test db`, CLI 2.109.x) + Vitest 4.1.x |
| Config file | none — Wave 0 (criar `supabase/tests/` e `vitest.config.ts`) |
| Quick run command | `pnpm dlx supabase test db` (local, exige Docker) / `pnpm --filter web vitest run` |
| Full suite command | `supabase start && supabase test db && pnpm -r vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-04 | Cross-tenant: org A não lê dados da org B (todas as tabelas) | pgTAP | `supabase test db` (01-cross-tenant.test.sql) | ❌ Wave 0 |
| AUTH-04 | Advogado não lê conversas/perfis de colegas; gestor lê tudo da org | pgTAP | `supabase test db` (02-roles.test.sql) | ❌ Wave 0 |
| AUTH-04 | Advogado no painel web → redirect /sem-acesso (D-07) | integration | `vitest run tests/proxy-gate.test.ts` | ❌ Wave 0 |
| AUTH-05 | Convite: criar/reenviar/cancelar/expirar; aceite cria usuário; reconvite reativa (D-12) | integration (Vitest, route handlers vs stack local) | `vitest run tests/invitations.test.ts` | ❌ Wave 0 |
| AUTH-05 | Remoção: status removed + queries seguintes retornam 0 linhas sem refresh (D-11) | pgTAP + integration | `supabase test db` (03-removal.test.sql) | ❌ Wave 0 |
| AUTH-03 | Reset de senha ponta-a-ponta (e-mail capturado no Mailpit local) | integration/manual | manual-only no MVP (Mailpit UI) — justificativa: orquestrar captura de e-mail em teste automatizado excede MVP; rota `/auth/confirm` tem teste unitário | ❌ Wave 0 |
| LGPD-01 | Projeto em sa-east-1 + criptografia em repouso | manual-only (atestado de plataforma) — justificativa: propriedade da infra Supabase, não testável em código; evidência = região no dashboard + docs de encryption | — |
| LGPD-01 | Transcrição gravada de fato no banco (insert real em `messages`) | pgTAP/integration | incluído no cross-tenant test (tabelas centrais existem e aceitam escrita) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter web vitest run` (rápido, sem Docker) + `supabase test db` quando a task tocar SQL/migrations
- **Per wave merge:** `supabase start && supabase test db && pnpm -r vitest run`
- **Phase gate:** suíte completa verde no CI (GitHub Actions) antes de `/gsd-verify-work` — criterion 4 exige exatamente isso

### Wave 0 Gaps
- [ ] `supabase/tests/00-helpers.sql` — basejump supabase_test_helpers (copiado/instalado)
- [ ] `supabase/tests/01-cross-tenant.test.sql` — cobre AUTH-04 / criterion 4
- [ ] `supabase/tests/02-roles.test.sql` — papéis gestor/advogado/super_admin
- [ ] `supabase/tests/03-removal.test.sql` — D-11 revogação imediata
- [ ] `apps/web/vitest.config.ts` + `tests/` — route handlers de convite
- [ ] `.github/workflows/db-tests.yml` — supabase/setup-cli + `supabase test db`
- [ ] Framework install: `pnpm add -D -w supabase vitest` (pnpm via corepack)

## Security Domain

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (e-mail/senha); política de senha min 8; sem senha temporária circulando (D-03 — convite define a própria senha) |
| V3 Session Management | yes | Cookies httpOnly via `@supabase/ssr`; refresh no proxy.ts; revogação de sessão na remoção (signOut global/ban) |
| V4 Access Control | yes | RLS no Postgres (deny-by-default, `to authenticated`); papéis em `profiles`; service_role só server-side; super-admin atravessa policies de forma explícita e auditável |
| V5 Input Validation | yes | Zod 4 em todo Route Handler (e-mail, token de convite, payloads) |
| V6 Cryptography | yes | AES-256 da plataforma (nunca hand-roll); tokens de convite: `crypto.randomBytes(32)` + SHA-256 em repouso; TLS em trânsito |
| V13 API | yes | Route Handlers autenticados; rate limit de convites (evitar spam por gestor comprometido) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vazamento cross-tenant por query sem filtro | Information Disclosure | RLS deny-by-default + teste pgTAP que falha se qualquer tabela public estiver sem RLS |
| Escalada via `user_metadata` editável | Elevation of Privilege | Nunca usar `raw_user_meta_data` em policies; papel vive em `profiles`, alterável só por gestor/super-admin via policy |
| Token de convite adivinhável/reutilizável | Spoofing | 32 bytes aleatórios, hasheado no banco, single-use (status), expiração 7d, invalidação no reenvio |
| service_role key exposta | Elevation of Privilege | Env server-side only (nunca `NEXT_PUBLIC_`); secret no Vercel; nunca no repositório |
| Sessão viva após remoção | Broken Access Control | RLS por lookup em `profiles.status` + revogação de sessões na remoção + teste D-11 |
| Enumeração de e-mails no reset/convite | Information Disclosure | Resposta idêntica exista ou não o e-mail ("se existir, enviamos o link") |
| Open redirect no fluxo de auth | Tampering | `redirectTo` restrito à allow-list de Redirect URLs do Supabase; validar `next` param contra paths internos |
| Super-admin como backdoor silencioso | Repudiation | Acesso super-admin via rotas dedicadas com registro em `audit_log` (tabela simples nesta fase — org acessada, quem, quando) |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-07-08) — todas as versões da Standard Stack verificadas ao vivo
- `.claude/CLAUDE.md` — pesquisa de stack anterior do projeto (fonte autoritativa interna; versões e decisões travadas)

### Secondary (MEDIUM confidence — docs oficiais via WebFetch/WebSearch, corroboradas)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — performance de policies, claims, service_role
- [Supabase custom access token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — assinatura, grants, claims obrigatórios
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) — limites do SMTP default (2/h), providers, remetente
- [Supabase password reset](https://supabase.com/docs/guides/auth/passwords) — fluxo PKCE token_hash/verifyOtp/updateUser
- [Supabase CI testing](https://supabase.com/docs/guides/deployment/ci/testing) + [testing overview](https://supabase.com/docs/guides/local-development/testing/overview) + [pgTAP extended](https://supabase.com/docs/guides/local-development/testing/pgtap-extended) — `supabase test db` no GitHub Actions
- [basejump pgTAP guide](https://usebasejump.com/blog/testing-on-supabase-with-pgtap) — helpers `tests.authenticate_as`
- [Next.js middleware→proxy](https://nextjs.org/docs/messages/middleware-to-proxy) + [discussão vercel/next.js #84842](https://github.com/vercel/next.js/discussions/84842) — rename no Next 16
- [pgsodium pending deprecation](https://supabase.com/docs/guides/database/extensions/pgsodium) + [discussion #18849](https://github.com/orgs/supabase/discussions/18849) — não usar TCE
- [Supabase discussion #27224](https://github.com/orgs/supabase/discussions/27224) — expiração de link de convite (24h)
- [Monorepo WXT + Next.js](https://weberdominik.com/blog/monorepo-wxt-nextjs/) + [pnpm workspaces](https://pnpm.io/next/workspaces) — estrutura do monorepo

### Tertiary (LOW confidence — marcar para validação na implementação)
- Semântica exata de revogação de refresh tokens no GoTrue (A5)
- Plan-gating da proteção de senhas vazadas (A3)
- Compatibilidade basejump helpers × CLI 2.x atual (A7)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versões verificadas ao vivo; stack já travada em CLAUDE.md com pesquisa própria
- Architecture (RLS/auth/convites): MEDIUM-HIGH — padrões de docs oficiais Supabase; a decisão "tabela invitations própria" deriva de limite documentado da plataforma (24h) + requisitos D-09/D-12
- Pitfalls: MEDIUM — mistura de docs oficiais (SMTP, RLS perf, região) e achados verificados no ambiente (Docker ausente, TS 7 como latest)
- LGPD-01: MEDIUM — plataforma cobre o requisito como escrito; interpretação registrada em A1 para confirmação do dono

**Research date:** 2026-07-08
**Valid until:** ~2026-08-08 (30 dias — stack estável; revalidar versões npm no início da execução)
