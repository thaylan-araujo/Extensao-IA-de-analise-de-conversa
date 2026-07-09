# Phase 1: Fundação Backend Multi-Tenant - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 1-Fundação Backend Multi-Tenant
**Areas discussed:** Criação de organizações no beta, Papéis e permissões, Convite e remoção de advogados, Identidade dos e-mails do sistema

---

## Criação de organizações no beta

**Q1: Como um escritório passa a existir no sistema no beta fechado?**

| Option | Description | Selected |
|--------|-------------|----------|
| Você cadastra manualmente | Elite Juris cria organização e primeiro gestor para cada cliente; auto-cadastro fica para v2 (SAAS-01) | ✓ |
| Gestor se cadastra com código de convite | Auto-cadastro com link exclusivo; exige fluxo de cadastro já na Fase 1 | |
| Auto-cadastro livre | Qualquer pessoa cria conta; não combina com beta fechado | |

**Q2: Elite Juris precisa de visão acima das organizações?**

| Option | Description | Selected |
|--------|-------------|----------|
| Papel super-admin desde já | Cria escritórios/gestores e vê dados de qualquer organização (suporte + calibração Phase 7); interface pode ser simples | ✓ |
| Só criação técnica, sem visão dos dados | Cria organizações sem tela; mais privacidade, dificulta suporte e calibração | |
| Você decide depois | Schema preparado, papel não ativado | |

**Q3: Como o gestor recebe o acesso após o cadastro?**

| Option | Description | Selected |
|--------|-------------|----------|
| E-mail de convite com link | Gestor define a própria senha; mesmo mecanismo do convite de advogados | ✓ |
| Você define uma senha temporária | Senha circula por canal externo; troca obrigatória no 1º login | |

**Q4: Quais dados identificam um escritório no cadastro?**

| Option | Description | Selected |
|--------|-------------|----------|
| Só nome do escritório | Mínimo para o beta; CNPJ/faturamento na Fase 6 (Stripe) | ✓ |
| Nome + CNPJ desde já | Formalização antecipada; campo sem uso até a cobrança | |
| Cadastro completo | Nome, CNPJ, endereço, telefone, responsável legal | |

---

## Papéis e permissões

**Q1: Um escritório pode ter mais de um gestor?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, vários gestores | Papel por usuário; mesmos poderes (ver tudo, convidar, remover) | ✓ |
| Um gestor único por escritório | Mais simples, trava escritórios com sócios | |

**Q2: O gestor também atende leads (usa a extensão)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, gestor também atende | Conversas dele aparecem no painel; resolve o advogado solo | ✓ |
| Não, papéis separados | Advogado solo precisaria de duas contas | |

**Q3: O advogado (não-gestor) acessa o painel web na v1?**

| Option | Description | Selected |
|--------|-------------|----------|
| Não — só extensão | Painel web exclusivo de gestores/super-admin; ADV-01 permanece v2; aviso amigável se tentar entrar | ✓ |
| Sim, visão limitada | Antecipa ADV-01; aumenta escopo | |

**Q4: Um mesmo usuário pode pertencer a mais de um escritório?**

| Option | Description | Selected |
|--------|-------------|----------|
| Não — 1 usuário, 1 escritório | Mais simples; cobre o beta | ✓ |
| Sim, multi-organização | Complica login, extensão e isolamento sem demanda comprovada | |

---

## Convite e remoção de advogados

**Q1: O que acontece com o histórico ao remover um advogado?**

| Option | Description | Selected |
|--------|-------------|----------|
| Histórico permanece no painel | Perde acesso na hora; conversas/notas/conversão continuam visíveis (marcado "removido") | ✓ |
| Histórico some junto | Painel limpo, métricas mudam retroativamente | |
| Gestor escolhe na hora | Flexível, mais complexidade | |

**Q2: Como funciona o convite por e-mail?**

| Option | Description | Selected |
|--------|-------------|----------|
| Link com validade + reenvio | Expira (ex.: 7 dias); reenvio/cancelamento na tela de equipe | ✓ |
| Link sem validade | Convite antigo esquecido continua dando acesso | |

**Q3: Quais dados o advogado preenche ao aceitar o convite?**

| Option | Description | Selected |
|--------|-------------|----------|
| Nome + senha | Mínimo; e-mail vem do convite | ✓ |
| Nome + senha + celular | Campo a mais sem uso no produto | |
| Incluir número da OAB | Só se houver uso previsto | |

**Q4: Advogado removido pode ser reconvidado?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, e reassume o histórico | Conta reativada; histórico volta; não duplica pessoa nas métricas | ✓ |
| Sim, mas começa do zero | Perfil novo; histórico antigo arquivado | |
| Não permite reconvite | Rígido demais para a realidade dos escritórios | |

---

## Identidade dos e-mails do sistema

**Q1: Qual identidade de remetente usar nos e-mails do sistema?**

| Option | Description | Selected |
|--------|-------------|----------|
| Marca Elite Juris | Ex.: "Elite Juris <nao-responda@elitejuris.com.br>"; marca conhecida pelos clientes do beta; troca depois | ✓ |
| Nome provisório do produto | Exige escolher nome agora | |
| Você decide depois | Placeholder técnico durante o desenvolvimento | |

**Q2: Qual o tom dos e-mails do sistema?**

| Option | Description | Selected |
|--------|-------------|----------|
| Profissional e direto | "Você", texto curto, sem emojis; combina com público jurídico | ✓ |
| Formal | "Prezado Dr./Dra."; pode soar engessado | |
| Descontraído | Tom leve com emojis; arriscado para o público | |

---

## Claude's Discretion

- Detalhes de RLS/policies, modelagem do schema, mecanismo de criptografia, validade exata de links (convite/redefinição), política de senha
- Formato da interface admin mínima do super-admin na v1

## Deferred Ideas

- Auto-cadastro de organização com trial (SAAS-01, v2) — reconfirmado
- Advogado ver o próprio desempenho no painel (ADV-01, v2) — reconfirmado
- Usuário multi-organização — revisitar apenas com demanda real no beta
- Marca/nome definitivo do produto nos e-mails — trocar quando o nome for definido
