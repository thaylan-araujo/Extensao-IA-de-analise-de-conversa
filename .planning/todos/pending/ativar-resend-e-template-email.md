---
created: 2026-07-11
title: Ativar Resend (e-mails reais) + template de recovery custom
area: beta-gate
resolves_phase: 6
---

**Gate do beta** (registrado no 01-08-SUMMARY e no STATE):
1. Verificar o domínio elitejuris.com.br no Resend (SPF/DKIM — precisa de acesso ao DNS)
2. Trocar `EMAIL_DRIVER=resend` nas env vars da Vercel (convites passam a chegar por e-mail de verdade — hoje o link sai nos logs)
3. Com SMTP próprio configurado no Supabase, descomentar `[auth.email.template.recovery]` no `supabase/config.toml` e rodar `supabase config push` (template pt-BR de redefinição — bloqueado no plano Free com SMTP default)

Critério 2 da Fase 1 (convite por e-mail real) só é 100% no beta após o item 2. Momento natural: Fase 6 (cobrança/LGPD) ou véspera do beta.
