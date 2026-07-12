# Phase 2: Extensão Chrome e Leitura do WhatsApp - Research

**Researched:** 2026-07-11
**Domain:** Extensão Chrome MV3 (WXT + React 19 + Shadow DOM) · leitura resiliente do DOM do WhatsApp Web · Supabase Auth em extensão · sincronização idempotente sob RLS
**Confidence:** MEDIUM (arquitetura e stack HIGH; seletores específicos do WhatsApp Web são ASSUMED até o spike hands-on)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Escopo de leitura e privacidade
- **D-01:** Sincroniza **todas as conversas individuais que o advogado abrir** com a extensão logada — automático, sem opt-in por conversa e sem lista de exceções na v1. Racional: a auditoria do gestor só funciona íntegra se o advogado não escolhe o que ela vê; o público do beta atende em número de trabalho. Termos de uso e onboarding (Fase 6) explicitam a leitura.
- **D-02:** **Grupos e comunidades são ignorados.** Com um grupo aberto, o painel aparece desativado com aviso "grupo não é monitorado".
- **D-03:** **Histórico:** ao abrir uma conversa, sincroniza as mensagens que o WhatsApp Web já carregou na tela + tudo dali em diante. Rolagem manual do advogado carrega mais mensagens e elas também entram. A extensão **nunca rola sozinha** para minerar histórico (performance EXT-07 + risco de detecção).
- **D-04:** **Recolher o painel não pausa a leitura.** A sincronização roda enquanto houver sessão ativa; só o logout (ou remoção/kill-switch) interrompe.

#### Painel: aparência e conteúdo
- **D-05:** O painel nasce com a **interface completa da IA já desenhada porém desativada** (botão "Sugerir resposta", área de diagnóstico, com rótulo "em breve"). Pronto para demo; a Fase 3 apenas ativa os controles. Além do teaser: usuário logado, lead da conversa ativa e status de monitoramento.
- **D-06:** **Estado inicial:** aberto no primeiro uso; depois lembra a última escolha do advogado (persistida entre sessões).
- **D-07:** **Recolhido = aba lateral fina** colada na borda direita, com logo e seta para expandir (padrão WaSpeed/WaLeads). Nunca cobre mensagens do chat.
- **D-08:** **Indicador de monitoramento sempre visível** — sinal discreto (ex.: ponto verde "monitorada") presente mesmo com o painel recolhido. Transparência com o advogado + diagnóstico fácil pelo suporte.

#### Login e sessão
- **D-09:** **Login dentro do próprio painel**: deslogado, a aba lateral mostra o formulário e-mail/senha sobre o WhatsApp Web. O popup da extensão não é o caminho principal.
- **D-10:** **Sessão persiste até logout ou remoção** — sobrevive a reinícios do Chrome, sem expiração periódica. A segurança vem da revogação imediata na remoção (D-11 da Fase 1).
- **D-11:** **Advogado removido vê aviso claro**: painel troca para "Seu acesso foi desativado — fale com seu gestor"; leitura para imediatamente e os controles somem.
- **D-12:** **Distribuição via Chrome Web Store com link não listado** (unlisted): instalação de 1 clique e atualização automática — essencial para corrigir a leitura rápido quando o WhatsApp mudar. Prever conta de desenvolvedor Google (taxa única US$5) e prazo de revisão da loja (dias).

#### Quebra e kill-switch
- **D-13:** **Quando a leitura quebra**: o advogado vê aviso honesto e tranquilizador em pt-BR (ex.: "O WhatsApp mudou e estamos ajustando a leitura. Suas conversas não estão sendo registradas neste momento e as funções de IA estão pausadas. Você não precisa fazer nada — voltaremos automaticamente."). Diz explicitamente que a coleta está pausada. Gestores dos escritórios **não** são notificados.
- **D-14:** **Alerta interno via painel do super-admin**: indicador de saúde da leitura na tela de admin criada na Fase 1 (sem e-mail de alerta na v1). A Elite Juris acompanha por ali.
- **D-15:** **Kill-switch: global e desliga só a leitura/sincronização.** Acionado pela Elite Juris (super-admin), afeta todos os usuários de uma vez; painel e login continuam vivos exibindo o aviso de D-13. Quando reativado (ou a correção chega via atualização automática da loja), a leitura volta sozinha, sem ação do advogado. Granularidade por organização fica para depois (extensível, não construída agora).

### Claude's Discretion
- Arquitetura técnica da leitura do DOM (seletores resilientes, MutationObserver com throttle, estratégia de deduplicação/idempotência da sincronização), formato do transporte extensão→servidor, detecção automática de quebra (heurísticas), mecanismo do kill-switch (flag remota consultada pela extensão), e como garantir arquiteturalmente o somente-leitura (EXT-08) — decisões do pesquisador/planner dentro da stack do `.claude/CLAUDE.md` (WXT, React 19, supabase-js com adapter chrome.storage, Shadow DOM para o painel).
- Identificação do lead/conversa no servidor (chave estável por contato) e modelagem das tabelas de conversas/mensagens — deve respeitar o schema multi-tenant e RLS da Fase 1.
- Texto final dos avisos (seguindo o tom D-13/D-14 da Fase 1: profissional, direto, "você", sem emojis, pt-BR).

### Deferred Ideas (OUT OF SCOPE)
- **Válvula "pessoal — não monitorar" por conversa** — v2, somente se o beta mostrar advogados usando número pessoal (reabre discussão de integridade da auditoria vs privacidade).
- **Leitura de grupos** — v2, caso raro de escritórios que atendem leads em grupo (ex.: casal no mesmo caso).
- **Kill-switch granular por organização** — extensão futura do mecanismo global; não construir agora.
- **Alerta de quebra por e-mail à Elite Juris** — v1 usa só o indicador no painel admin (D-14); e-mail pode ser adicionado se o painel se mostrar insuficiente.
- **Tour de onboarding (EXT-06)** — já mapeado para a Fase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Advogado faz login na extensão com e-mail/senha | `supabase.auth.signInWithPassword` no painel (D-09), com storage adapter em `chrome.storage.local` — ver Pattern 2 e Code Examples |
| AUTH-02 | Sessão persiste entre reinícios do navegador, com logout disponível | `chrome.storage.local` persiste por instalação; `persistSession: true` + `autoRefreshToken: true` no contexto longevo (content script). Logout = `signOut()` + limpeza de estado — Pattern 2, Pitfall 3 |
| EXT-01 | Painel lateral recolhível injetado, sem obstruir o chat | WXT `createShadowRootUi` + `cssInjectionMode: 'ui'`; largura reservada comprimindo o WhatsApp (não sobrepondo) — Pattern 1; contrato visual completo no 02-UI-SPEC.md |
| EXT-02 | Painel reconhece a conversa aberta e reage à troca | WhatsApp Web NÃO muda a URL por conversa — detecção via MutationObserver no container do app observando a troca do `#main` — Pattern 3 |
| EXT-03 | Lê transcrição (texto, remetente, horário); mídias como marcadores | Extração por `[data-id]` + `[data-pre-plain-text]` + `span.selectable-text`; mídias por heurística de elementos (marcadores [áudio]/[imagem]/[documento]) — Pattern 4 (seletores ASSUMED até o spike) |
| EXT-04 | Sincronização contínua e idempotente (sem duplicar) | `data-id` da mensagem é id serializado globalmente único → unique constraint no banco + upsert `ON CONFLICT DO NOTHING` — Pattern 5 |
| EXT-05 | Aviso amigável pt-BR na quebra + kill-switch remoto | Heurísticas de canário (âncora presente + extração vazia) → estado `broken` + banner D-13; kill-switch = flag em tabela `app_settings` lida pela extensão — Patterns 6 e 7 |
| EXT-07 | Não degrada a performance do WhatsApp Web | Observers estreitos + debounce, extração em `requestIdleCallback`, batch de upserts, zero polling de DOM — Pattern 3 e Pitfall 5 |
| EXT-08 | Nunca envia mensagens nem escreve no DOM — somente leitura | Módulo reader só com APIs de leitura; lint/CI gate proibindo APIs de escrita/eventos sintéticos; única mutação permitida e documentada = host do painel + reserva de largura — Pattern 8 |
</phase_requirements>

## Summary

