# Roadmap: Copiloto Jurídico WhatsApp

## Overview

O caminho até o beta fechado começa pela fundação multi-tenant com criptografia LGPD desde o schema, ataca em seguida o maior risco técnico — a leitura resiliente do DOM do WhatsApp Web pela extensão — e entrega o primeiro momento de valor de ponta a ponta ("Sugerir resposta") usando um **cérebro provisório**: um prompt consultivo genérico de vendas jurídicas, já conforme OAB (sem promessa de resultado, sem captação vedada), construído por nós sem o documento do dono e arquitetado como artefato versionado no servidor para ser trocado sem mudança de código. Fechamos o ciclo por conversa com o diagnóstico automático por inatividade e a marcação de desfecho, abrimos a visão do gestor sobre os dados que agora existem, deixamos a operação pronta com cobrança via Stripe e LGPD operacional, e terminamos no portão do beta: converter o documento de metodologia da agência em prompts versionados + rubrica, construir o conjunto dourado avaliado pelo dono e medir a concordância IA vs especialista. **Trade-off aceito explicitamente:** a validação do core value (convergência da IA com o julgamento do dono) acontece por último, a pedido do dono, porque o documento de metodologia e as conversas reais avaliadas só estarão disponíveis no final do projeto.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundação Backend Multi-Tenant** - Schema com criptografia e RLS, contas, papéis gestor/advogado e convites em região brasileira (completed 2026-07-11)
- [ ] **Phase 2: Extensão Chrome e Leitura do WhatsApp** - Painel lateral com login, extração resiliente do DOM e sincronização idempotente de transcrições
- [ ] **Phase 3: Sugerir Resposta** - Primeiro valor de ponta a ponta: sugestão do cérebro provisório (consultivo, OAB-safe) com cópia em um clique e controle de custo
- [ ] **Phase 4: Diagnóstico Automático e Desfecho** - Nota 0-10 + feedback por inatividade (server-side), gatilho manual e marcação fechado/perdido
- [ ] **Phase 5: Painel do Gestor** - Notas, evolução, comparativo, transcrições com diagnóstico e taxa de conversão por advogado e equipe
- [ ] **Phase 6: Cobrança e LGPD Operacional** - Stripe por assento com entitlements, retenção/exclusão/termos e tour de onboarding
- [ ] **Phase 7: Cérebro de IA: Metodologia e Calibração (Portão do Beta)** - Metodologia real como prompts versionados + conjunto dourado + concordância IA vs especialista medida — portão de qualidade que abre o beta

## Phase Details

### Phase 1: Fundação Backend Multi-Tenant

**Goal**: Organizações, papéis e dados criptografados existem com isolamento entre tenants provado — a base sobre a qual tudo depende, com as decisões LGPD tomadas no schema, não depois
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-03, AUTH-04, AUTH-05, LGPD-01
**Success Criteria** (what must be TRUE):

  1. Gestor faz login no painel web com e-mail/senha e vê apenas dados da própria organização; advogado logado não vê dados dos colegas
  2. Gestor convida um advogado por e-mail, o convidado cria conta e entra na organização, e o gestor pode removê-lo
  3. Qualquer usuário redefine a senha via link enviado por e-mail
  4. Testes cross-tenant automatizados (duas organizações) passam em CI, provando que nenhuma consulta vaza dados entre organizações
  5. Transcrições e análises são gravadas criptografadas em repouso, em região brasileira (São Paulo)

**Plans:** 8/8 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold do monorepo pnpm + auditoria de pacotes + teste de esqueleto vermelho

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Schema multi-tenant com RLS + projeto Supabase sa-east-1 + db push + seed

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Prova de isolamento cross-tenant: suíte pgTAP + CI GitHub Actions
- [x] 01-04-PLAN.md — Login do painel, gate de papéis (D-07) e dashboard mínimo com leitura real

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Convites ponta a ponta e tela de equipe (7 dias, reenviar/cancelar, reativação)
- [x] 01-06-PLAN.md — Redefinição de senha via link por e-mail (fluxo PKCE nativo)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-07-PLAN.md — Remoção com revogação imediata + interface admin do super-admin

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-08-PLAN.md — Deploy Vercel (gru1) + verificação humana do esqueleto no ar

