# Walking Skeleton — Copiloto Jurídico WhatsApp

**Phase:** 1
**Generated:** 2026-07-09

## Capability Proven End-to-End

Um gestor de escritório faz login no painel web deployado e vê o nome da própria organização e a equipe — dados reais lidos do Postgres sob RLS, gravados criptografados em repouso na região sa-east-1 (São Paulo).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2 App Router (painel + API no mesmo deploy) | Stack contract em .claude/CLAUDE.md; Route Handlers servem o painel e, na Fase 2, a extensão via HTTPS. Next 16: `proxy.ts` (não `middleware.ts`) |
| Data layer | Supabase Postgres (sa-east-1) + RLS keyed em `organization_id` | Isolamento multi-tenant enforced no BANCO (não na aplicação); AES-256 em repouso padrão da plataforma cobre LGPD-01; região é imutável — decidida no dia 1 |
| Auth | Supabase Auth (e-mail/senha) via `@supabase/ssr` (cookies httpOnly) | `auth.uid()` alimenta as policies RLS; custom access token hook injeta `user_role`/`organization_id` como claims SÓ para gates de UI; autorização de dados sempre no RLS via helpers `security definer` lendo `profiles` (remoção tem efeito imediato — D-11) |
| Papéis | `super_admin` / `gestor` / `advogado` em `profiles.role` (fonte de verdade) | D-02/D-05/D-07; advogado não acessa o painel na v1 (gate em `decideRedirect`); gestor também atende (D-06) |
| Convites | Tabela `invitations` própria (token 32 bytes, SHA-256 no banco, 7 dias, reenviar/cancelar/reativar) | Convite nativo do Supabase expira em <=24h e não lista/cancela — insuficiente para D-09/D-12 |
| E-mail | Driver por env (`EMAIL_DRIVER`: console | resend); remetente via `EMAIL_FROM_NAME`/`EMAIL_FROM_ADDRESS` | D-13: marca Elite Juris trocável por configuração; dev/CI sem rede via driver console |
| Deployment target | Vercel (região gru1), banco só no Supabase sa-east-1 | Stack contract; dados em repouso permanecem no Brasil (A6) |
| Monorepo | pnpm workspaces: `apps/web`, `packages/shared` (+ `apps/extension` na Fase 2), `supabase/` na raiz | Extensão WXT da Fase 2 consome tipos/schemas de `packages/shared`; migrations versionadas são contrato |
| Testes | pgTAP (`supabase test db`) para RLS em CI (GitHub Actions, Docker no runner) + Vitest para handlers | Docker ausente na máquina local: dev roda contra o projeto hospedado (`supabase db push`); o gate autoritativo de isolamento é o CI |
| Versões | Pinadas exatas (npm audit 2026-07-08); TypeScript `~5.9.3` (latest é 7.x — não usar) | Auditoria de legitimidade de pacotes + toolchain validada |

## Stack Touched in Phase 1

- [x] Project scaffold (pnpm monorepo, Next 16, Tailwind 4, Vitest) — plano 01-01
- [x] Routing — `/login`, `/` (painel), `/equipe`, `/convite/[token]`, `/recuperar-senha`, `/nova-senha`, `/sem-acesso`, `/admin` — planos 01-04 a 01-07
- [x] Database — leitura real (org/equipe sob RLS) E escrita real (convites, profiles, audit_log; conversations/messages exercitadas no pgTAP) — planos 01-02, 01-03, 01-05
- [x] UI — login, convidar/remover membro, aceitar convite, redefinir senha — planos 01-04 a 01-07
- [x] Deployment — Vercel gru1 com URL pública verificada pelo dono — plano 01-08

## Out of Scope (Deferred to Later Slices)

- Extensão Chrome, leitura do WhatsApp, sincronização de transcrições (Fase 2)
- Qualquer chamada de IA — sugestões e diagnósticos (Fases 3-4, cérebro provisório; calibração na Fase 7)
- Painel de analytics do gestor — notas, conversão, comparativos (Fase 5)
- Stripe, entitlements, retenção/expurgo LGPD operacional, termos de uso, onboarding (Fase 6)
- Auto-cadastro de organização (v2, SAAS-01); multi-organização por usuário (fora da v1, D-08); visão do próprio desempenho para advogado (v2, ADV-01)
- SMTP customizado Resend em produção (depende de DNS do dono — driver console até lá); criptografia por coluna (pgsodium deprecado; plataforma cobre LGPD-01 — assunção A1 a confirmar com o dono)

## Subsequent Slice Plan

Cada fase seguinte adiciona uma fatia vertical sobre este esqueleto sem renegociar as decisões acima:

- Phase 2: advogado usa o painel lateral no WhatsApp Web (extensão WXT no monorepo, auth com `chrome.storage` adapter, sync de transcrições para `conversations`/`messages` já criadas)
- Phase 3: botão "Sugerir resposta" (proxy server-side para a Claude API; cérebro provisório versionado no servidor)
- Phase 4: diagnóstico automático por inatividade (cron server-side gravando em `diagnostics`) + desfecho da conversa
- Phase 5: painel do gestor com analytics (liberado pelo gate cross-tenant do plano 01-03)
- Phase 6: Stripe por assento + LGPD operacional (cascata de exclusão já decidida no schema desta fase)
- Phase 7: metodologia real + calibração (portão do beta; super_admin auditável desta fase suporta a calibração)