Esta fase constrói o segundo app do monorepo (`apps/extension`) com WXT 0.20 + React 19 + Tailwind 4, tudo dentro de um Shadow DOM injetado em `web.whatsapp.com`. A pesquisa confirmou que o caminho técnico está bem pavimentado nos três eixos de risco: (1) o WXT tem suporte de primeira classe a UI em shadow root com CSS escopado (`createShadowRootUi` + `cssInjectionMode: 'ui'`); (2) o padrão supabase-js em extensão MV3 é conhecido — storage adapter custom sobre `chrome.storage.local`, que persiste entre reinícios do Chrome e cobre AUTH-02 sem trabalho adicional; (3) o DOM do WhatsApp Web, apesar de ofuscado nas classes, expõe atributos semânticos estáveis há anos: cada linha de mensagem carrega `data-id` com o id serializado (`{fromMe}_{chatId}_{hash}`) — um identificador globalmente único que resolve a deduplicação (EXT-04) por unique constraint no banco, e cujo sufixo `@c.us` vs `@g.us` distingue conversa individual de grupo (D-02).

O maior risco continua sendo a fragilidade dos seletores: classes são ofuscadas e mudam a cada deploy do WhatsApp, então **toda a extração deve ancorar em atributos semânticos** (`data-id`, `data-pre-plain-text`, roles ARIA) e nunca em classes geradas ou `nth-child`. Mesmo assim, os seletores exatos citados nesta pesquisa vêm de projetos de automação e material de comunidade — estão marcados [ASSUMED] e **o plano deve começar com um spike hands-on** (já sinalizado em STATE.md) que valida os seletores contra o WhatsApp Web real e captura fixtures de HTML para testes de regressão. Um achado novo e relevante: em 2025/2026 o WhatsApp passou a migrar identificadores de contato de `@c.us` para `@lid` em alguns fluxos — o `wa_chat_id` deve ser tratado como string opaca, não como telefone.

Sobre o risco de banimento: a evidência pública (derrubada de ~131 extensões pela Meta em out/2025, FAQs do WhatsApp) mostra que o enforcement mira **comportamento de envio/automação** (spam, mensagens em massa), não leitura passiva do DOM — o que reforça a decisão de arquitetura somente-leitura (EXT-08) como mitigação primária, e ferramentas como WaSpeed/WA Web Plus operam há anos nesse modelo. A garantia arquitetural deve ser verificável: módulo de leitura isolado que só usa APIs de leitura, com gate de lint/CI proibindo `dispatchEvent`, `execCommand`, `.click()` e atribuições de `.value` fora do próprio painel.

**Primary recommendation:** um único content script em `web.whatsapp.com` com três módulos — painel (Shadow DOM/React), reader (observers + extração) e sync (supabase-js com adapter `chrome.storage.local`, upsert idempotente em lotes) — cliente Supabase vivendo no próprio content script (a aba do WhatsApp é longeva; evita o ciclo de vida traiçoeiro do service worker MV3), kill-switch como flag em tabela `app_settings` consultada na inicialização e a cada lote, e spike de validação de seletores como primeira entrega da fase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Painel lateral (UI, login, estados) | Browser/Client (content script + Shadow DOM) | — | Vive sobre o WhatsApp Web; Shadow DOM isola estilos nos dois sentidos |
| Autenticação (login e-mail/senha, sessão) | Browser/Client (supabase-js + chrome.storage.local) | Supabase Auth (GoTrue) | Mesma conta da Fase 1; sessão local à extensão; revogação server-side via ban (Fase 1 D-11) |
| Leitura do DOM (extração de mensagens) | Browser/Client (módulo reader do content script) | — | Só o content script vê o DOM; read-only por construção |
| Sincronização de mensagens | Browser/Client (batch) → Database | Database (unique constraint + RLS) | Escrita sob a sessão do advogado (RLS org isola); idempotência garantida no banco, não no cliente |
| Identidade da conversa/lead | Database (`conversations` unique por advogado+chat) | Browser/Client (extrai `wa_chat_id`) | Chave estável por contato definida no schema; extensão só reporta |
| Kill-switch global | Database (tabela `app_settings`) + API admin | Browser/Client (poll da flag) | Flag remota single source of truth; super-admin escreve, extensão lê |
| Saúde da leitura (D-14) | Database (tabela `reader_status`) + painel admin (apps/web) | Browser/Client (reporta status) | Extensão reporta heartbeat/quebra; tela admin da Fase 1 agrega |
| Detecção de quebra | Browser/Client (heurísticas de canário) | Database (registro do status) | Só o cliente sabe se a extração falhou; servidor só exibe |
| Distribuição/atualização | Chrome Web Store (unlisted) | — | Auto-update do Chrome; sem código remoto (proibido no MV3) |

## Project Constraints (from CLAUDE.md)

- **Stack travada:** TypeScript 5.x (pin `~5.9.3` — latest é 7.x), WXT 0.20.x + React 19 para a extensão MV3, Tailwind 4 escopado no Shadow DOM, supabase-js com storage adapter `chrome.storage.local`, TanStack Query 5 para chamadas client-side, Zod 4 para validação.
- **Painel injetado em Shadow DOM — NÃO usar `chrome.sidePanel`** (UX flush estilo WaSpeed é requisito).
- **PROIBIDO:** whatsapp-web.js / Baileys (automação por protocolo = padrão banível e arquitetura errada); Plasmo; chave da Anthropic na extensão (irrelevante nesta fase — nenhuma chamada de IA aqui); LangChain.
- **Leitura via DOM do próprio tab aberto, read-only** — decisão consciente do projeto com risco assumido (PROJECT.md).
- **Out of Scope veta:** auto-inserção no campo de texto, envio automático, CRM.
- **Monorepo pnpm** — `apps/extension` novo app ao lado de `apps/web`; tipos compartilhados em `packages/shared`.
- **Vitest + Playwright** para testes; WXT tem padrões documentados de Playwright com extensão unpacked.
- **Idioma:** interface e avisos em pt-BR; GSD workflow enforcement para mudanças de arquivo.

## Standard Stack

Versões verificadas ao vivo no npm em 2026-07-11 [VERIFIED: npm registry].

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `wxt` | 0.20.27 | Framework MV3 (build, manifest, HMR, `createShadowRootUi`) | Travado em CLAUDE.md; consenso 2025/2026; resolve shadow-root UI + CSS escopado nativamente |
| `@wxt-dev/module-react` | 1.2.2 | Integração React no WXT | Módulo oficial do WXT para React |
| `react` / `react-dom` | 19.2.7 | UI do painel | Travado em CLAUDE.md; mesma versão do dashboard |
| `@supabase/supabase-js` | 2.110.2 | Auth + escrita de conversas/mensagens sob RLS | Travado em CLAUDE.md; storage adapter custom cobre MV3 |
| `tailwindcss` | 4.3.2 | Estilo do painel (dentro do Shadow DOM) | Travado em CLAUDE.md; v4 com integração Vite zero-config |
| `typescript` | **~5.9.3 (pin!)** | Linguagem | `latest` no npm é 7.0.2 — pinar 5.9.x (mesmo pitfall da Fase 1) |
| `zod` | 4.4.3 | Validação dos payloads de sync e da flag remota | Travado em CLAUDE.md; `packages/shared` já usa |
| `lucide-react` | 1.24.0 | Ícones do painel (Chevron, LogOut, AlertTriangle) | Definido no 02-UI-SPEC.md; tree-shakeable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | 5.101.2 | Estado assíncrono no painel (perfil, flag, status) | Consultas do painel; opcional na v1 — estado local + supabase-js pode bastar para o escopo desta fase |
| `vitest` | 4.1.x | Testes unitários do parser/dedup com fixtures de DOM | Sempre — é a principal rede de proteção contra drift de seletor |
| `happy-dom` ou `jsdom` | latest | DOM environment para testar extração contra fixtures HTML | Testes do módulo reader |
| `playwright` | 1.5x | E2E carregando a extensão unpacked | Smoke test do build; NÃO para WhatsApp real em CI (exige login por QR) |
| `supabase` (CLI, devDep) | 2.109.x | Migration desta fase (colunas de dedup, `app_settings`, `reader_status`) + pgTAP | Já é padrão do repo |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extração via DOM (seletores) | Injetar script no MAIN world e ler o Store interno do WhatsApp (técnica wa-js/WA Web Plus) | O Store dá dados estruturados (sem parsing de DOM), mas toca o JavaScript interno do WhatsApp — maior superfície de detecção (Code Verify acusa tampering), mais frágil a ofuscação e contraria o espírito read-only do PROJECT.md. **Fallback documentado no roadmap, não v1.** Só reavaliar se o spike mostrar DOM inviável |
| Cliente Supabase no content script | Cliente no background service worker (mensageria content→SW) | SW centraliza rede e ignora CORS via host_permissions, mas MV3 mata o SW após ~30s ocioso — `autoRefreshToken` (setInterval) morre, exigindo chrome.alarms + refresh on-demand. A aba do WhatsApp é longeva, então o content script é o contexto estável. Migrar para SW apenas se CSP/CORS bloquear fetch do content script (não esperado: Supabase responde `Access-Control-Allow-Origin: *`) |
| Flag kill-switch em tabela Postgres | Edge Config/Statsig/feature-flag SaaS | Tabela própria = zero dependência nova, RLS pronto, admin da Fase 1 escreve nela; latência de poll (minutos) é aceitável para o caso de uso |
| Upsert direto via supabase-js (RLS) | Route Handler `/api/sync` no Next.js | Route Handler adicionaria validação server-side extra, mas duplica o que o RLS + constraints já garantem, adiciona latência e um deploy acoplado; supabase-js sob a sessão do advogado é o padrão estabelecido na Fase 1 ("escreve sob a sessão do advogado, não service_role") |
| `data-id` como chave de dedup | Hash de (conteúdo + horário + remetente) | Hash colide em mensagens repetidas ("ok", "bom dia") e quebra com edição; `data-id` é o id nativo do WhatsApp, único e estável |