### Phase 2: Extensão Chrome e Leitura do WhatsApp

**Goal**: O advogado usa o painel lateral no WhatsApp Web com sessão persistente, e a conversa ativa é lida e sincronizada com o servidor de forma resiliente, somente-leitura e sem degradar a performance
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-07, EXT-08
**Success Criteria** (what must be TRUE):

  1. Advogado instala a extensão, faz login com e-mail/senha, a sessão persiste após reiniciar o Chrome e o logout está disponível
  2. Painel lateral recolhível aparece sobre o WhatsApp Web sem obstruir a área de chat e reage à troca de conversa ativa
  3. A transcrição da conversa ativa (texto, remetente, horário; mídias como [áudio]/[imagem]/[documento]) é sincronizada continuamente com o servidor sem mensagens duplicadas
  4. Se a leitura do DOM quebrar, o advogado vê um aviso amigável em pt-BR (não falha silenciosa), as funções de IA são bloqueadas e um kill-switch remoto pode desativar a leitura
  5. O WhatsApp Web continua fluido com a extensão ativa, e a extensão nunca escreve no DOM nem envia mensagens (garantia arquitetural verificada)

**Plans**: TBD
**UI hint**: yes

### Phase 3: Sugerir Resposta

**Goal**: O advogado recebe, sob demanda, uma sugestão de resposta fundamentada em um cérebro provisório (prompt consultivo genérico de vendas jurídicas, já conforme OAB) e no estágio da conversa — o primeiro momento de valor de ponta a ponta, com o cérebro arquitetado como artefato versionado server-side, trocável pela metodologia real na Phase 7 sem mudança de código
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: IA-02, IA-03
**Success Criteria** (what must be TRUE):

  1. Advogado clica em "Sugerir resposta" e recebe, com estado de carregamento visível, uma sugestão fundamentada no prompt provisório e no estágio da conversa (abertura/qualificação/objeção/fechamento), sem promessa de resultado nem captação vedada
  2. Advogado copia a sugestão com um clique e vê a confirmação "copiado!"
  3. Chamadas de IA só funcionam para contas com entitlement ativo, e o consumo de tokens é medido por organização (com cache do prompt do cérebro protegendo o custo)
  4. O cérebro (prompt + configuração) existe como artefato versionado armazenado só no servidor, e trocar a versão ativa não exige mudança de código nem atualização da extensão

**Plans**: TBD
**UI hint**: yes

### Phase 4: Diagnóstico Automático e Desfecho

**Goal**: Toda conversa termina com um diagnóstico (nota 0-10 + acertos/erros/melhorias) gerado automaticamente por inatividade a partir do cérebro provisório, e o advogado registra o desfecho para rastrear conversão — a calibração contra o julgamento do dono acontece na Phase 7
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: IA-04, IA-05, IA-08, CONV-01
**Success Criteria** (what must be TRUE):

  1. Após o período de inatividade, o diagnóstico (nota 0-10 + acertos, erros, melhorias + resumo) é gerado automaticamente no servidor — mesmo com o navegador do advogado fechado
  2. Advogado pode gerar o diagnóstico manualmente com "Gerar diagnóstico agora"
  3. Advogado vê o diagnóstico da conversa no painel lateral
  4. Advogado marca o desfecho da conversa (contrato fechado / perdido) e pode editá-lo dias depois
  5. Se a conversa recebe novas mensagens após o diagnóstico, o sistema re-avalia sem duplicar diagnósticos

**Plans**: TBD
**UI hint**: yes

### Phase 5: Painel do Gestor

**Goal**: O gestor audita toda a operação sem acessar o WhatsApp de ninguém — notas, evolução, transcrições e conversão em um só lugar (liberado apenas com isolamento cross-tenant provado na Phase 1; as notas exibidas vêm do cérebro provisório até a calibração da Phase 7)
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):

  1. Gestor vê a lista de conversas com nota, desfecho e data, filtrável por advogado, período, desfecho e faixa de nota
  2. Gestor vê a visão por advogado: média de notas, evolução no tempo e comparativo entre advogados
  3. Gestor abre qualquer conversa e lê a transcrição completa em formato de chat, com o diagnóstico detalhado (nota + acertos/erros/melhorias) lado a lado
  4. Gestor vê a taxa de conversão lead→contrato por advogado e por equipe, com o % de conversas sem desfecho marcado exposto

