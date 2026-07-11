---
phase: 01-funda-o-backend-multi-tenant
reviewed: 2026-07-11T12:33:29Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - apps/web/app/(auth)/convite/[token]/accept-form.tsx
  - apps/web/app/(dashboard)/equipe/member-actions.tsx
  - apps/web/app/(dashboard)/equipe/page.tsx
  - apps/web/app/(dashboard)/layout.tsx
  - apps/web/app/admin/create-org-form.tsx
  - apps/web/app/admin/page.tsx
  - apps/web/app/api/admin/organizations/route.ts
  - apps/web/app/api/invitations/_helpers.ts
  - apps/web/app/api/invitations/route.ts
  - apps/web/app/api/members/[userId]/route.ts
  - apps/web/app/auth/confirm/route.ts
  - apps/web/app/layout.tsx
  - apps/web/lib/audit.ts
  - apps/web/lib/invitations/create.ts
  - apps/web/lib/supabase/proxy-session.ts
  - apps/web/package.json
  - apps/web/tests/auth-confirm.test.ts
  - apps/web/tests/invitations.test.ts
  - apps/web/tests/members-admin.test.ts
  - apps/web/tests/proxy-gate.test.ts
  - apps/web/tests/skeleton.test.ts
  - packages/shared/src/database.types.ts
  - packages/shared/src/index.ts
  - scripts/seed.ts
  - supabase/config.toml
  - supabase/migrations/20260710012345_initial_schema.sql
  - supabase/migrations/20260711020000_auth_admin_profiles_policy.sql
  - supabase/templates/recovery.html
findings:
  critical: 2
  warning: 10
  info: 7
  total: 19
status: issues_found
---

# Fase 01: Relatório de Code Review

**Revisado:** 2026-07-11T12:33:29Z
**Profundidade:** standard
**Arquivos revisados:** 28 (+ cross-referência dos módulos importados: `lib/invitations/token.ts`, `lib/supabase/admin.ts`, `lib/supabase/env.ts`, `lib/email/index.ts`, `app/api/invitations/accept/route.ts`, `proxy.ts`, `vitest.config.ts`)
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

A fundação multi-tenant está bem estruturada nos pontos que mais importam: RLS keyed em `organization_id` com funções `security definer` e `search_path = ''`, tokens de convite de 32 bytes armazenados apenas como SHA-256, soft-removal com ban, papéis lidos das claims do JWT no proxy (padrão aceito do projeto), e escrita de auditoria exclusivamente via `service_role`. Os testes de integração cobrem os fluxos críticos de isolamento entre organizações.

Ainda assim, a revisão adversarial encontrou **2 problemas críticos** e **10 warnings**. Os críticos: (1) um **open redirect confirmado** no endpoint de recuperação de senha via bypass com barra invertida (`next=/\evil.example` resolve para `http://evil.example/` — verificado com o parser WHATWG do Node); (2) **signup público habilitado sem confirmação de e-mail** no `config.toml`, que permite a qualquer pessoa com a anon key "sequestrar" o e-mail de um convidado antes do aceite, tornando o convite permanentemente inaceitável (409) — um DoS de onboarding não autenticado que contradiz o modelo invite-only.

Os warnings concentram-se em caminhos de falha não tratados (envio de e-mail, ban falho, `response.json()` sem guarda), contagens silenciosamente truncadas pelo `max_rows=1000` do PostgREST, e gating fail-open do token de convite na resposta da API.

## Critical Issues

### CR-01: Open redirect em /auth/confirm via barra invertida no parâmetro `next`

**File:** `apps/web/app/auth/confirm/route.ts:11-17`
**Issue:** `safeNextPath` bloqueia valores que não começam com `/` e valores que começam com `//`, mas não bloqueia `/\`. No parser de URL WHATWG (usado por `new URL()` e pelos navegadores), barras invertidas em schemes especiais (http/https) são tratadas como barras normais — então `next=/\evil.example` passa na validação e `new URL("/\\evil.example", url.origin)` resolve para `http://evil.example/` (comportamento confirmado em runtime). O usuário que acabou de validar um link de recuperação legítimo é redirecionado para um domínio arbitrário — cenário clássico de phishing de "digite sua nova senha" logo após um fluxo de auth legítimo, e vetor de session fixation (atacante gera link de recovery da própria conta com `next` malicioso). O teste em `auth-confirm.test.ts:53-63` cobre apenas o caso `https://evil.example`, não o bypass com `\`.
**Fix:**
```typescript
function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/nova-senha";
  }

  // Defesa em profundidade: garantir que o destino resolvido fica no mesmo origin.
  return next;
}
```
E no handler, validar o resultado resolvido: `const target = new URL(nextPath, url.origin); if (target.origin !== url.origin) return errorRedirect(url.origin);`. Adicionar caso de teste com `next=/\evil.example`.