**Installation:**
```bash
# novo app no monorepo
pnpm create wxt@latest apps/extension   # template react
pnpm --filter extension add @supabase/supabase-js zod lucide-react @tanstack/react-query
pnpm --filter extension add -D typescript@~5.9.3 vitest happy-dom tailwindcss
```

**Version verification:** todas as versões confirmadas com `npm view <pkg> version` em 2026-07-11 [VERIFIED: npm registry].

## Package Legitimacy Audit

Seam `package-legitimacy check` executado em 2026-07-11 (ecosystem npm). Mesmo padrão da Fase 1: pacotes canônicos com verdict `SUS` por razão única `too-new` (último release < ~7 dias — ciclo de release rápido), todos com milhões de downloads semanais e repositório oficial.

| Package | Registry | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-------------|---------|-------------|
| wxt | npm | 954K/wk | github.com/wxt-dev/wxt | SUS (too-new) | Flagged — repo oficial; **pin 0.20.27** neutraliza |
| @wxt-dev/module-react | npm | 425K/wk | github.com/wxt-dev/wxt | OK | Approved |
| lucide-react | npm | 72.8M/wk | github.com/lucide-icons/lucide | SUS (too-new) | Flagged — pin 1.24.x |
| @supabase/supabase-js | npm | 20.7M/wk | github.com/supabase/supabase-js | SUS (too-new) | Flagged — pin 2.110.x |
| @tanstack/react-query | npm | 60.6M/wk | github.com/TanStack/query | SUS (too-new) | Flagged — pin 5.101.x |
| zod | npm | 221M/wk | github.com/colinhacks/zod | OK | Approved |
| tailwindcss | npm | 106M/wk | github.com/tailwindlabs/tailwindcss | SUS (too-new) | Flagged — pin 4.3.x |
| react / react-dom | npm | 150M/118M/wk | github.com/facebook/react | OK | Approved |
| typescript | npm | 223M/wk | github.com/microsoft/TypeScript | SUS (too-new) | Flagged — **pin `~5.9.3` obrigatório** (latest = 7.x) |
| vitest | npm | 75M/wk | github.com/vitest-dev/vitest | SUS (too-new) | Flagged — pin 4.1.x |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** todos por `too-new`. Mitigação (mesma da Fase 1, já aceita): **pinar as versões exatas verificadas acima** na task de scaffold, em vez de `latest`. Nenhum pacote tem `postinstall` (verificado no output do seam — campo `postinstall: null` em todos).

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────── Chrome (aba web.whatsapp.com) ──────────────────────────┐
│                                                                                    │
│  WhatsApp Web (DOM da página)                 apps/extension (content script)      │
│  ┌──────────────────────────────┐             ┌──────────────────────────────────┐ │
│  │ #main (conversa ativa)       │  observa    │ READER (somente leitura)         │ │
│  │  ├─ header (nome do contato) │◀────────────│  observer A: troca de conversa   │ │
│  │  ├─ lista de mensagens       │  MutationOb │  observer B: novas mensagens     │ │
│  │  │   [data-id] por linha     │  (debounce) │  extração → MessageDTO[]         │ │
│  │  └─ rodapé (campo de texto)  │   NUNCA     │  canário: detecta quebra         │ │
│  └──────────────────────────────┘   escreve   └───────────┬──────────────────────┘ │
│         ▲ única mutação permitida:             fila local  │ lotes                  │
│         │ reserva de largura (360px)                       ▼                        │
│  ┌──────┴───────────────────────┐             ┌──────────────────────────────────┐ │
│  │ host do painel (Shadow DOM)  │             │ SYNC (supabase-js, sessão do     │ │
│  │  React 19 + Tailwind 4       │◀── estado ──│ advogado, adapter chrome.storage)│ │
│  │  login | lead | status | IA  │             │  upsert conversations/messages   │ │
│  │  teaser | avisos D-13/D-11   │             │  poll flag kill-switch           │ │
│  └──────────────────────────────┘             │  heartbeat reader_status         │ │
│                                               └───────────┬──────────────────────┘ │
└───────────────────────────────────────────────────────────┼────────────────────────┘
                                                 HTTPS (CORS │ ACAO:*)
                                                             ▼
                              ┌─────────────────────────────────────────────┐
                              │ Supabase (sa-east-1) — Fase 1               │
                              │  Auth (mesma conta e-mail/senha)            │
                              │  Postgres + RLS por organization_id        │
                              │   conversations ─ messages (unique wa_id)  │
                              │   app_settings (kill-switch, RW super-adm) │
                              │   reader_status (saúde, lida pelo admin)   │
                              └───────────────┬─────────────────────────────┘
                                              │
                              apps/web /admin (Fase 1): toggle kill-switch
                                              + indicador de saúde (D-14)
```

Fluxo primário: advogado abre conversa → observer A detecta troca do `#main` → reader extrai `wa_chat_id` + nome do contato do header → registra/atualiza `conversations` → extrai mensagens visíveis (`[data-id]`) → fila local dedupe → sync envia lote (upsert `ON CONFLICT DO NOTHING`) → observer B (debounced) captura novas mensagens/rolagem manual → repete. Painel exibe lead + "Conversa monitorada".

### Recommended Project Structure

```
apps/extension/
├── wxt.config.ts               # manifest MV3: matches web.whatsapp.com, permissions: storage
├── entrypoints/
│   ├── whatsapp.content/       # ÚNICO content script
│   │   ├── index.tsx           # defineContentScript: monta painel + inicia reader/sync
│   │   ├── panel/              # React: estados do 02-UI-SPEC.md (login, lead, avisos...)
│   │   ├── reader/             # SOMENTE LEITURA — gate de lint aplica aqui
│   │   │   ├── selectors.ts    # cadeia de seletores com fallback (única fonte)
│   │   │   ├── extract.ts      # DOM → MessageDTO (função pura, testável com fixtures)
│   │   │   ├── observers.ts    # observer de conversa + de mensagens (debounce)
│   │   │   └── canary.ts       # heurísticas de quebra
│   │   └── sync/
│   │       ├── supabase.ts     # createClient com adapter chrome.storage.local
│   │       ├── queue.ts        # fila local + flush em lote
│   │       └── flags.ts        # kill-switch poll + heartbeat reader_status
│   └── background.ts           # mínimo (WXT exige; sem lógica de negócio na v1)
├── tests/
│   ├── fixtures/               # HTML real capturado no spike (sanitizado)
│   └── extract.test.ts         # parser contra fixtures
└── package.json
supabase/migrations/            # nova migration: dedup + app_settings + reader_status
packages/shared/                # MessageDTO, enums de status, schema Zod do sync
```

### Pattern 1: Painel em Shadow DOM com WXT (`createShadowRootUi`)

**What:** Content script com `cssInjectionMode: 'ui'` — o CSS importado (Tailwind) é injetado dentro do shadow root, não na página. React monta no container via `onMount`. [CITED: wxt.dev/guide/essentials/content-scripts]
**When to use:** Único padrão de UI desta fase (chrome.sidePanel vetado pelo CLAUDE.md).

```typescript
// Source: wxt.dev/guide/essentials/content-scripts (adaptado)
import './style.css'; // Tailwind — escopado no shadow root
import ReactDOM from 'react-dom/client';

export default defineContentScript({
  matches: ['*://web.whatsapp.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'copiloto-panel',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<App />);
        return root;
      },
      onRemove(root) { root?.unmount(); },
    });
    ui.mount();
  },
});
```