**Plans**: TBD
**UI hint**: yes

### Phase 6: Cobrança e LGPD Operacional

**Goal**: A operação está pronta para o beta fechado: assinatura por assento funcionando, acesso controlado por entitlement, obrigações LGPD operacionais cumpridas e onboarding pronto para os primeiros advogados — mas o beta em si só abre após o portão de calibração da Phase 7
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: BILL-01, BILL-02, BILL-03, LGPD-02, LGPD-03, LGPD-04, EXT-06
**Success Criteria** (what must be TRUE):

  1. Gestor assina por assento via Stripe Checkout em BRL e gerencia assinatura, cartões e faturas pelo Customer Portal
  2. Acesso à extensão e ao painel é liberado/bloqueado automaticamente via webhook do Stripe (com período de carência em falha de pagamento), e contas beta entram por cupom/assinatura cortesia
  3. Usuários aceitam termos de uso e política de privacidade (papéis controlador/operador claros) antes do primeiro uso
  4. Dados vencidos são expurgados automaticamente pela política de retenção, e a exclusão sob demanda apaga transcrições, análises e logs em cascata completa
  5. Advogado novo vê um tour de onboarding (3-4 passos) no primeiro uso do painel

**Plans**: TBD
**UI hint**: yes

### Phase 7: Cérebro de IA: Metodologia e Calibração (Portão do Beta)

**Goal**: O documento de metodologia da agência vira prompts versionados + rubrica, o cérebro provisório é substituído pela metodologia real, e o dono (especialista) confirma que as sugestões e os diagnósticos da IA convergem com o julgamento dele sobre conversas reais — o portão final de qualidade que abre o beta fechado
**Mode:** mvp
**Depends on**: Phase 4 (pipeline de sugestão e diagnóstico em produção); executa por último e é o portão do beta
**Requirements**: IA-01, IA-06, IA-07
**Success Criteria** (what must be TRUE):

  1. A metodologia documentada da agência existe como prompts + rubrica versionados armazenados só no servidor, e substitui o cérebro provisório por troca de artefato versionado, sem mudança de código
  2. Existe um conjunto dourado de 20-50 conversas reais avaliadas pelo dono, e a concordância nota-IA vs nota-especialista é medida e reportada
  3. O dono confirma, revisando as saídas, que sugestões e diagnósticos seguem a metodologia da agência e nunca contêm promessa de resultado nem captação vedada (OAB Provimento 205/2021 embutida na rubrica)
  4. Qualquer mudança de prompt/rubrica pode ser re-avaliada contra o conjunto dourado (regressão), e o beta fechado só abre com a calibração aceita pelo dono

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação Backend Multi-Tenant | 8/8 | Complete   | 2026-07-11 |
| 2. Extensão Chrome e Leitura do WhatsApp | 0/? | Not started | - |
| 3. Sugerir Resposta | 0/? | Not started | - |
| 4. Diagnóstico Automático e Desfecho | 0/? | Not started | - |
| 5. Painel do Gestor | 0/? | Not started | - |
| 6. Cobrança e LGPD Operacional | 0/? | Not started | - |
| 7. Cérebro de IA: Metodologia e Calibração (Portão do Beta) | 0/? | Not started | - |

---
*Roadmap created: 2026-07-04*
*Revised: 2026-07-08 — validação do cérebro de IA movida para a última fase a pedido do dono (documento de metodologia e conversas avaliadas só disponíveis no final); fases de IA operam com cérebro provisório versionado até a calibração*
*Coverage: 34/34 v1 requirements mapped*
*Research flags: Phase 7 (calibração LLM-as-judge — forte candidata a AI-SPEC via /gsd-ai-integration-phase), Phase 2 (estrutura do DOM do WhatsApp Web e decisão DOM-only vs wa-js — spike hands-on durante o planejamento)*
