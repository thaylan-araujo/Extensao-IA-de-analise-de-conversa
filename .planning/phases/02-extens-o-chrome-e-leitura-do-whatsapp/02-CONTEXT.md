# Phase 2: Extensão Chrome e Leitura do WhatsApp - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A extensão Chrome que vive sobre o WhatsApp Web: painel lateral recolhível com login persistente (e-mail/senha da conta criada na Fase 1), leitura somente-leitura da conversa individual ativa (texto, remetente, horário; mídias como marcadores) e sincronização contínua e idempotente com o servidor — com aviso amigável + kill-switch remoto quando a leitura quebrar, e sem degradar a performance do WhatsApp Web.

Cobre AUTH-01, AUTH-02, EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-07 e EXT-08. Sugestões de IA (Fase 3), diagnósticos (Fase 4), tour de onboarding (Fase 6) e painel do gestor (Fase 5) ficam fora.

</domain>

<decisions>
## Implementation Decisions

### Escopo de leitura e privacidade
- **D-01:** Sincroniza **todas as conversas individuais que o advogado abrir** com a extensão logada — automático, sem opt-in por conversa e sem lista de exceções na v1. Racional: a auditoria do gestor só funciona íntegra se o advogado não escolhe o que ela vê; o público do beta atende em número de trabalho. Termos de uso e onboarding (Fase 6) explicitam a leitura.
- **D-02:** **Grupos e comunidades são ignorados.** Com um grupo aberto, o painel aparece desativado com aviso "grupo não é monitorado".
- **D-03:** **Histórico:** ao abrir uma conversa, sincroniza as mensagens que o WhatsApp Web já carregou na tela + tudo dali em diante. Rolagem manual do advogado carrega mais mensagens e elas também entram. A extensão **nunca rola sozinha** para minerar histórico (performance EXT-07 + risco de detecção).
- **D-04:** **Recolher o painel não pausa a leitura.** A sincronização roda enquanto houver sessão ativa; só o logout (ou remoção/kill-switch) interrompe.

### Painel: aparência e conteúdo
- **D-05:** O painel nasce com a **interface completa da IA já desenhada porém desativada** (botão "Sugerir resposta", área de diagnóstico, com rótulo "em breve"). Pronto para demo; a Fase 3 apenas ativa os controles. Além do teaser: usuário logado, lead da conversa ativa e status de monitoramento.
- **D-06:** **Estado inicial:** aberto no primeiro uso; depois lembra a última escolha do advogado (persistida entre sessões).
- **D-07:** **Recolhido = aba lateral fina** colada na borda direita, com logo e seta para expandir (padrão WaSpeed/WaLeads). Nunca cobre mensagens do chat.
- **D-08:** **Indicador de monitoramento sempre visível** — sinal discreto (ex.: ponto verde "monitorada") presente mesmo com o painel recolhido. Transparência com o advogado + diagnóstico fácil pelo suporte.

### Login e sessão
- **D-09:** **Login dentro do próprio painel**: deslogado, a aba lateral mostra o formulário e-mail/senha sobre o WhatsApp Web. O popup da extensão não é o caminho principal.
- **D-10:** **Sessão persiste até logout ou remoção** — sobrevive a reinícios do Chrome, sem expiração periódica. A segurança vem da revogação imediata na remoção (D-11 da Fase 1).
- **D-11:** **Advogado removido vê aviso claro**: painel troca para "Seu acesso foi desativado — fale com seu gestor"; leitura para imediatamente e os controles somem.
- **D-12:** **Distribuição via Chrome Web Store com link não listado** (unlisted): instalação de 1 clique e atualização automática — essencial para corrigir a leitura rápido quando o WhatsApp mudar. Prever conta de desenvolvedor Google (taxa única US$5) e prazo de revisão da loja (dias).

### Quebra e kill-switch
- **D-13:** **Quando a leitura quebra**: o advogado vê aviso honesto e tranquilizador em pt-BR (ex.: "O WhatsApp mudou e estamos ajustando a leitura. Suas conversas não estão sendo registradas neste momento e as funções de IA estão pausadas. Você não precisa fazer nada — voltaremos automaticamente."). Diz explicitamente que a coleta está pausada. Gestores dos escritórios **não** são notificados.
- **D-14:** **Alerta interno via painel do super-admin**: indicador de saúde da leitura na tela de admin criada na Fase 1 (sem e-mail de alerta na v1). A Elite Juris acompanha por ali.
- **D-15:** **Kill-switch: global e desliga só a leitura/sincronização.** Acionado pela Elite Juris (super-admin), afeta todos os usuários de uma vez; painel e login continuam vivos exibindo o aviso de D-13. Quando reativado (ou a correção chega via atualização automática da loja), a leitura volta sozinha, sem ação do advogado. Granularidade por organização fica para depois (extensível, não construída agora).

