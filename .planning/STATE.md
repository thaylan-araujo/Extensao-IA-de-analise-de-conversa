---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 02
current_phase_name: Extensão Chrome e Leitura do WhatsApp
status: executing
stopped_at: Phase 2 UI-SPEC approved
last_updated: "2026-07-12T10:48:59.296Z"
last_activity: 2026-07-12
last_activity_desc: Phase 02 execution started
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 15
  completed_plans: 10
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** O advogado recebe orientação de IA que efetivamente aumenta a conversão de leads em contratos — sugestões e diagnósticos precisam convergir com o julgamento do dono (especialista).
**Current focus:** Phase 02 — Extensão Chrome e Leitura do WhatsApp

## Current Position

Phase: 02 (Extensão Chrome e Leitura do WhatsApp) — EXECUTING
Plan: 3 of 7
Status: Ready to execute
Last activity: 2026-07-12 — Phase 02 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 8 | - | - |

**Recent Trend:**

- Last 5 plans: 01-04, 01-05, 01-06, 01-07, 01-08
- Trend: -

*Updated after each plan completion*
| Phase 01 P07 | 15m | 3 tasks | 13 files |
| Phase 01 P08 | 11h30m | 2 tasks | 12 files |
| Phase 02 P05 | 6min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap rev. 2026-07-08]: Validação do cérebro de IA movida para a última fase (Phase 7, portão do beta) a pedido do dono — o documento de metodologia e as conversas reais avaliadas só estarão disponíveis no final. Trade-off aceito explicitamente: a validação do core value acontece por último
- [Roadmap rev. 2026-07-08]: Fases de IA (3 e 4) operam com cérebro provisório — prompt consultivo genérico de vendas jurídicas, já conforme OAB (sem promessa de resultado, sem captação) — arquitetado como artefato versionado server-side, trocável pela metodologia real na Phase 7 sem mudança de código
- [Roadmap]: Criptografia LGPD e cascata de exclusão decididas no schema (Phase 1), não retrofitadas
- [Roadmap]: Leitura do WhatsApp (Phase 2) atacada cedo por ser o maior risco técnico; extração DOM-only recomendada para v1 (menor superfície ToS/ban); wa-js documentado como fallback — resolver com spike no planejamento da Phase 2
- [Roadmap]: Diagnóstico por inatividade roda server-side (cron), nunca no service worker MV3
- [Roadmap]: Painel do gestor (Phase 5) gated por testes cross-tenant em CI (Phase 1); as notas exibidas vêm do cérebro provisório até a calibração da Phase 7
- [Roadmap]: Cobrança e LGPD operacional (Phase 6) deixam a operação pronta, mas o beta só abre com a calibração aceita na Phase 7
- [Phase 01]: 01-07: Revogação de sessão na remoção = ban via updateUserById (A5) — admin.signOut exige o JWT do alvo, indisponível server-side; ban bloqueia refresh e RLS por lookup nega leituras imediatamente — provado sem refresh no teste 2
- [Phase 01]: 01-08: Role gate do proxy usa getClaims() (claims do custom_access_token_hook não aparecem em getUser); RLS de profiles precisa de policy SELECT para supabase_auth_admin ou o hook falha silenciosamente
- [Phase 01]: 01-08: /auth/confirm aceita fluxo ?code= do template padrão do Supabase (plano Free não permite template custom com SMTP default) além de token_hash
- [Phase 01]: 01-08: Rotas /api são públicas no proxy — cada Route Handler cuida da própria auth (evita redirect HTML em chamadas anônimas de API)
- [Phase 02-05]: Join reader_status→profile/organização em memória no RSC (select de profiles estendido) em vez do embed por FK do PostgREST
- [Phase 02-05]: Flag reader_enabled interpretada estritamente como value === true — estado inesperado aparece como desativada (fail-closed na UI)

### Pending Todos

- [01-08] Ativar Resend: verificar domínio elitejuris.com.br e trocar EMAIL_DRIVER=resend na Vercel (criterion "convite por e-mail real" só fecha no beta após isso; hoje o link sai nos logs da Vercel)
- [01-08] Reativar `[auth.email.template.recovery]` no config.toml quando houver SMTP próprio (plano Free não permite template custom com SMTP default)
- [01-08] Senha do gestor demo divergiu do seed (trocada pelo dono no passo 6 do checkpoint): atualizar SEED_USER_PASSWORD no .env.local ou restaurar a senha seed via service role — suíte invitations.test.ts falha no login seed até lá

### Blockers/Concerns

- [Phase 7]: Depende de insumo do dono — documento de metodologia da agência, conversas reais exportadas (20-50) e disponibilidade para avaliar o conjunto dourado (disponíveis só no final do projeto, por decisão do dono)
- [Phase 2]: DOM do WhatsApp Web é frágil e pouco documentado; spike hands-on necessário durante o planejamento
- [Phase 6]: Verificar disponibilidade/termos de DPA e tier zero-data-retention da Anthropic para dados jurídicos sensíveis (LGPD Art. 33)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-12T10:48:21.631Z
Stopped at: Phase 2 UI-SPEC approved
Resume file: .planning/phases/02-extens-o-chrome-e-leitura-do-whatsapp/02-UI-SPEC.md
