# Requirements: Copiloto Jurídico WhatsApp

**Defined:** 2026-07-04
**Core Value:** O advogado recebe orientação de IA que efetivamente aumenta a conversão de leads em contratos — as sugestões e diagnósticos precisam convergir com o julgamento do dono (especialista em atendimento jurídico).

## v1 Requirements

Requisitos da versão inicial (beta fechado com clientes da agência). Cada um mapeia para fases do roadmap.

### Contas & Acesso (AUTH)

- [ ] **AUTH-01**: Advogado pode fazer login na extensão com e-mail/senha
- [ ] **AUTH-02**: Sessão do advogado persiste entre reinícios do navegador, com logout disponível
- [ ] **AUTH-03**: Usuário pode redefinir a senha via link por e-mail
- [x] **AUTH-04**: Gestor pode fazer login no painel web; papéis separados (gestor vê tudo, advogado não vê dados dos colegas)
- [x] **AUTH-05**: Gestor pode convidar e remover advogados da sua organização por e-mail

### Extensão & Leitura do WhatsApp (EXT)

- [ ] **EXT-01**: Advogado vê um painel lateral recolhível injetado no WhatsApp Web, que não obstrui a área de chat
- [ ] **EXT-02**: Painel reconhece qual conversa está aberta e reage à troca de conversa
- [ ] **EXT-03**: Extensão lê a transcrição da conversa ativa (texto, remetente, horário); mídias aparecem como marcadores ([áudio], [imagem], [documento])
- [ ] **EXT-04**: Transcrição é sincronizada continuamente com o servidor (idempotente, sem duplicar mensagens)
- [ ] **EXT-05**: Se o WhatsApp Web mudar e a leitura quebrar, o advogado vê um aviso amigável em pt-BR (não falha silenciosa); kill-switch remoto disponível
- [ ] **EXT-06**: Advogado vê um tour de onboarding (3-4 passos) no primeiro uso do painel
- [ ] **EXT-07**: Extensão não degrada a performance do WhatsApp Web (observers com throttle, sem polling)
- [ ] **EXT-08**: Extensão nunca envia mensagens nem escreve no DOM do WhatsApp — somente leitura (garantia arquitetural)

### Copiloto de IA (IA)

- [ ] **IA-01**: A metodologia documentada da agência existe como artefato versionado (prompts + rubrica de avaliação), armazenado só no servidor
- [ ] **IA-02**: Advogado clica em "Sugerir resposta" e recebe sugestão fundamentada na metodologia e no estágio da conversa (abertura/qualificação/objeção/fechamento), com estado de carregamento visível
- [ ] **IA-03**: Advogado copia a sugestão com um clique (feedback "copiado!")
- [ ] **IA-04**: Ao detectar inatividade na conversa, o sistema gera automaticamente o diagnóstico: nota 0-10 + acertos, erros, melhorias + resumo da conversa
- [ ] **IA-05**: Advogado pode gerar o diagnóstico manualmente ("Gerar diagnóstico agora")
- [ ] **IA-06**: Sugestões e diagnósticos nunca geram promessa de resultado nem captação vedada (conformidade OAB Provimento 205/2021 embutida na rubrica)
- [ ] **IA-07**: Existe um conjunto dourado de conversas reais avaliadas pelo dono, e a concordância nota-IA vs nota-especialista é medida antes do beta
- [ ] **IA-08**: Advogado vê o diagnóstico da conversa no painel lateral

### Conversas & Desfecho (CONV)

- [ ] **CONV-01**: Advogado marca o desfecho da conversa (contrato fechado / perdido), editável depois (contratos fecham dias após o chat)

### Painel do Gestor (DASH)

- [ ] **DASH-01**: Gestor vê lista de conversas com nota, desfecho e data, filtrável por advogado, período, desfecho e faixa de nota
- [ ] **DASH-02**: Gestor vê visão por advogado: média de notas, evolução no tempo e comparativo entre advogados
- [ ] **DASH-03**: Gestor lê a transcrição completa de qualquer conversa em formato de chat
- [ ] **DASH-04**: Gestor vê o diagnóstico detalhado (nota + acertos/erros/melhorias) lado a lado com a transcrição
- [ ] **DASH-05**: Gestor vê taxa de conversão lead→contrato por advogado e por equipe, com % de conversas sem desfecho marcado

### Cobrança (BILL)