### Claude's Discretion
- Arquitetura técnica da leitura do DOM (seletores resilientes, MutationObserver com throttle, estratégia de deduplicação/idempotência da sincronização), formato do transporte extensão→servidor, detecção automática de quebra (heurísticas), mecanismo do kill-switch (flag remota consultada pela extensão), e como garantir arquiteturalmente o somente-leitura (EXT-08) — decisões do pesquisador/planner dentro da stack do `.claude/CLAUDE.md` (WXT, React 19, supabase-js com adapter chrome.storage, Shadow DOM para o painel).
- Identificação do lead/conversa no servidor (chave estável por contato) e modelagem das tabelas de conversas/mensagens — deve respeitar o schema multi-tenant e RLS da Fase 1.
- Texto final dos avisos (seguindo o tom D-13/D-14 da Fase 1: profissional, direto, "você", sem emojis, pt-BR).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projeto e requisitos
- `.planning/PROJECT.md` — visão do produto; "Out of Scope" veta chatbot, auto-inserção no campo de texto e CRM; leitura via DOM é decisão consciente com risco assumido
- `.planning/REQUIREMENTS.md` — AUTH-01/02 e EXT-01..05/07/08 são os requisitos desta fase; EXT-06 (tour) é Fase 6
- `.planning/ROADMAP.md` — goal e success criteria da Fase 2 (incl. garantia arquitetural de somente-leitura)

### Stack técnica (locked)
- `.claude/CLAUDE.md` — WXT 0.20.x + React 19 para a extensão MV3, painel em Shadow DOM injetado (NÃO usar chrome.sidePanel), supabase-js com storage adapter em chrome.storage.local para sessão, "What NOT to Use" (proíbe whatsapp-web.js/Baileys e qualquer automação de envio)

### Fundação da Fase 1 (consumida por esta fase)
- `.planning/phases/01-funda-o-backend-multi-tenant/01-CONTEXT.md` — decisões de conta/papéis que a extensão herda (D-07 advogado não acessa painel web; D-08 1 usuário = 1 org; D-11 remoção revoga acesso imediatamente)
- `.planning/phases/01-funda-o-backend-multi-tenant/01-RESEARCH.md` — padrões de RLS via security definer, revogação de sessão e helpers do schema que a sincronização de conversas deve respeitar

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Fase 1 (em execução) entrega: monorepo pnpm (`apps/web` + `packages/shared`), projeto Supabase sa-east-1 com schema multi-tenant + RLS, auth com papéis (super_admin/gestor/advogado) e painel admin do super-admin — a extensão nasce como novo app do monorepo (ex.: `apps/extension`) consumindo a mesma auth e o mesmo banco.
- Tela de admin do super-admin (plano 01-07) é onde o indicador de saúde da leitura (D-14) e o kill-switch (D-15) devem viver.

### Established Patterns
- Isolamento por RLS keyed em `organization_id`, enforced no banco; a sincronização de mensagens escreve sob a sessão do advogado (RLS), não com service_role no cliente.
- Enums e tipos compartilhados vivem em `packages/shared` (contrato literal do schema).

### Integration Points
- Sessão da extensão usa a mesma conta Supabase Auth da Fase 1 (e-mail/senha), com storage adapter em `chrome.storage.local`.
- Tabelas de conversas/mensagens criadas nesta fase devem prever as fases 3-5 (diagnósticos referenciam conversas; painel do gestor lê transcrições) e a cascata de exclusão LGPD decidida no schema da Fase 1.
- Kill-switch: flag remota lida pela extensão + controle na tela admin do super-admin (Fase 1).

</code_context>

<specifics>
## Specific Ideas

- Referências visuais e de comportamento: **waspeed.com.br e waleads.com.br** — painel lateral flush colado no WhatsApp Web, aba fina quando recolhido, login por conta dentro do painel.
- O aviso de quebra deve dizer explicitamente que as conversas **não estão sendo registradas** no momento (transparência sobre o gap de auditoria) e que a volta é automática.
- Beta fechado: distribuição do link não listado da Chrome Web Store feita pela Elite Juris diretamente aos escritórios.

</specifics>

<deferred>
## Deferred Ideas

- **Válvula "pessoal — não monitorar" por conversa** — v2, somente se o beta mostrar advogados usando número pessoal (reabre discussão de integridade da auditoria vs privacidade).
- **Leitura de grupos** — v2, caso raro de escritórios que atendem leads em grupo (ex.: casal no mesmo caso).
- **Kill-switch granular por organização** — extensão futura do mecanismo global; não construir agora.
- **Alerta de quebra por e-mail à Elite Juris** — v1 usa só o indicador no painel admin (D-14); e-mail pode ser adicionado se o painel se mostrar insuficiente.
- **Tour de onboarding (EXT-06)** — já mapeado para a Fase 6.

</deferred>

---

*Phase: 2-Extensão Chrome e Leitura do WhatsApp*
*Context gathered: 2026-07-10*