### CR-02: Signup público habilitado sem confirmação de e-mail permite squatting de e-mails convidados (convite fica permanentemente inaceitável)

**File:** `supabase/config.toml:176` (`enable_signup = true`), `supabase/config.toml:226` (`enable_confirmations = false`); interação com `apps/web/app/api/invitations/route.ts:32-44` e `apps/web/app/api/invitations/accept/route.ts:46-89`
**Issue:** O produto é estritamente invite-only (usuários entram por `/convite/[token]` via `auth.admin.createUser`), mas o `config.toml` mantém signup público habilitado **e** sem confirmação de e-mail. Qualquer pessoa com a anon key (pública por definição) pode chamar `supabase.auth.signUp({ email, password })` com **o e-mail de outra pessoa** e criar um auth user imediatamente logável. Consequências concretas no fluxo revisado:
1. **DoS de onboarding não autenticado:** se um atacante registra o e-mail de um convidado antes do aceite, o accept route encontra `existingUser` sem profile e cai no `else` de `accept/route.ts:88` → 409 "Este e-mail já pertence a uma organização". O convite (inclusive o do primeiro gestor provisionado pelo super-admin) fica **permanentemente inaceitável** — não há caminho de recuperação no código.
2. O mesmo deadlock ocorre por falha interna: se `createUser` sucede e o insert do profile falha (`accept/route.ts:114-116`), o auth user órfão não é removido (sem rollback) e todo aceite futuro daquele e-mail retorna 409.
3. Usuários auto-registrados consomem MAUs e possuem sessões válidas (sem profile o RLS nega dados, mas a superfície autenticada existe).
**Fix:**
1. Desabilitar signup público: `enable_signup = false` em `[auth]` e `[auth.email]` (o fluxo de convite usa `auth.admin.createUser` com service role, que não depende dessa flag). Replicar a configuração no projeto hospedado.
2. Defesa em profundidade no accept: quando `existingUser` existe **sem profile**, adotar o usuário em vez de 409 — `admin.auth.admin.updateUserById(existingUser.id, { password, user_metadata, email_confirm: true })` + insert do profile. Isso também elimina o deadlock do órfão de (2). Alternativamente, rollback com `admin.auth.admin.deleteUser(createdUser.user.id)` quando o insert do profile falhar.

## Warnings

### WR-01: Falha no envio de e-mail não é tratada — 500 pós-insert e rollback de organização órfã nunca executa

**File:** `apps/web/lib/invitations/create.ts:66-70`; `apps/web/app/api/admin/organizations/route.ts:60-73`
**Issue:** `createInvitationAndSendEmail` faz `await sendEmail(...)` sem try/catch. Com `EMAIL_DRIVER=resend`, uma falha da API do Resend lança exceção **depois** do insert do convite: o cliente recebe 500 genérico, o convite fica `pending` sem que o token jamais tenha sido entregue, e a nova tentativa do gestor recebe 409 "duplicate". Pior: em `admin/organizations/route.ts`, o rollback da organização (comentário na linha 70: "Não deixar organização órfã sem convite de gestor") só cobre o retorno `{ errorCode }` — a exceção do `sendEmail` pula o check `"errorCode" in result` e deixa exatamente a organização órfã que o código diz evitar (com um convite pendente cujo token ninguém recebeu).
**Fix:** Envolver o `sendEmail` em try/catch dentro de `createInvitationAndSendEmail` e retornar um código distinto (ex.: `{ errorCode: "email_failed", invitation, token }`), permitindo aos chamadores decidirem (o admin route faz rollback; o invitations route pode responder 201 com aviso de reenvio). No mínimo, envolver a chamada em try/catch nos dois routes.

### WR-02: Falha no ban do usuário removido retorna 200 — revogação de sessão silenciosamente perdida

