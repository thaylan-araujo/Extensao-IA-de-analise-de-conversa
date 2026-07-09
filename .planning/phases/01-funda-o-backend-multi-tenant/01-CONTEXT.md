# Phase 1: Fundação Backend Multi-Tenant - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

A base de contas e dados do produto: organizações (escritórios), papéis gestor/advogado (+ super-admin da Elite Juris), convites por e-mail, redefinição de senha, e armazenamento criptografado em repouso em região brasileira (São Paulo) com isolamento entre tenants provado por testes cross-tenant automatizados em CI.

Cobre os requisitos AUTH-03 (redefinição de senha), AUTH-04 (login do gestor no painel web + papéis), AUTH-05 (convite/remoção de advogados) e LGPD-01 (criptografia em repouso em região brasileira). Extensão Chrome, leitura do WhatsApp, IA, painel de analytics e cobrança pertencem às fases 2-7.

</domain>

<decisions>
## Implementation Decisions

### Criação de organizações no beta
- **D-01:** Organizações são criadas **manualmente pela Elite Juris** no beta fechado — não há auto-cadastro de escritório. Auto-cadastro self-service permanece na v2 (SAAS-01).
- **D-02:** Existe um papel **super-admin** (Elite Juris) desde a Fase 1: cria organizações e gestores, e pode visualizar dados de qualquer organização (suporte + calibração da IA na Phase 7). A interface admin pode ser mínima/simples — o que importa é o papel existir no schema e nas policies de acesso.
- **D-03:** O primeiro gestor de um escritório recebe acesso por **e-mail de convite com link** para definir a própria senha — mesmo mecanismo do convite de advogados (um fluxo único de convite; nenhuma senha temporária circula).
- **D-04:** Cadastro de organização é mínimo: **só nome do escritório** (+ e-mail do gestor convidado). CNPJ e dados de faturamento entram na Fase 6 (Stripe).

### Papéis e permissões
- **D-05:** Uma organização pode ter **múltiplos gestores**, todos com os mesmos poderes (ver tudo da organização, convidar, remover). Papel é atributo por usuário.
- **D-06:** **Gestor também atende**: pode usar a extensão como advogado, e as conversas dele aparecem no painel junto com as da equipe. Isso cobre o advogado solo (uma pessoa com papel gestor que também atende — não precisa de duas contas).
- **D-07:** **Advogado (não-gestor) não acessa o painel web na v1** — usa apenas a extensão. Painel web é exclusivo de gestores e super-admin. Se um advogado tentar entrar no painel, vê um aviso amigável em pt-BR. (ADV-01, visão do próprio desempenho, permanece v2.)
- **D-08:** **1 usuário (e-mail) pertence a exatamente 1 organização.** Multi-organização fica fora da v1 — simplifica login, extensão e isolamento.

### Convite e remoção de advogados
- **D-09:** Convite por e-mail com **link com validade** (ex.: 7 dias). Gestor pode **reenviar ou cancelar** convites pendentes na tela de equipe.
- **D-10:** Cadastro do advogado convidado é mínimo: **nome completo + senha** (o e-mail já vem do convite). Sem celular, sem OAB.
- **D-11:** **Remoção preserva o histórico**: o advogado perde o acesso imediatamente, mas conversas, notas, diagnósticos e conversão dele continuam visíveis ao gestor, marcados como de membro "removido". Métricas do time não mudam retroativamente.
- **D-12:** **Reconvite reativa a conta**: se o mesmo e-mail for convidado de novo para o mesmo escritório, a conta é reativada e reassume o histórico antigo (não duplica pessoa nas métricas).

### Identidade dos e-mails do sistema
- **D-13:** Remetente dos e-mails transacionais (convite, redefinição de senha) usa a **marca Elite Juris** (ex.: `Elite Juris <nao-responda@elitejuris.com.br>`) enquanto o nome do produto é provisório. Configurável para trocar pela marca do produto depois, sem retrabalho.
- **D-14:** Tom dos e-mails: **profissional e direto** — tratamento por "você", texto curto e objetivo, sem emojis. Todo conteúdo em pt-BR.

### Claude's Discretion
- Detalhes técnicos de RLS/policies, modelagem exata do schema, mecanismo de criptografia (Supabase AES-256 em repouso), duração exata da validade do convite e do link de redefinição, política de senha — decisões do pesquisador/planner dentro da stack já definida em `.claude/CLAUDE.md`.
- Formato da "interface admin simples" do super-admin na v1 (pode ser tela mínima ou operação assistida por ferramenta interna), desde que criar organização + convidar gestor seja possível sem mexer no banco na mão.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projeto e requisitos
- `.planning/PROJECT.md` — visão do produto, decisões-chave (incl. cérebro provisório e LGPD no schema desde a Fase 1)
- `.planning/REQUIREMENTS.md` — AUTH-03/04/05 e LGPD-01 são os requisitos desta fase; traceability completa
- `.planning/ROADMAP.md` — goal e success criteria da Fase 1 (incl. testes cross-tenant em CI)

### Stack técnica (locked)
- `.claude/CLAUDE.md` — stack completa decidida: Supabase (Postgres + Auth + RLS keyed em `organization_id`, região sa-east-1 São Paulo, criptografia em repouso), Next.js 16 App Router (painel + API), TypeScript, monorepo com extensão WXT (Fase 2). Inclui padrões "What NOT to Use".

</canonical_refs>

<code_context>
## Existing Code Insights

Projeto greenfield — nenhum código existe ainda (repo contém apenas `.planning/` e `.claude/`). Esta fase cria a fundação: monorepo, projeto Supabase, schema inicial, auth e o app Next.js do painel.

### Established Patterns
- A stack em `.claude/CLAUDE.md` funciona como contrato: RLS multi-tenant enforced no banco (não na aplicação), `@supabase/ssr` no dashboard, migrations do Supabase CLI versionadas no repo, testes de RLS com chaves `anon` vs `service_role`.

### Integration Points
- O schema desta fase deve prever as entidades das fases seguintes (conversas/transcrições, diagnósticos, desfechos) ao menos nas tabelas centrais com criptografia e cascata de exclusão (LGPD-04 chega na Fase 6, mas a cascata é decidida no schema agora, não retrofitada).
- O papel super-admin precisa atravessar as policies de RLS de forma auditável (será usado na calibração da Phase 7).

</code_context>

<specifics>
## Specific Ideas

- Referências de UX do produto: waspeed.com.br e waleads.com.br (extensões com login por conta) — relevantes a partir da Fase 2, mas o modelo de conta criado aqui deve suportar esse fluxo.
- Beta fechado começa com clientes da agência Elite Juris — volume pequeno, provisioning manual é aceitável e desejado.

</specifics>

<deferred>
## Deferred Ideas

- **Auto-cadastro de organização com trial** — já registrado como SAAS-01 (v2), reconfirmado nesta discussão.
- **Advogado ver o próprio desempenho no painel web** — já registrado como ADV-01 (v2), reconfirmado nesta discussão.
- **Usuário multi-organização** — fora da v1 por decisão desta discussão; revisitar apenas se aparecer demanda real no beta.
- **Marca/nome definitivo do produto** — e-mails saem como Elite Juris por ora; troca de identidade quando o nome for definido (configuração, não código).

</deferred>

---

*Phase: 1-Fundação Backend Multi-Tenant*
*Context gathered: 2026-07-08*
