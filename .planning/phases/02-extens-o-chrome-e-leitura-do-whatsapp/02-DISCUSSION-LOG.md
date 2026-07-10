# Phase 2: Extensão Chrome e Leitura do WhatsApp - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 2-Extensão Chrome e Leitura do WhatsApp
**Areas discussed:** O que sincroniza (privacidade), Painel: aparência e conteúdo, Login e sessão na extensão, Quebra e kill-switch

---

## O que sincroniza (privacidade)

| Option | Description | Selected |
|--------|-------------|----------|
| Todas que o advogado abrir | Sincronização automática de toda conversa aberta com painel ativo | ✓ |
| Só as marcadas como lead | Opt-in por conversa ("monitorar este lead") | |
| Automático com exceções | Padrão automático + válvula "pessoal — não monitorar" | |

**User's choice:** Pediu recomendação ("O que recomenda?") e confirmou "Todas que o advogado abrir".
**Notes:** Racional aceito: auditoria íntegra (advogado não escolhe o que o gestor vê); beta usa número de trabalho; termos/onboarding (Fase 6) explicitam a leitura. Válvula de exceção registrada para v2.

| Option | Description | Selected |
|--------|-------------|----------|
| Ignorar grupos (Recomendado) | Só conversas 1:1; painel desativado em grupos | ✓ |
| Ler grupos também | Grupos abertos também sincronizados | |

**User's choice:** Ignorar grupos.

| Option | Description | Selected |
|--------|-------------|----------|
| O que estiver na tela + dali em diante (Recomendado) | Mensagens carregadas no DOM + novas; rolagem manual carrega mais | ✓ |
| Só mensagens novas | Ignora histórico anterior à instalação | |
| Buscar o histórico completo | Extensão rolaria sozinha para minerar histórico | |

**User's choice:** O que estiver na tela + dali em diante.

| Option | Description | Selected |
|--------|-------------|----------|
| Continua enquanto logado (Recomendado) | Recolher só esconde a UI; leitura segue; só logout pausa | ✓ |
| Painel recolhido = leitura pausada | Recolher também pausa a sincronização | |

**User's choice:** Continua enquanto logado.

---

## Painel: aparência e conteúdo

| Option | Description | Selected |
|--------|-------------|----------|
| Status enxuto (Recomendado) | Login, lead ativo, status "monitorada" + espaço reservado para IA | |
| Espelhar a transcrição | Exibir a transcrição capturada em tempo real | |
| Teaser completo da IA | Interface da Fase 3 já desenhada, desativada com "em breve" | ✓ |

**User's choice:** Teaser completo da IA — contrariou a recomendação; dono prefere painel pronto para demo desde já.

| Option | Description | Selected |
|--------|-------------|----------|
| Aberto, e lembra a escolha (Recomendado) | Aberto no 1º uso; depois persiste a preferência | ✓ |
| Sempre aberto | Expandido toda vez | |
| Sempre recolhido | Começa discreto | |

**User's choice:** Aberto, e lembra a escolha.

| Option | Description | Selected |
|--------|-------------|----------|
| Aba lateral fina (Recomendado) | Faixa estreita na borda direita com logo e seta (padrão WaSpeed/WaLeads) | ✓ |
| Botão flutuante | Botão redondo sobre o conteúdo | |

**User's choice:** Aba lateral fina.

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, discreto e sempre visível (Recomendado) | Sinal sutil "monitorada" mesmo recolhido | ✓ |
| Só dentro do painel aberto | Status apenas com painel expandido | |

**User's choice:** Sim, discreto e sempre visível.

---

## Login e sessão na extensão

| Option | Description | Selected |
|--------|-------------|----------|
| No próprio painel (Recomendado) | Formulário e-mail/senha na aba lateral sobre o WhatsApp | ✓ |
| No popup da extensão | Login pelo ícone na barra do Chrome | |

**User's choice:** No próprio painel.

| Option | Description | Selected |
|--------|-------------|----------|
| Até sair ou ser removido (Recomendado) | Persiste entre reinícios; termina só com logout/remoção | ✓ |
| Expira periodicamente | Vence a cada X dias | |

**User's choice:** Até sair ou ser removido.

| Option | Description | Selected |
|--------|-------------|----------|
| Aviso claro no painel (Recomendado) | "Seu acesso foi desativado — fale com seu gestor" | ✓ |
| Painel simplesmente desloga | Volta ao login sem explicação | |

**User's choice:** Aviso claro no painel.

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome Web Store, link não listado (Recomendado) | 1 clique + atualização automática; conta dev US$5 + revisão | ✓ |
| Instalação manual (modo desenvolvedor) | Arquivo enviado + carregamento manual | |

**User's choice:** Chrome Web Store, link não listado.

---

## Quebra e kill-switch

| Option | Description | Selected |
|--------|-------------|----------|
| Advogado + alerta interno (Recomendado) | Aviso no painel + alerta automático à Elite Juris; gestores não notificados | ✓ |
| Avisar gestores também | Notificação a cada gestor | |

**User's choice:** Advogado + alerta interno.

| Option | Description | Selected |
|--------|-------------|----------|
| Só a leitura, global (Recomendado) | Super-admin pausa a coleta de todos; painel vivo com aviso | ✓ |
| Granular por organização | Desligar por escritório | |
| Desligar a extensão inteira | Apaga tudo, inclusive painel e login | |

**User's choice:** Pediu recomendação ("o que recomenda?") e confirmou "Só a leitura, global" ("Sim").

| Option | Description | Selected |
|--------|-------------|----------|
| Honesto e tranquilizador (Recomendado) | Diz que a coleta está pausada e que volta sozinha | ✓ |
| Mínimo | "Funções temporariamente indisponíveis" | |

**User's choice:** Honesto e tranquilizador.

| Option | Description | Selected |
|--------|-------------|----------|
| E-mail (Recomendado) | Alerta automático para e-mail de operação | |
| Painel do super-admin | Indicador de saúde na tela admin da Fase 1 | ✓ |
| E-mail + painel | Ambos | |

**User's choice:** Painel do super-admin — contrariou a recomendação; dono prefere acompanhar pelo admin, e-mail fica como ideia futura.

---

## Claude's Discretion

- Arquitetura da leitura do DOM (seletores, observers com throttle, deduplicação/idempotência), transporte extensão→servidor, detecção automática de quebra, mecanismo da flag remota do kill-switch, garantia arquitetural do somente-leitura (EXT-08).
- Identificação estável do lead/conversa no servidor e modelagem das tabelas respeitando RLS da Fase 1.
- Texto final dos avisos (tom profissional/direto, pt-BR, sem emojis).

## Deferred Ideas

- Válvula "pessoal — não monitorar" por conversa (v2, se beta mostrar número pessoal em uso)
- Leitura de grupos (v2, caso raro)
- Kill-switch granular por organização (extensão futura)
- Alerta de quebra por e-mail (se o indicador no painel admin se mostrar insuficiente)