**File:** `apps/web/app/api/members/[userId]/route.ts:88-94`
**Issue:** Se `updateUserById({ ban_duration })` falhar, o código apenas faz `console.error` e responde 200 "removido". O refresh token do usuário removido continua válido **indefinidamente** — ele renova sessões para sempre. O RLS nega os dados (profile `removed`), mas o mecanismo de revogação prometido pelo D-11/A5 falhou sem que gestor ou auditoria saibam, e o teste 2 de `members-admin.test.ts` só valida o caminho feliz.
**Fix:** Registrar a falha no audit_log (ex.: ação `member.ban_failed`) e/ou tentar novamente; considerar retornar o estado parcial na resposta (`{ profile, sessionRevoked: false }`) para a UI sinalizar. Nunca deixar a falha visível apenas em stdout.

### WR-03: Hierarquia de papéis não aplicada na remoção — gestor pode remover (e banir) um super_admin da própria org; checagem de último gestor tem corrida TOCTOU

**File:** `apps/web/app/api/members/[userId]/route.ts:49-67`
**Issue:** (a) O route só protege o "último gestor ativo". Um `gestor` da organização interna da Elite Juris pode fazer DELETE do profile de um `super_admin` da mesma org — soft-removal + ban de ~100 anos no administrador da plataforma, executado por um papel inferior. (b) A checagem "último gestor" é count-then-update sem transação: dois DELETEs concorrentes dos dois últimos gestores passam ambos no count (`2 > 1`) e deixam a organização sem nenhum gestor ativo.
**Fix:** (a) Bloquear `target.role === "super_admin"` a menos que `actor.profile.role === "super_admin"` (e mesmo assim exigir a regra de auto-remoção/último admin). (b) Mover a proteção para o banco — ex.: trigger `before update` em profiles que rejeita a transição para `removed` quando é o último gestor ativo da org, ou um RPC com lock (`select ... for update`).

### WR-04: Contagens do painel admin silenciosamente truncadas em 1000 linhas (max_rows do PostgREST)

**File:** `apps/web/app/admin/page.tsx:29-51`; `apps/web/app/api/admin/organizations/route.ts:105-126`
**Issue:** Ambos carregam **todas** as linhas de `profiles` e `invitations` da plataforma e contam em JavaScript com `.filter().length`. O PostgREST aplica `max_rows = 1000` (config.toml:18; mesmo default no hosted, e vale também para service_role) — a partir de 1001 profiles na plataforma, as contagens de "membros ativos" e "convites pendentes" ficam erradas sem nenhum erro. A lista de organizações também trunca em 1000.
**Fix:** Usar contagem no servidor por organização, ex.: `.select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("status", "active")`, ou uma view/RPC de agregação (`select organization_id, count(*) ... group by 1`).

### WR-05: Convites expirados nunca saem de `pending` — consomem o limite de 20 e poluem a UI

**File:** `apps/web/app/api/invitations/route.ts:46-54`; `supabase/migrations/20260710012345_initial_schema.sql:77-79`; `apps/web/app/(dashboard)/equipe/page.tsx:10-13`
**Issue:** Nenhum código transiciona convites para `status = 'expired'` (o enum existe mas nunca é usado; o accept apenas rejeita por `expires_at`). Consequências: (1) o limite de 20 pendentes conta convites expirados — uma organização que acumule 20 convites vencidos recebe 429 permanente até cancelamento manual um a um; (2) o índice único parcial `where status = 'pending'` bloqueia novo convite para o mesmo e-mail com 409 mesmo com o anterior vencido (obriga descobrir o resend); (3) a tela de equipe lista convites vencidos como "pendentes" com 0 dias.
**Fix:** No POST, filtrar o count por `.gt("expires_at", new Date().toISOString())` e, ao detectar 23505, verificar se o pendente conflitante está vencido — se sim, marcá-lo `expired` e reinserir. Opcionalmente um job/trigger de expiração.

### WR-06: Token bruto de convite retornado na resposta da API e logado por gating fail-open (`!== "resend"`)

**File:** `apps/web/lib/invitations/create.ts:74`; `apps/web/lib/email/index.ts:8-18`
**Issue:** O token só é omitido da resposta quando `process.env.EMAIL_DRIVER === "resend"` — qualquer outra condição (variável ausente em produção, typo `"Resend"`, driver futuro) devolve o token bruto ao chamador **e** o driver console imprime a URL com token nos logs do servidor (persistidos na Vercel). O padrão console-por-default é aceito para dev, mas o gate está fail-open: um deploy de produção mal configurado vaza tokens de convite válidos por 7 dias em logs e respostas HTTP.
**Fix:** Inverter a condição para fail-closed: expor o token apenas quando explicitamente em modo dev — ex.: `const exposeToken = process.env.EMAIL_DRIVER !== "resend" && process.env.NODE_ENV !== "production"`; em produção sem `EMAIL_DRIVER=resend`, falhar o boot ou logar erro de configuração em vez de degradar para console.