- [ ] **BILL-01**: Organização assina por assento (por advogado) via Stripe Checkout em BRL
- [ ] **BILL-02**: Gestor gerencia assinatura, cartões e faturas pelo Stripe Customer Portal
- [ ] **BILL-03**: Acesso à extensão e ao painel é controlado por entitlement via webhook do Stripe (com período de carência em falha de pagamento); beta usa cupons/assinaturas cortesia

### LGPD & Compliance (LGPD)

- [ ] **LGPD-01**: Transcrições e análises são armazenadas criptografadas em repouso, em região brasileira (São Paulo)
- [ ] **LGPD-02**: Política de retenção definida com expurgo automático de dados vencidos
- [ ] **LGPD-03**: Usuários aceitam termos de uso e política de privacidade antes de usar (papéis controlador/operador claros)
- [ ] **LGPD-04**: Exclusão de dados sob demanda com cascata completa (transcrições, análises e logs)

## v2 Requirements

Adiados para versões futuras. Registrados, fora do roadmap atual.

### Áudio

- **AUDIO-01**: Mensagens de voz são transcritas e entram no contexto da IA (prioridade máxima da v1.x — leads jurídicos brasileiros mandam muito áudio)

### Visão do Advogado

- **ADV-01**: Advogado vê a própria evolução (média de notas, histórico) na extensão ou na web

### Feedback da IA

- **FDBK-01**: Advogado avalia sugestões com 👍/👎 (sinal para iteração de prompts)
- **FDBK-02**: Advogado pode registrar "discordo da nota" com comentário (alimenta calibração, não altera a nota)

### Notificações

- **NOTF-01**: Gestor recebe resumo semanal por e-mail (notas da equipe, conversões)

### SaaS Aberto

- **SAAS-01**: Cadastro self-service com trial para lançamento aberto ao mercado (pós-beta)

## Out of Scope

Exclusões explícitas. Documentadas para prevenir scope creep.

| Feature | Reason |
|---------|--------|
| Chatbot / envio automático de mensagens | Risco de banimento WhatsApp, exposição OAB (captação), destrói o posicionamento "copiloto humano" |
| Auto-inserir sugestão no campo de texto do WhatsApp | Escrever no DOM = um passo do auto-envio; aumenta superfície de detecção/banimento — copiar com um clique resolve |
| CRM kanban, etiquetas, agendamento, disparo em massa | Commoditizado (WaSpeed/WaLeads já fazem); dilui o diferencial de IA; usuário pode rodar em paralelo |
| Sugestão automática em tempo real a cada mensagem | Custo de IA explode; decidido sob demanda; reavaliar com unit economics na mão |
| Playbooks configuráveis por escritório | Multiplica a carga de calibração antes da metodologia fixa estar validada — sinal para v2 |
| Múltiplos atendentes no mesmo WhatsApp | Exige infraestrutura de envio e multiplexação de sessão — escopo enorme, risco de ban |
| Advogado editar/sobrescrever a nota da IA | Corrompe analytics do gestor e dados de calibração — feedback via FDBK-02 (v2) |
| App desktop/mobile, outros navegadores | V1 é Chrome + painel web; cobre o mercado do beta |

## Traceability

Mapeamento requisito → fase do roadmap. Atualizado na revisão do roadmap (2026-07-08): validação do cérebro de IA movida para a Phase 7 (portão do beta); demais fases renumeradas.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| EXT-01 | Phase 2 | Pending |
| EXT-02 | Phase 2 | Pending |
| EXT-03 | Phase 2 | Pending |
| EXT-04 | Phase 2 | Pending |
| EXT-05 | Phase 2 | Pending |
| EXT-06 | Phase 6 | Pending |
| EXT-07 | Phase 2 | Pending |
| EXT-08 | Phase 2 | Pending |
| IA-01 | Phase 7 | Pending |
| IA-02 | Phase 3 | Pending |
| IA-03 | Phase 3 | Pending |
| IA-04 | Phase 4 | Pending |
| IA-05 | Phase 4 | Pending |
| IA-06 | Phase 7 | Pending |
| IA-07 | Phase 7 | Pending |
| IA-08 | Phase 4 | Pending |
| CONV-01 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| BILL-01 | Phase 6 | Pending |
| BILL-02 | Phase 6 | Pending |
| BILL-03 | Phase 6 | Pending |
| LGPD-01 | Phase 1 | Pending |
| LGPD-02 | Phase 6 | Pending |
| LGPD-03 | Phase 6 | Pending |
| LGPD-04 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 34 total (contagem corrigida na criação do roadmap; nota anterior dizia 30)
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-08 after roadmap revision (traceability renumbered — AI brain validation moved to Phase 7)*