**Gotchas críticos:**
- WXT aplica `all: initial` no host, mas **não reseta o `font-size` do `<html>`** — unidades `rem` do Tailwind escalam com a página. Declarar `font-size: 16px` no `:host` (o UI-SPEC já exige reset no `:host`). [CITED: wxt.dev]
- O WhatsApp Web pode demorar a renderizar (tela de QR/loading); montar o painel quando o app root existir (aguardar âncora) e tratar a tela de QR como estado "WhatsApp não conectado".
- Reserva de largura (painel comprime o WhatsApp, UI-SPEC): aplicar `margin-right: 360px` (ou 40px recolhido) no elemento raiz do app do WhatsApp via style — esta é a **única mutação permitida** na página, documentada no Pattern 8.

### Pattern 2: Supabase Auth em MV3 com adapter `chrome.storage.local`

**What:** `createClient` com `auth.storage` custom assíncrono. `chrome.storage.local` sobrevive a reinícios do Chrome e não é limpo com cookies/localStorage do site — cobre AUTH-02/D-10 por construção. [VERIFIED: padrão corroborado por quickstart Plasmo/Supabase e material de comunidade 2025/2026]
**When to use:** Único cliente Supabase da extensão, criado no content script (contexto longevo — a aba do WhatsApp fica aberta o expediente inteiro).

```typescript
// Source: padrão documentado (Plasmo/Supabase quickstart + community, adaptado p/ WXT)
import { createClient } from '@supabase/supabase-js';

const chromeStorageAdapter = {
  getItem: async (key: string) =>
    (await chrome.storage.local.get(key))[key] ?? null,
  setItem: async (key: string, value: string) =>
    chrome.storage.local.set({ [key]: value }),
  removeItem: async (key: string) => chrome.storage.local.remove(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,   // ok no content script (contexto vivo)
    detectSessionInUrl: false // extensão não recebe redirects OAuth
  },
});
```

**Gotchas:**
- Issue supabase-js#2030: `createClient` pode lançar erro na inicialização com storage recém-limpo — envolver em try/catch e tratar como "sem sessão". [CITED: github.com/supabase/supabase-js/issues/2030]
- Advogado removido (D-11): o ban da Fase 1 bloqueia o refresh e o RLS por lookup nega leituras/escritas imediatamente. A extensão detecta: (a) erro de refresh do token, ou (b) fetch periódico do próprio profile retornando `status='removed'`/vazio → troca o painel para o aviso D-11 e para o reader. Fazer o check do profile no startup e no ciclo de heartbeat.
- "Esqueci minha senha" abre o fluxo web da Fase 1 em nova aba (`chrome.tabs.create` via painel) — não reimplementar reset na extensão (UI-SPEC já contratou isso).

### Pattern 3: Dois observers estreitos com debounce (EXT-02 + EXT-07)

**What:** WhatsApp Web é uma SPA que **não muda a URL por conversa** — `wxt:locationchange` não serve para detectar troca de chat. Usar dois MutationObservers com alvos estreitos:
1. **Observer de conversa** — observa o container pai onde o `#main` (painel da conversa) é montado/trocado (`childList`, sem `subtree` profundo). Dispara: resolver conversa ativa (ou "nenhuma conversa"/grupo).
2. **Observer de mensagens** — recriado a cada troca de conversa, observando **apenas a lista de mensagens** dentro do `#main` (`childList: true, subtree: true`). Callback com debounce de ~500ms acumula e dispara a extração em lote.

**Why:** observar `document.body` com subtree numa SPA pesada é o anti-padrão nº 1 de performance [CITED: material de performance MutationObserver — observar o alvo mais estreito; debounce após rajadas; alinhar leituras de layout com rAF/idle]. O WhatsApp re-renderiza muito (digitação, presença, animações) — o debounce transforma flood de mutações em um passo de extração.

```typescript
// Padrão: debounce + requestIdleCallback para extração fora do caminho crítico
function onMessagesMutated() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    requestIdleCallback(() => {
      const dtos = extractVisibleMessages(mainEl); // leitura pura
      queue.enqueue(dtos);                          // dedupe local + lote
    }, { timeout: 2000 });
  }, 500);
}
```

**Regras EXT-07:** nenhum `setInterval` de polling do DOM; extração nunca no handler síncrono da mutação; batch de rede (flush a cada ~3-5s ou N mensagens); desconectar observers quando não há conversa aberta ou leitura pausada (kill-switch/quebra/logout — mas NÃO quando o painel é recolhido, D-04).

### Pattern 4: Extração ancorada em atributos semânticos (EXT-03)

**What:** Toda a extração parte de atributos que o WhatsApp mantém estáveis há anos (são funcionais para o próprio app), nunca de classes ofuscadas:

| Dado | Âncora | Formato | Confiança |
|------|--------|---------|-----------|
| Identidade da mensagem | `[data-id]` na linha da mensagem | `{true\|false}_{chatId}_{hash}` — ex.: `false_5511999999999@c.us_3EB0...` | MEDIUM [ASSUMED — validar no spike] |
| Direção (quem enviou) | prefixo do `data-id` (`true_` = advogado) + classes `message-out`/`message-in` como fallback | boolean `from_me` | MEDIUM [ASSUMED] |
| Chat/lead + tipo | `chatId` dentro do `data-id` | `@c.us`/`@lid` = individual; `@g.us` = grupo (D-02: ignorar) | MEDIUM [ASSUMED] |
| Remetente + horário | `div[data-pre-plain-text]` | `"[HH:MM, DD/MM/AAAA] Nome: "` — parsear com regex tolerante a locale | MEDIUM [ASSUMED] |
| Texto | `span.selectable-text` dentro do `copyable-text` | texto puro (emojis viram `img[alt]` — concatenar alt) | MEDIUM [ASSUMED] |
| Nome do contato (painel) | header do `#main` (elemento de título/`span[title]`) | string exibida | LOW [ASSUMED — header muda com frequência] |
| Mídias | ausência de `selectable-text` + heurística de elementos (botão de play/duração = `[áudio]`; `img` de mídia = `[imagem]`; ícone/nome de arquivo = `[documento]`) | marcador pt-BR | LOW [ASSUMED — heurísticas a construir no spike] |

**Regras da cadeia de fallback** (padrão de seletores resilientes [CITED: material de self-healing selectors/selector drift]):
- `selectors.ts` é a **única fonte** de seletores — nenhum seletor inline em outros módulos.
- Cada alvo tem uma cadeia ordenada por estabilidade: atributo semântico (`data-*`) → role/aria → âncora estrutural relativa a outro atributo. **Proibido:** classes geradas, `nth-child`, XPath posicional.
- Quando um fallback secundário resolve, logar/reportar (sinal de drift antes da quebra total — alimenta o `reader_status`).
- Mensagens que não parseiam viram marcador `[não suportado]` em vez de serem descartadas silenciosamente (transparência da transcrição).