### WR-07: Fallback de `NEXT_PUBLIC_SITE_URL` para localhost gera links de convite quebrados silenciosamente em produção

**File:** `apps/web/lib/invitations/create.ts:59`
**Issue:** `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` — se a variável faltar no deploy, todos os e-mails de convite saem com `http://localhost:3000/convite/...` sem nenhum erro observável. O destinatário clica num link morto e o gestor não tem como diagnosticar.
**Fix:** Validar no início: `if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL ausente")` (ou centralizar em um módulo `env.ts` como já feito para as chaves Supabase).

### WR-08: `fetch`/`response.json()` sem tratamento de erro trava o botão em loading sem feedback

**File:** `apps/web/app/(dashboard)/equipe/member-actions.tsx:30-31`; `apps/web/app/admin/create-org-form.tsx:20-25`
**Issue:** Nos dois componentes, `await response.json()` não tem guarda e o `fetch` não está em try/catch. Se a resposta não for JSON (500 com HTML, proxy, gateway) ou a rede falhar, a exceção escapa do handler: em `member-actions.tsx` o `json()` lança **antes** de `setIsLoading(false)` — o botão fica permanentemente desabilitado em "Removendo..." sem mensagem; em `create-org-form.tsx` uma falha de rede no `fetch` produz o mesmo travamento. O `accept-form.tsx` já faz certo (`.json().catch(() => null)` + try/catch) — os outros dois divergem do padrão.
**Fix:** Replicar o padrão do `accept-form.tsx`:
```typescript
try {
  const response = await fetch(...);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    setError(payload?.error ?? "Não foi possível concluir a operação.");
    return;
  }
  // sucesso
} catch {
  setError("Falha de conexão. Tente novamente.");
} finally {
  setIsLoading(false);
}
```

### WR-09: Layout do dashboard não valida `profile.status` — membro removido com token ainda válido vê o shell do painel

**File:** `apps/web/app/(dashboard)/layout.tsx:17-29`
**Issue:** O layout checa existência do profile e `role === "advogado"`, mas não `status`. A policy de RLS `members read permitted profiles` permite que **qualquer** usuário leia o próprio profile (primeiro branch `user_id = auth.uid()`, sem filtro de status), então um gestor removido cujo access token ainda não expirou (janela de até 1h; indefinida se o ban falhar — ver WR-02) passa pelo layout e vê o painel (vazio, pois `current_org_id()` exige `active`). O `admin/page.tsx:24` faz a checagem completa (`status !== "active"`) — o layout do dashboard está inconsistente com a guarda dupla adotada lá.
**Fix:** `if (!profile || profile.status !== "active") { redirect("/login"); }`.

### WR-10: Cleanup global de usuários `@example.test` em `afterAll` corre contra a suíte paralela (flakiness)

**File:** `apps/web/tests/invitations.test.ts:102-108`
**Issue:** O `afterAll` de `invitations.test.ts` lista **todos** os usuários da instância e deleta qualquer um com e-mail `@example.test` (profile + auth user). O Vitest executa arquivos de teste em paralelo por padrão (nada em `vitest.config.ts` desativa isso), e `members-admin.test.ts` cria usuários `@example.test` (gestor-a, advogado-a, super-admin...) que ele ainda usa nos próprios testes. Se `invitations.test.ts` terminar primeiro, o cleanup apaga usuários da outra suíte no meio da execução — falhas intermitentes difíceis de diagnosticar, agravadas por rodar contra o banco hospedado compartilhado.
**Fix:** Restringir o cleanup aos e-mails criados pela própria suíte (registrar os e-mails/ids gerados num array, como `members-admin.test.ts` já faz com `createdUserIds`), ou usar sufixo exclusivo por arquivo (ex.: `@invitations.example.test`), ou configurar `fileParallelism: false` no vitest para suites que tocam o banco compartilhado.

## Info

### IN-01: Corpo da requisição é parseado/validado antes da autenticação

