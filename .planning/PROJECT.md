# Copiloto Jurídico WhatsApp (nome provisório)

## What This Is

Um copiloto de IA para advogados converterem leads em contratos fechados no WhatsApp. É uma extensão Chrome com painel lateral integrado ao WhatsApp Web (estilo WaSpeed/WaLeads) que analisa a conversa do advogado com o lead, sugere respostas sob demanda para direcionar ao fechamento e, ao final, gera um diagnóstico automático da interação (nota 0-10 + feedback de acertos, erros e melhorias). Acompanha um painel de gestão web onde o gestor da agência vê notas, diagnósticos, transcrições e taxa de conversão de todos os advogados.

## Core Value

O advogado recebe orientação de IA que efetivamente aumenta a conversão de leads em contratos — se as sugestões e diagnósticos não forem bons o suficiente para o dono do produto (especialista em atendimento jurídico) concordar com eles, nada mais importa.

## Business Context

- **Customer**: Advogados/escritórios que recebem leads de marketing pelo WhatsApp (inicialmente os clientes da agência Elite Juris; depois, mercado aberto)
- **Revenue model**: SaaS por assinatura (Stripe), lançamento em beta fechado com clientes da agência antes da abertura ao mercado
- **Success metric**: Advogados usando o copiloto em conversas reais e taxa de conversão lead→contrato rastreada e melhorando
- **Strategy notes**: O dono opera uma agência de marketing jurídico; hoje perde muito tempo acessando o WhatsApp dos clientes para auditar atendimentos manualmente — o produto automatiza essa auditoria e a transforma em fonte de receita

## Requirements

### Validated

- [x] Fundação multi-tenant no ar e validada pelo dono (Fase 1, 2026-07-11): organizações, papéis gestor/advogado/super-admin, convites com reativação, remoção com histórico preservado, reset de senha, isolamento cross-tenant provado por pgTAP em CI, dados criptografados em repouso em São Paulo (AUTH-03/04/05, LGPD-01) — painel em https://copiloto-juridico.vercel.app

### Active

- [ ] Extensão Chrome com painel lateral funcionando sobre o WhatsApp Web
- [ ] Login com e-mail/senha na extensão (conta vinculada a assinatura)
- [ ] Leitura da conversa ativa do WhatsApp Web (DOM) para dar contexto à IA
- [ ] Botão "Sugerir resposta": IA analisa a conversa e sugere o que falar para direcionar ao fechamento, seguindo a metodologia da agência
- [ ] Diagnóstico automático por inatividade ao final da conversa: nota 0-10 + feedback (acertos, erros, o que melhorar)
- [ ] Advogado marca o desfecho da conversa (contrato fechado / perdido) para rastrear conversão
- [ ] Painel de gestão web: notas e diagnósticos por conversa, visão por advogado (média/evolução/comparativo), transcrições completas, taxa de conversão
- [ ] Cobrança por assinatura via Stripe
- [ ] Armazenamento de transcrições com salvaguardas LGPD (criptografia em repouso, política de retenção, termos de uso, exclusão sob demanda)

### Out of Scope

- CRM Kanban, etiquetas, agendamento de mensagens — as concorrentes (WaSpeed/WaLeads) já fazem; nosso diferencial é o copiloto de IA, não gestão de contatos
- Chatbot / envio automático de mensagens — a IA só lê e sugere; quem digita é o advogado (reduz drasticamente o risco de banimento pelo WhatsApp e mantém o atendimento humano)
- Sugestões automáticas em tempo real a cada mensagem — decidido sob demanda (botão) para controle do advogado e custo de IA; reavaliar em versão futura
- Playbook configurável por cliente — v1 usa a metodologia fixa da agência para todos; personalização por escritório fica para depois
- Aplicativo desktop/mobile — v1 é somente extensão Chrome + painel web

## Context

- O dono do produto tem agência de marketing jurídico (Elite Juris) e conhece profundamente a dor: leads chegam do marketing mas os advogados não sabem conduzir o atendimento no WhatsApp até o fechamento
- A metodologia de bom atendimento **já está documentada** pela agência — será fornecida e convertida no "cérebro" da IA (prompts + critérios de avaliação)
- Referências de UX: waspeed.com.br e waleads.com.br — extensões Chrome com painel lateral no WhatsApp Web, login por conta, planos pagos
- WhatsApp não oferece API oficial para extensões lerem conversas; a leitura será via DOM do WhatsApp Web, como fazem as concorrentes. Isso implica manutenção contínua (quebra quando o WhatsApp atualiza a interface) e zona cinzenta de ToS — risco mitigado por ser ferramenta somente-leitura
- Calibração da IA será iterativa: as notas e sugestões precisam convergir com a avaliação humana do dono (especialista) usando conversas reais
- Público 100% brasileiro; produto em pt-BR

## Constraints

- **Plataforma**: Chrome (Manifest V3) + WhatsApp Web — o produto vive onde o atendimento acontece
- **Dependência**: DOM do WhatsApp Web sem API oficial — exige arquitetura de leitura resiliente e manutenção contínua
- **Compliance**: LGPD — conversas contêm dados sensíveis (casos jurídicos); criptografia, retenção definida e termos claros são obrigatórios
- **Pagamento**: Stripe para assinaturas
- **Idioma**: Interface e IA em português brasileiro

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extensão Chrome + painel lateral no WhatsApp Web | É onde o advogado já atende; padrão validado pelas concorrentes | — Pending |
| Sugestão sob demanda (botão), não automática | Controle do advogado + custo de IA menor | — Pending |
| Diagnóstico automático por inatividade | Advogado não precisa lembrar de "finalizar" a análise | — Pending |
| Metodologia fixa da agência como base da IA | Já documentada; é o diferencial competitivo do produto | — Pending |
| Somente leitura — nunca enviar mensagens automaticamente | Reduz risco de banimento WhatsApp; mantém atendimento humano | — Pending |
| Armazenar transcrições completas com salvaguardas LGPD | Necessário para o painel do gestor (reler atendimentos); criptografia + retenção + termos | — Pending |
| SaaS com Stripe desde a v1, beta fechado primeiro | Validar com clientes da agência antes de abrir ao mercado | — Pending |
| Painel de gestão web separado da extensão | Gestor audita todos os advogados sem acessar o WhatsApp de cada um | — Pending |
| Metodologia e calibração movidas para a última fase (decisão do dono, 2026-07-08) | Documento da metodologia e conversas avaliadas só estarão disponíveis ao final; plataforma é construída com cérebro provisório (vendas consultivas jurídicas, OAB-safe) trocável sem mudança de código. Trade-off aceito: a validação do valor central (convergência IA vs julgamento do dono) acontece por último, como portão do beta | ⚠️ Revisit |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-11 after Phase 1 completion (multi-tenant foundation live and owner-verified)*