**Nota LID:** o WhatsApp está migrando ids de contato de `@c.us` para `@lid` em alguns fluxos (2025+) [CITED: issues wwebjs#3604 / waha#1907]. Tratar `wa_chat_id` como **string opaca** (nunca derivar telefone dela para lógica); o telefone exibível vem do header/UI quando disponível.

### Pattern 5: Sincronização idempotente por unique constraint (EXT-04)

**What:** A idempotência é garantida **no banco**, não no cliente. Nova migration:

```sql
-- messages: chave natural do WhatsApp
alter table public.messages
  add column wa_message_id text,
  add column from_me boolean not null default false,
  add column kind text not null default 'text'
    check (kind in ('text','audio','image','document','other'));
create unique index messages_conversation_wa_id_key
  on public.messages (conversation_id, wa_message_id)
  where wa_message_id is not null;

-- conversations: identidade estável do lead por advogado (discretion do CONTEXT)
create unique index conversations_profile_wa_chat_key
  on public.conversations (profile_id, wa_chat_id)
  where wa_chat_id is not null;

-- upsert de updated_at/contact_name exige policy de UPDATE (Fase 1 só criou SELECT/INSERT)
create policy "members update own conversations"
on public.conversations for update to authenticated
using (profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id()))
with check (profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id()));
```

Cliente: `supabase.from('messages').upsert(batch, { onConflict: 'conversation_id,wa_message_id', ignoreDuplicates: true })` — `ON CONFLICT DO NOTHING` significa que reprocessar a mesma tela N vezes não duplica nem exige update policy em `messages`. Dedupe local (Set de `wa_message_id` já enviados na sessão) é só otimização de rede.

**Fluxo da conversa:** ao trocar de chat, `upsert` em `conversations` por `(profile_id, wa_chat_id)` (recuperando o `id`), depois lotes de mensagens com esse `conversation_id`. `sent_at`: parseado do `data-pre-plain-text` (minuto de precisão); empates ordenam pela ordem do DOM capturada.

### Pattern 6: Detecção de quebra por canário (EXT-05 / D-13)

**What:** Heurísticas que distinguem "nada para ler" de "leitura quebrada":

| Sinal | Interpretação |
|-------|---------------|
| Âncora raiz do app presente + `#main` presente + 0 linhas `[data-id]` por N ciclos com conversa visivelmente aberta | **QUEBRADO** — estrutura mudou |
| `[data-id]` presente mas `data-pre-plain-text`/texto não parseiam acima de um limiar (ex.: >30% das linhas) | **DEGRADADO → QUEBRADO** — formato mudou |
| Fallback secundário da cadeia em uso | **DRIFT** — reportar, seguir operando |
| Âncora raiz ausente (tela de QR, loading, logout do WhatsApp) | **NÃO É QUEBRA** — estado "WhatsApp não conectado" |
| Exceção não tratada no reader | **QUEBRADO** (fail-safe: try/catch no topo do ciclo de extração) |

Ao entrar em QUEBRADO: parar observers/sync, exibir banner D-13 (texto travado no UI-SPEC), reportar `reader_status.status='broken'` e re-testar automaticamente (ex.: a cada 5 min re-executa o self-check; se voltar a extrair, retoma sozinho — "voltaremos automaticamente" do D-13).

### Pattern 7: Kill-switch por flag remota (D-15)

**What:** Tabela `app_settings` (key/value) no Postgres da Fase 1:

```sql
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "authenticated read settings"
  on public.app_settings for select to authenticated using (true);
create policy "super admins manage settings"
  on public.app_settings for all to authenticated
  using ((select private.is_super_admin()))
  with check ((select private.is_super_admin()));
insert into public.app_settings (key, value)
  values ('reader_enabled', 'true'::jsonb);
```

Extensão: lê `reader_enabled` no startup, antes de cada flush de lote, e num poll leve (~5 min). Flag `false` → mesmo estado visual do D-13 (painel/login vivos, leitura parada). Extensível para granularidade por org depois (valor jsonb pode virar `{global: bool, orgs: {...}}` sem migração). Tela admin da Fase 1 ganha o toggle (super-admin) e o indicador de saúde D-14 lendo `reader_status`:

```sql
create table public.reader_status (
  profile_id uuid primary key references public.profiles(user_id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('ok','drift','broken')),
  extension_version text,
  details jsonb,
  last_seen_at timestamptz not null default now()
);
-- RLS: advogado upserta a própria linha; super-admin lê tudo
```

Heartbeat: upsert no `reader_status` a cada ~5 min enquanto logado (piggyback no poll da flag — uma escrita, não tráfego novo).

### Pattern 8: Garantia arquitetural de somente-leitura (EXT-08)

**What:** Três camadas verificáveis:
1. **Isolamento de módulo:** todo acesso ao DOM do WhatsApp vive em `reader/` e usa exclusivamente APIs de leitura (`querySelector*`, `getAttribute`, `textContent`, `closest`, `MutationObserver`). O painel React só toca o próprio shadow root.
2. **Gate de lint/CI:** regra ESLint (`no-restricted-syntax`/`no-restricted-properties`) + grep no CI proibindo em `reader/` e em qualquer módulo que receba elementos da página: `dispatchEvent`, `execCommand`, `.click(`, `.focus(`, `innerHTML =`, `.value =`, `insertAdjacentHTML`, `appendChild`/`append` sobre nós da página, `chrome.debugger`, `scrollTo/scrollBy/scrollIntoView` (D-03: nunca rolar sozinha). O build falha se aparecer.
3. **Exceções documentadas (lista fechada):** (a) criação do host do painel (`createShadowRootUi` appenda um custom element ao `body`); (b) reserva de largura — um ajuste de estilo no container raiz do WhatsApp para comprimir (não sobrepor) o chat, exigido pelo UI-SPEC. Nenhuma das duas toca a árvore da conversa, o campo de texto ou dispara eventos. Registrar essa interpretação no plano para o verifier não acusar contradição com "nunca escreve no DOM".

**Manifest mínimo (reduz atrito na revisão da loja e a superfície de risco):** `matches: ['*://web.whatsapp.com/*']` no content script, `permissions: ['storage']` — sem `tabs`, sem `scripting`, sem host_permissions extras (o fetch ao Supabase de dentro do content script depende só de CORS, que o Supabase permite com `Access-Control-Allow-Origin: *`). `chrome.tabs.create` para "Esqueci minha senha" não exige permissão `tabs`.

### Anti-Patterns to Avoid

- **Observar `document.body` com `subtree: true`:** flood de mutações numa SPA pesada — viola EXT-07. Alvos estreitos + debounce.
- **Seletores por classe ofuscada ou `nth-child`:** quebram a cada deploy do WhatsApp. Só atributos semânticos/roles.
- **whatsapp-web.js / Baileys / injetar no Store interno:** vetado pelo CLAUDE.md; automação por protocolo é o padrão que a Meta bane (131 extensões derrubadas em out/2025).
- **Rolagem programática para minerar histórico:** vetado por D-03 (performance + detecção).
- **Dedup só no cliente (Set em memória):** perde estado ao recarregar a aba → duplica. A unique constraint no banco é a garantia; o Set é otimização.
- **`autoRefreshToken` confiado ao service worker MV3:** o SW morre após ~30s ocioso e o timer de refresh morre junto. Cliente no content script (ou chrome.alarms se um dia migrar).
- **Segredos no bundle:** só `SUPABASE_URL` + `anon key` (públicos por design, RLS protege). Nunca service_role/Anthropic key (CLAUDE.md).
- **Tratar tela de QR/loading como quebra:** gera falso-positivo do banner D-13 e alarme no admin — distinguir "WhatsApp não conectado" de "estrutura mudou".
- **Bloquear o painel/login quando a leitura quebra:** D-15 exige painel e login vivos com o aviso; só a leitura para.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shadow DOM UI + CSS escopado + ciclo de vida | Injeção manual de host/estilos | WXT `createShadowRootUi` + `cssInjectionMode: 'ui'` | Resolve isolamento bidirecional, invalidação de contexto e remount — código manual erra nos edge cases |
| Sessão/refresh de token na extensão | Gestão própria de JWT em chrome.storage | supabase-js + storage adapter | Refresh, retry e expiração já resolvidos; adapter são 10 linhas |
| Idempotência da sincronização | Verificação "já existe?" antes de inserir (race-prone) | Unique constraint + upsert `ignoreDuplicates` | O banco resolve corrida entre lotes/abas; cliente não consegue |
| Isolamento multi-tenant do sync | Filtros na extensão | RLS da Fase 1 (já existe) | Escrita sob a sessão do advogado herda as policies existentes |
| Build/manifest MV3 | manifest.json + bundler manuais | WXT | Gera manifest, HMR contra WhatsApp real, zip para a loja |
| Fila com retry/backoff de rede | Retry loop artesanal complexo | Fila simples em memória + flush com backoff exponencial básico | Mensagens ficam no DOM (fonte recuperável) — perda de lote não é perda de dado; re-extração recupera |
| Framework de feature flag | Sistema de flags genérico | 1 linha em `app_settings` + poll | Escopo é UMA flag global (D-15); extensibilidade via jsonb |

**Key insight:** o único código genuinamente "novo" desta fase é o módulo reader (seletores + extração + canário) — todo o resto é composição de padrões prontos (WXT, supabase-js, constraint SQL). Concentrar o esforço de engenharia e de testes no reader, que é exatamente o ponto de manutenção contínua do produto.

## Common Pitfalls

### Pitfall 1: Seletores de treinamento/comunidade desatualizados
**What goes wrong:** Os seletores documentados aqui (`data-id`, `data-pre-plain-text`, `selectable-text`, `#main`) vêm de projetos de automação e material de comunidade — o WhatsApp pode tê-los alterado.
**Why it happens:** DOM sem API oficial, deploys frequentes, ofuscação de classes.
**How to avoid:** **Spike hands-on como primeira entrega** (STATE.md já exige): carregar o skeleton WXT no WhatsApp Web real, validar cada âncora da tabela do Pattern 4, capturar fixtures HTML (sanitizadas de dados reais) e gravá-las em `tests/fixtures/`. Só depois planejar tasks de extração em detalhe.
**Warning signs:** extração vazia com conversa aberta durante o dev.

### Pitfall 2: Falso-positivo de quebra na tela de QR/carregamento
**What goes wrong:** WhatsApp desconectado (QR, "abra o WhatsApp no celular", loading) não tem `#main` — canário ingênuo declara quebra e mostra o banner D-13 indevidamente.
**How to avoid:** máquina de estados explícita: `wa_desconectado` → `sem_conversa` → `conversa_ativa` → `grupo` → `quebrado` → `kill_switch`. O banner D-13 só em `quebrado`/`kill_switch`.
**Warning signs:** banner de quebra ao abrir o Chrome de manhã antes do WhatsApp sincronizar.

### Pitfall 3: Sessão "morre" silenciosamente e a leitura continua
**What goes wrong:** Token expira sem refresh (bug/env), upserts falham 401 silenciosamente — advogado vê "monitorada" mas nada chega ao servidor (gap de auditoria invisível).
**How to avoid:** tratar falha de auth do sync como estado de primeira classe: painel volta ao login (ou aviso D-11 se removido); status dot muda para "Monitoramento pausado" (UI-SPEC). Nunca engolir erro de flush.
**Warning signs:** `reader_status.last_seen_at` avançando sem novas `messages` no admin.

### Pitfall 4: `rem` do Tailwind escala com o font-size da página
**What goes wrong:** WXT não reseta o `font-size` do `<html>` da página — se o WhatsApp/usuário usa font-size diferente de 16px, todo o painel (que usa `rem`) escala errado. [CITED: wxt.dev]
**How to avoid:** `:host { font-size: 16px; }` no CSS do shadow root (o reset do `:host` já é contrato do UI-SPEC).
**Warning signs:** painel visivelmente maior/menor que o mock em máquinas com zoom/acessibilidade.

### Pitfall 5: Extração síncrona dentro do callback do observer
**What goes wrong:** Ler `textContent`/atributos de centenas de nós no handler síncrono de mutação compete com o render do WhatsApp — digitação engasga (viola EXT-07).
**How to avoid:** debounce (~500ms) + `requestIdleCallback` para o passo de extração; medir com Performance panel durante o spike (critério: sem long tasks >50ms atribuíveis à extensão durante digitação).
**Warning signs:** input de mensagem do WhatsApp com latência perceptível com a extensão ativa.

### Pitfall 6: Duplicação por edição/reenvio e mensagens temporárias
**What goes wrong:** WhatsApp re-renderiza linhas (confirmações de entrega, edição de mensagem) — cada re-render dispara mutação e re-extração da mesma mensagem.
**How to avoid:** dedup por `wa_message_id` (o `data-id` não muda em re-render) + `ignoreDuplicates` no banco. Mensagens editadas ficam com o conteúdo da primeira captura na v1 (aceitável; documentar como limitação conhecida).
**Warning signs:** contagem de `messages` no banco maior que a da conversa real.

### Pitfall 7: Revisão da Chrome Web Store mais lenta por host_permissions
**What goes wrong:** Extensões com permissões sensíveis/host amplo sofrem revisão mais profunda (3-7 dias úteis) — atrasa o hotfix de leitura que o D-12 quer rápido.
**How to avoid:** manifest mínimo (Pattern 8): só `storage` + content script em `web.whatsapp.com`. Maioria das revisões MV3 sai em <24h; 90% em 3 dias [CITED: developer.chrome.com + relatos 2026]. Publicar o unlisted cedo (mesmo com painel incompleto) para atravessar a primeira revisão — updates subsequentes tendem a ser mais rápidos.
**Warning signs:** primeira submissão parada em "pending review" por dias na semana do beta.

### Pitfall 8: Code Verify acusando a extensão
**What goes wrong:** Usuários com a extensão oficial Code Verify (Meta/Cloudflare) podem ver aviso laranja de "outra extensão interferindo" — advogado interpreta como problema de segurança.
**How to avoid:** não é ban nem bloqueio — é cosmético e afeta qualquer extensão que toque a página. Preparar resposta de suporte; não tentar "esconder" a extensão (anti-padrão de detecção).
**Warning signs:** ticket de suporte citando aviso do Code Verify.

### Pitfall 9: `wa_chat_id` tratado como telefone
**What goes wrong:** Migração `@c.us` → `@lid` (2025+) muda o identificador de alguns contatos — lógica que assume "id = telefone" quebra a identidade do lead (conversas duplicadas para o mesmo contato).
**How to avoid:** `wa_chat_id` é string opaca; unicidade por `(profile_id, wa_chat_id)`; telefone exibível vem da UI quando disponível. Se um contato migrar de id no meio do beta, viram duas conversas — limitação aceita na v1 (raro; documentar).
**Warning signs:** mesmo lead aparecendo duas vezes no futuro painel do gestor.

## Code Examples

### Extração de uma linha de mensagem (função pura, testável com fixture)
```typescript
// reader/extract.ts — seletores ilustrativos [ASSUMED até o spike]
import { SEL } from './selectors';

export interface MessageDTO {
  waMessageId: string; waChatId: string; fromMe: boolean;
  kind: 'text' | 'audio' | 'image' | 'document' | 'other';
  content: string; sender: string | null; sentAt: string | null;
}

export function extractMessageRow(row: Element): MessageDTO | null {
  const dataId = row.getAttribute('data-id');          // "false_5511...@c.us_ABC123"
  if (!dataId) return null;
  const m = dataId.match(/^(true|false)_([^_]+)_(.+)$/);
  if (!m) return null;
  const [, fromMeRaw, waChatId] = m;

  const meta = row.querySelector(SEL.prePlainText)?.getAttribute('data-pre-plain-text');
  // "[14:32, 11/07/2026] Nome do Contato: "
  const metaMatch = meta?.match(/^\[(\d{1,2}:\d{2}),?\s+([\d/.-]+)\]\s*(.*?):\s*$/);

  const textEl = row.querySelector(SEL.messageText);
  const kind = textEl ? 'text' : detectMediaKind(row);  // heurística de mídia
  const content = textEl ? readTextWithEmojis(textEl) : mediaMarker(kind); // "[áudio]" etc.

  return {
    waMessageId: dataId, waChatId, fromMe: fromMeRaw === 'true', kind, content,
    sender: metaMatch?.[3] ?? null,
    sentAt: metaMatch ? parsePtBrTimestamp(metaMatch[2], metaMatch[1]) : null,
  };
}
```

### Flush de lote idempotente
```typescript
// sync/queue.ts
async function flush(batch: MessageDTO[], conversationId: string, orgId: string) {
  const rows = batch.map((d) => ({
    conversation_id: conversationId, organization_id: orgId,
    wa_message_id: d.waMessageId, from_me: d.fromMe, kind: d.kind,
    sender: d.sender ?? (d.fromMe ? 'advogado' : 'lead'),
    content: d.content, sent_at: d.sentAt,
  }));
  const { error } = await supabase.from('messages')
    .upsert(rows, { onConflict: 'conversation_id,wa_message_id', ignoreDuplicates: true });
  if (error) reportSyncFailure(error); // nunca engolir (Pitfall 3)
}
```

### Kill-switch + heartbeat (um ciclo, ~5 min)
```typescript
// sync/flags.ts
async function healthCycle() {
  const { data } = await supabase.from('app_settings')
    .select('value').eq('key', 'reader_enabled').single();
  const enabled = data?.value === true;
  setReaderEnabled(enabled); // false → estado kill_switch (banner D-13, observers off)

  await supabase.from('reader_status').upsert({
    profile_id: session.user.id, organization_id: orgId,
    status: currentCanaryStatus(), // 'ok' | 'drift' | 'broken'
    extension_version: browser.runtime.getManifest().version,
    last_seen_at: new Date().toISOString(),
  });
}
```

### Teste do parser contra fixture real (rede de proteção contra drift)
```typescript
// tests/extract.test.ts — fixtures capturadas no spike
import { readFileSync } from 'node:fs';
import { extractMessageRow } from '../entrypoints/whatsapp.content/reader/extract';

test('extrai texto, remetente e horário de mensagem recebida', () => {
  document.body.innerHTML = readFileSync('tests/fixtures/msg-in-text.html', 'utf8');
  const dto = extractMessageRow(document.querySelector('[data-id]')!);
  expect(dto).toMatchObject({ fromMe: false, kind: 'text' });
  expect(dto!.waMessageId).toMatch(/@c\.us|@lid/);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plasmo para extensões | WXT (Vite-based) | 2024-2025 | Já travado em CLAUDE.md |
| Ids de contato sempre `@c.us` (telefone) | Migração parcial para `@lid` (id anônimo) | 2025 | `wa_chat_id` opaco; nunca derivar telefone do id |
| Automação WhatsApp via libs de protocolo | Enforcement ativo da Meta (131 extensões derrubadas out/2025) | out/2025 | Reforça DOM read-only como única postura viável |
| localStorage para sessão em extensão | `chrome.storage.local` + adapter (MV3) | MV3 (2023+) | Padrão obrigatório; localStorage inexistente no SW |
| Timers persistentes no background page | Service worker efêmero (~30s) + chrome.alarms | MV3 | Motivo para o cliente Supabase viver no content script |
| CSS injetado na página pelo content script | Shadow DOM + `cssInjectionMode: 'ui'` (WXT) | WXT 0.19+ | Isolamento bidirecional de estilos sem esforço manual |

**Deprecated/outdated:**
- Manifest V2: novas submissões só MV3; remotely hosted code proibido.
- Plasmo: manutenção estagnada (CLAUDE.md What NOT to Use).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data-id` no formato `{fromMe}_{chatId}_{hash}` presente em toda linha de mensagem do DOM atual | Pattern 4/5 | **Alto** — é a chave de dedup e a detecção de grupo. Spike valida na task 1; se mudou, o fallback é o id serializado em outro atributo ou hash composto (pior). |
| A2 | `data-pre-plain-text` com `"[HH:MM, DD/MM/AAAA] Nome: "` disponível nas mensagens com texto | Pattern 4 | Médio — sem ele, horário/remetente vêm de elementos visuais (mais frágil). Spike valida. |
| A3 | `#main` (ou âncora equivalente) delimita a conversa ativa e é trocado a cada mudança de chat | Pattern 3 | Médio — muda a estratégia do observer de conversa; spike identifica a âncora real. |
| A4 | Heurísticas de mídia (play/duração = áudio etc.) são construíveis de forma estável | Pattern 4 | Médio — EXT-03 exige marcadores; se instável, v1 degrada para `[mídia]` genérico (decisão de produto menor). |
| A5 | Fetch do content script para `*.supabase.co` funciona (CORS `ACAO:*`; CSP da página não bloqueia fetch do isolated world) | Pattern 2/8 | Médio — fallback pronto: mover rede para o background SW com `host_permissions` + chrome.alarms para refresh. Validar no spike. |
| A6 | Extensões read-only não são alvo do enforcement da Meta (padrão banido = automação de envio/spam) | Summary / Pitfalls | Risco de negócio já assumido no PROJECT.md; evidência pública corrobora, mas ToS do WhatsApp proíbe formalmente clientes não oficiais — mitigação é a arquitetura read-only + volume humano. |
| A7 | Review da CWS para manifest mínimo sai em ~1-3 dias; updates subsequentes mais rápidos | Pitfall 7 | Baixo — afeta cronograma do beta, não a arquitetura. Submeter cedo mitiga. |
| A8 | Nome do contato no header do `#main` é extraível de forma razoavelmente estável | Pattern 4 | Baixo — painel mostra o lead sem nome bonito (fallback: número/id); não bloqueia sync. |
| A9 | Uma unique constraint parcial (`where wa_message_id is not null`) convive com as linhas antigas de `messages` (não há nenhuma em produção ainda) | Pattern 5 | Baixo — banco está vazio de mensagens; migration segura. |

## Open Questions (RESOLVED)

Todas as questões abertas foram absorvidas pelos planos da fase — nenhuma pendência de pesquisa bloqueia a execução.

1. **Seletores reais do WhatsApp Web em produção (A1-A4, A8) — (RESOLVED)**
   - What we know: âncoras semânticas historicamente estáveis, documentadas por anos de projetos de automação.
   - What's unclear: estado exato em julho/2026 (classes ofuscadas mudam; atributos podem ter mudado).
   - Recommendation: **spike obrigatório como primeira task da fase** (checkpoint humano: dono/dev abre o WhatsApp Web com o skeleton carregado) — valida âncoras, captura fixtures, decide as heurísticas de mídia. O plano não deve detalhar seletores finais antes disso.
   - **Resolução:** coberta pelo checkpoint humano bloqueante do plano **02-01 Task 3** (spike hands-on com `__copilotoSpike()`); o resultado vira **02-SPIKE.md**, fonte de verdade dos seletores consumida pelos planos **02-04** (parser/canário) e **02-06** (observers). Nenhum seletor de produção é escrito antes desse gate.
2. **CSP/CORS do fetch no content script (A5) — (RESOLVED)**
   - What we know: Supabase responde `ACAO: *`; content scripts em isolated world fazem fetch sob as regras CORS da página.
   - What's unclear: se alguma política do WhatsApp interfere na prática.
   - Recommendation: testar no mesmo spike (um `select` autenticado de dentro do content script); fallback arquitetural (SW + alarms) já mapeado.
   - **Resolução:** testada no mesmo spike via `__copilotoSpike.testSupabaseCors()` (**02-01 Task 3**, passo 6 do roteiro); o status HTTP é registrado em **02-SPIKE.md**. Se o fetch falhar, o fallback já mapeado (background SW + chrome.alarms) entra antes do plano 02-03 criar o cliente.
3. **Conta de desenvolvedor Google (D-12) — (RESOLVED)**
   - What we know: taxa única US$5; verificação de identidade pode levar dias.
   - What's unclear: se a Elite Juris já tem conta.
   - Recommendation: task `user_setup` cedo na fase (criar conta + submeter build inicial unlisted), paralela ao desenvolvimento.
   - **Resolução:** coberta pelo bloco `user_setup` (service chrome-web-store) + **Task 3 (checkpoint:human-action)** do plano **02-07** — criação de conta, ficha da loja e submissão unlisted, com pendência externa registrada em SUMMARY/STATE.md se a verificação de identidade demorar.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/dev | ✓ | v22.23.0 | — |
| pnpm | monorepo | ✓ | 10.0.0 | — |
| Google Chrome | dev/teste da extensão (`wxt dev`) | ✓ | instalado | — |
| Docker | `supabase test db` local (pgTAP da migration) | ✗ | — | Mesmo da Fase 1: pgTAP no CI (GitHub Actions tem Docker); dev contra projeto hospedado |
| Projeto Supabase sa-east-1 | auth + banco | ✓ (Fase 1) | — | — |
| Conta WhatsApp com conversas de teste | spike + dev do reader | ? (externa) | — | Sem fallback — precisa do número do dono/dev com WhatsApp Web ativo (checkpoint humano no spike) |
| Conta Google Developer (CWS) | D-12 distribuição | ? (externa) | — | Durante o dev, `chrome://extensions` load unpacked; loja só bloqueia o critério de distribuição |

**Missing dependencies with no fallback:**
- Conta WhatsApp real para o spike/testes manuais (envolvimento do dono ou número de teste da Elite Juris).

**Missing dependencies with fallback:**
- Docker (pgTAP roda no CI); conta CWS (load unpacked cobre todo o desenvolvimento; a submissão unlisted é task própria com lead time de dias).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (+ happy-dom) para o reader/sync · pgTAP via `supabase test db` para migration/RLS · Playwright para smoke do build |
| Config file | `apps/extension/vitest.config.ts` — Wave 0 (não existe) |
| Quick run command | `pnpm --filter extension vitest run` |
| Full suite command | `pnpm -r vitest run && supabase test db` (pgTAP no CI) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXT-03 | Parser extrai texto/remetente/horário/mídia das fixtures reais | unit | `vitest run tests/extract.test.ts` | ❌ Wave 0 (fixtures vêm do spike) |
| EXT-04 | Reprocessar o mesmo lote 2x não duplica (`ON CONFLICT DO NOTHING`) | pgTAP + integração + unit | `supabase test db` (05-extension-sync.test.sql) + `vitest run tests/extension-schema.test.ts` (apps/web) + teste da queue | ❌ Wave 0 |
| EXT-04 | RLS: advogado só insere mensagens em conversas próprias/da própria org | pgTAP | `supabase test db` (reusa suíte cross-tenant da Fase 1 + novas colunas) | ❌ Wave 0 |
| EXT-05 | Canário: fixture sem `[data-id]` → estado `broken`; tela de QR → `wa_desconectado` (não quebra) | unit | `vitest run tests/canary.test.ts` | ❌ Wave 0 |
| EXT-05 | Kill-switch: flag `false` → sync para; policies de `app_settings` (só super-admin escreve) | pgTAP + unit | `supabase test db` (06-app-settings.test.sql) + `vitest run tests/flags.test.ts` | ❌ Wave 0 |
| EXT-08 | Gate somente-leitura: nenhuma API de escrita/evento sintético em `reader/` | teste estático vitest + CI | `pnpm --filter extension exec vitest run tests/read-only-gate.test.ts` (gate como teste vitest — o repo não tem ESLint; mesma garantia, zero dependência nova) | ❌ Wave 0 |
| EXT-01/02 | Painel monta no WhatsApp real, reage à troca de conversa, comprime sem sobrepor | manual-only — justificativa: exige WhatsApp logado por QR (impossível em CI); coberto no spike + UAT | — |
| EXT-07 | Sem long tasks >50ms da extensão durante digitação; observers estreitos | manual-only (Performance panel no spike/UAT) — justificativa: profiling real exige página viva | — |
| AUTH-01/02 | Login no painel; sessão sobrevive a restart do Chrome; logout limpa | integration (adapter chrome.storage mockado) + manual (restart real no UAT) | `vitest run tests/auth-storage.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter extension vitest run` (rápido, sem rede/Docker)
- **Per wave merge:** `pnpm -r vitest run` + `supabase test db` quando a wave tocar SQL
- **Phase gate:** suíte completa verde no CI + checklist manual (painel no WhatsApp real, restart do Chrome, kill-switch acionado no admin) antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/extension/vitest.config.ts` + `tests/` (happy-dom)
- [ ] `tests/fixtures/*.html` — capturadas no spike (msg-in-text, msg-out-text, áudio, imagem, documento, grupo, header)
- [ ] `supabase/tests/05-extension-sync.test.sql` — EXT-04 (dedup + RLS do sync)
- [ ] `supabase/tests/06-app-settings.test.sql` — kill-switch + reader_status RLS
- [ ] `apps/extension/tests/read-only-gate.test.ts` — gate somente-leitura (EXT-08), rodando no CI via extension-ci.yml
- [ ] Framework install: `pnpm --filter extension add -D vitest happy-dom`

## Security Domain

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth e-mail/senha (mesma conta Fase 1); sem credenciais no bundle além de URL + anon key (públicas por design) |
| V3 Session Management | yes | Sessão em `chrome.storage.local` (isolada por extensão, inacessível à página); logout limpa storage; remoção → ban server-side bloqueia refresh (Fase 1 D-11) |
| V4 Access Control | yes | Toda escrita sob RLS da Fase 1 (org + profile); `app_settings` gravável só por super-admin; `reader_status` upsert só da própria linha |
| V5 Input Validation | yes | Zod no boundary DOM→DTO (conteúdo do WhatsApp é input não confiável); sanitização implícita: painel nunca renderiza HTML da página (só text) |
| V6 Cryptography | yes | TLS em trânsito; AES-256 em repouso (plataforma, Fase 1); nada hand-rolled |
| V13 API | yes | Sem endpoints novos server-side na v1 (supabase-js direto); constraints + RLS são a validação de última linha |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Conteúdo de mensagem malicioso (XSS via transcrição) | Tampering/Elevation | Extração só via `textContent`/`getAttribute` (nunca innerHTML); React escapa por default; dashboards futuros renderizam como texto |
| Página (WhatsApp/outro script) lendo a sessão da extensão | Information Disclosure | `chrome.storage.local` é inacessível ao contexto da página; nenhum token em localStorage/DOM |
| Extensão virar vetor de escrita (auto-envio acidental) | Tampering / risco de ban | Pattern 8: módulo reader read-only + gate de lint/CI; manifest sem `scripting`/`debugger` |
| Anon key abusada fora da extensão | Spoofing | Anon key é pública por design; RLS + auth obrigatória protegem; rate limits do Supabase Auth |
| Kill-switch adulterado por usuário comum | Elevation of Privilege | Policy de escrita em `app_settings` restrita a `private.is_super_admin()` (pgTAP cobre) |
| Advogado removido continuando a sincronizar | Broken Access Control | RLS por lookup nega escrita imediatamente (Fase 1); extensão detecta e mostra D-11 (defense in depth) |
| Dados sensíveis em logs/console | Information Disclosure | Nunca logar conteúdo de mensagem; `reader_status.details` só metadados (seletor que falhou, contagens) — nunca transcrição |
| Supply chain (pacote slopsquatted) | Tampering | Auditoria acima: versões pinadas, todos os pacotes canônicos, zero postinstall |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-07-11) — versões da Standard Stack verificadas ao vivo
- `.claude/CLAUDE.md` + `.planning/phases/01-*/01-RESEARCH.md` + `supabase/migrations/` — stack travada, padrões RLS e schema existente (fonte interna autoritativa)

### Secondary (MEDIUM confidence — docs oficiais e fontes corroboradas)
- [WXT content scripts / createShadowRootUi](https://wxt.dev/guide/essentials/content-scripts.html) — shadow DOM UI, cssInjectionMode, caveat do font-size, wxt:locationchange
- [supabase-js issue #2030](https://github.com/supabase/supabase-js/issues/2030) + [Plasmo Supabase quickstart](https://docs.plasmo.com/quickstarts/with-supabase) + [Supabase Auth em extensão MV3 (fev/2026)](https://chethiyakd.medium.com/supabase-auth-in-a-chrome-extension-what-you-wont-find-in-the-docs-a2ae6691cca3) — adapter chrome.storage.local, pitfalls de init
- [Publish MV3 / Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3) + [review times 2026](https://extensionbooster.com/blog/chrome-web-store-extension-review-time-2026-how-long-guide/) — unlisted, prazos, auto-update
- [Malwarebytes: 100+ extensões violando anti-spam do WhatsApp (out/2025)](https://www.malwarebytes.com/blog/news/2025/10/over-100-chrome-extensions-break-whatsapps-anti-spam-rules) + [Forbes](https://www.forbes.com/sites/zakdoffman/2025/10/21/if-you-use-whatsapp-delete-every-chrome-extension-on-this-list/) + [WhatsApp FAQ browser extension warning](https://faq.whatsapp.com/1519454798524881/) + [Code Verify "Validation Failure"](https://faq.whatsapp.com/3107025856262937/) — perfil de enforcement e detecção
- [Formato do id serializado (WAHA/wwebjs)](https://waha.devlike.pro/docs/how-to/receive-messages/) + [wwebjs issue #3604 (migração @lid)](https://github.com/pedroslopez/whatsapp-web.js/issues/3604) — `data-id`, `@c.us`/`@g.us`/`@lid`
- [MutationObserver guide](https://medium.com/vlead-tech/understanding-mutationobserver-a-comprehensive-guide-for-web-developers-a51d39e157de) + [Observer performance/throttling](https://observerviewport.com/performance-optimization-memory-management/callback-throttling-debouncing/) — alvos estreitos, debounce, rAF
- [Self-healing selectors / selector drift](https://qaskills.sh/blog/self-healing-test-automation-2026-guide) + [resilient scraper patterns](https://apiserpent.com/blog/resilient-scraper-selector-drift) — cadeias de fallback, detecção de drift

### Tertiary (LOW confidence — validar no spike)
- Seletores concretos do WhatsApp Web (`#main`, `span.selectable-text`, estrutura do header, heurísticas de mídia) — derivados de projetos de automação/scraping de datas variadas [ASSUMED]
- Comportamento do fetch de content script sob a CSP do WhatsApp (A5) [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versões verificadas ao vivo; stack travada em CLAUDE.md; padrões WXT/supabase-js documentados
- Architecture (painel, sync, kill-switch, read-only gate): MEDIUM-HIGH — composição de padrões oficiais + schema da Fase 1 já existente
- Seletores/extração do WhatsApp: MEDIUM na estratégia (atributos semânticos + fallback), LOW nos seletores específicos — **spike hands-on é pré-requisito do planejamento detalhado das tasks de extração**
- Risco de plataforma (ban/detecção): MEDIUM — evidência pública consistente, mas ToS formalmente proíbe; risco assumido no PROJECT.md

**Research date:** 2026-07-11
**Valid until:** ~2026-08-10 (30 dias para stack/arquitetura; seletores do WhatsApp valem até o próximo deploy da Meta — a arquitetura assume drift contínuo por design)