**File:** `apps/web/app/api/admin/organizations/route.ts:32-43`; `apps/web/app/api/invitations/route.ts:18-27`
**Issue:** `safeParse` roda antes de `getActorContext` — anônimos recebem 400 (com semântica de validação) antes do 401, e o servidor gasta parsing em requisições não autenticadas.
**Fix:** Autenticar/autorizar primeiro, validar corpo depois.

### IN-02: 409 "Já é membro da equipe" para membro ativo de outra organização — enumeração de contas e convite "morto" para removidos de outra org

**File:** `apps/web/app/api/invitations/route.ts:32-44`
**Issue:** A checagem de profile ativo não filtra por organização: convidar um e-mail ativo em **outra** org retorna 409 com mensagem enganosa ("Já é membro da equipe" — não é membro *desta* equipe), revelando a um gestor que o e-mail existe na plataforma. E para um usuário `removed` de outra org, o convite é criado normalmente mas o aceite sempre retornará 409 (`accept/route.ts:53-89` só reativa na mesma org) — convite impossível de aceitar.
**Fix:** Diferenciar as mensagens/comportamentos por org (`existingProfile.organization_id === actor.organizationId`) e bloquear na criação o caso "removed em outra org" com mensagem clara.

### IN-03: `roleLabel` exibe super_admin como "advogado"

**File:** `apps/web/app/(dashboard)/equipe/page.tsx:6-8`
**Issue:** `role === "gestor" ? "gestor" : "advogado"` — na org interna da Elite Juris (que tem super_admins e a rota /equipe acessível a eles), um super_admin aparece rotulado "advogado".
**Fix:** Mapear os três valores do enum explicitamente.

### IN-04: Lógica de agregação de organizações duplicada

**File:** `apps/web/app/admin/page.tsx:39-51`; `apps/web/app/api/admin/organizations/route.ts:115-126`
**Issue:** O mesmo bloco de map/filter/count existe em dois lugares (com o mesmo bug do WR-04); qualquer correção precisa ser feita duas vezes.
**Fix:** Extrair para uma função compartilhada (ex.: `lib/admin/organizations.ts`) ou fazer a página consumir o route/RPC.

### IN-05: E-mail (PII) gravado em `audit_log.details` sem política de retenção

**File:** `apps/web/app/api/admin/organizations/route.ts:81-86`; `apps/web/lib/audit.ts`
**Issue:** `gestor.invited` persiste o e-mail do convidado em `details` (jsonb) indefinidamente. Sob LGPD, dados pessoais em log exigem base legal e retenção definida — o projeto tem compliance LGPD como constraint explícita.
**Fix:** Documentar retenção do audit_log e/ou registrar identificadores em vez de e-mail bruto (ex.: id do convite) quando suficiente para o rastro.

### IN-06: Parser de `.env.local` do seed não trata aspas nem espaços; seed reseta senha e unban de usuários existentes

**File:** `scripts/seed.ts:6-15`, `scripts/seed.ts:85-92`
**Issue:** O regex `^([A-Z0-9_]+)=(.*)$` mantém aspas no valor (`SENHA="x"` vira a string com aspas) e não suporta `export`/espaços — divergindo do parser do `vitest.config.ts`, que também é próprio. Além disso, rodar o seed contra o ambiente apontado por `.env.local` **sempre** sobrescreve a senha e remove o ban dos três usuários seed (`updateUserById` incondicional) — perigoso se `.env.local` apontar para produção.
**Fix:** Remover aspas ao parsear (`match[2].replace(/^['"]|['"]$/g, "")`), reutilizar um único parser, e exigir confirmação explícita (ex.: `SEED_CONFIRM=1`) quando a URL não for local.

### IN-07: Redirecionamentos do proxy descartam a query string — sem retorno pós-login

**File:** `apps/web/lib/supabase/proxy-session.ts:96-98`
**Issue:** `redirectUrl.search = ""` apaga qualquer parâmetro ao redirecionar para `/login`, e não há mecanismo de `next`/`returnTo`: usuário deslogado que acessa `/equipe?x=y` cai em `/login` e, após autenticar, volta para `/` — perde o destino original.
**Fix:** Ao redirecionar para `/login`, anexar o destino original (`redirectUrl.searchParams.set("next", request.nextUrl.pathname)`) e consumi-lo no fluxo de login (validando com a mesma regra do CR-01).

---

_Revisado: 2026-07-11T12:33:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
