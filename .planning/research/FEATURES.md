# Feature Research

**Domain:** AI sales copilot as Chrome extension over WhatsApp Web — legal lead conversion SaaS (Brazilian market, pt-BR)
**Researched:** 2026-07-04
**Confidence:** MEDIUM (cross-checked web sources + competitor primary pages; no hands-on product trials)

## Domain Landscape Summary

Three product categories converge on this project:

1. **WhatsApp Web CRM extensions** (WaSpeed, WaLeads, WAPlus, Lion CRM, Eazybe, noCRM): a side panel injected into WhatsApp Web via DOM, with CRM kanban, quick replies, scheduling, bulk messaging, chatbots. Feature-dense, cheap (R$79–397/yr-mo range), commoditized. **None do conversation coaching or quality scoring.**
2. **AI conversation intelligence / sales copilots** (Gong, Cresta, Attention, Avoma, Balto): capture conversations, produce AI scorecards graded against a sales methodology, summaries, coaching dashboards with rep comparisons. Built for calls/meetings in enterprise English-speaking markets — **none live inside WhatsApp Web**.
3. **Brazilian legal-tech WhatsApp tools** (JusLead, SabioAdv, ChatJurídico, LexAI, Projuris ADV): overwhelmingly **bot-first** — 24/7 AI chatbots on the official Meta API doing triage/qualification/scheduling. **None found doing human-in-the-loop copilot + post-conversation diagnostics.**

The project sits in the empty intersection: Gong-style scoring + coaching, delivered where Brazilian lawyers actually sell (WhatsApp Web), with a human always typing. That intersection is the differentiator; the extension mechanics and SaaS mechanics are table stakes borrowed from categories 1 and standard SaaS practice.

## Feature Landscape

### Table Stakes (Users Expect These)

#### A. Extension side panel UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Side panel injected into WhatsApp Web, toggleable | Category standard (WaSpeed/WaLeads/WAPlus all do this); users expect the tool "inside" WhatsApp, not a separate tab | MEDIUM | Content script + injected UI; must not obstruct chat area; collapse/expand control |
| Active-conversation awareness | Panel must react to which chat is open — all competitors show per-contact context | HIGH | DOM observation of WhatsApp Web; the single most fragile dependency (breaks on WhatsApp UI updates); needs resilient selectors + failure detection |
| Reliable DOM transcript reading (text messages, sender, timestamp) | Everything downstream (suggestions, diagnostics, dashboard) depends on it | HIGH | Handle scrollback loading, media placeholders ("[áudio]", "[imagem]"), edited/deleted messages; graceful degradation when WhatsApp changes markup |
| Login (e-mail/senha) with persistent session in extension | Competitors gate by account; subscription enforcement requires it | MEDIUM | Token storage in extension storage; session survives browser restarts; logout |
| Graceful "WhatsApp Web changed / extension broken" state | Users of these extensions live through breakages; silent failure destroys trust | LOW | Health-check of selectors on load; friendly pt-BR error + "aguarde atualização" messaging; remote kill-switch/version flag is cheap insurance |
| Onboarding inside the panel (first-run walkthrough) | Chrome extension users churn instantly if the panel is inscrutable | LOW | 3–4 step tour: abrir conversa → sugerir resposta → marcar desfecho |
| pt-BR interface throughout | 100% Brazilian audience; competitors are all pt-BR | LOW | All copy, dates, number formats |
| Doesn't degrade WhatsApp Web performance | DOM-heavy extensions get uninstalled for lag | MEDIUM | Throttled observers; no polling loops |

#### B. AI suggestion & diagnostic features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| On-demand "Sugerir resposta" button with visible loading state | The core promise; AI copilots universally offer a one-click assist | MEDIUM | Reads current transcript, calls LLM with methodology prompt; streaming output improves perceived speed |
| Copy-to-clipboard (one click) for the suggestion | If the lawyer can't use the suggestion in <2 seconds it won't be used; note: NOT auto-insert into WhatsApp input (that drifts toward auto-send risk) | LOW | Clipboard API; consider "copiado!" feedback |
| Suggestion grounded in conversation stage | AI copilots differentiate advice by phase (opening/qualification/objection/closing); generic replies kill credibility | MEDIUM | Prompt engineering over the fixed methodology; stage detection is part of the LLM call, not separate ML |
| Conversation summary in the diagnostic | Every conversation-intelligence tool (Gong, Attention, Avoma) pairs score with summary | LOW | Same LLM call as diagnostic |
| 0–10 score + structured feedback (acertos / erros / melhorias) | Post-call AI scorecards are the category standard in conversation intelligence | MEDIUM | Rubric derived from agency methodology; structure the output (JSON) so dashboard can aggregate |
| Automatic diagnostic trigger on conversation inactivity | Decided in PROJECT.md; removes "remember to finish" friction | HIGH | Requires server-side timer or extension-side detection + sync; define inactivity window; handle conversation reactivation after diagnostic |
| Manual "gerar diagnóstico agora" fallback | Inactivity heuristics will misfire; lawyer needs an escape hatch | LOW | Same pipeline, manual trigger; also covers testing/calibration |
| Outcome marking: contrato fechado / perdido | Required for conversion tracking; single-tap in panel | LOW | Consider "ainda em andamento" implicit default; allow changing outcome later (deals close days after chat) |
| Suggestion/diagnostic latency users tolerate (<10s suggestion) | AI copilot users abandon slow assists | MEDIUM | Model choice + prompt size management (long transcripts need truncation/summarization strategy) |

#### C. Manager analytics dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-lawyer scorecards: average score, evolution over time, comparison | Gong/Attention-style manager dashboards make rep leaderboards + trend lines standard | MEDIUM | Aggregations over diagnostics table |
| Conversation list with score, outcome, date, filters | Managers drill from aggregate → individual conversations | LOW | Filter by lawyer, period, outcome, score range |
| Full transcript view per conversation | Core to the audit use case (replaces manager logging into each lawyer's WhatsApp) | MEDIUM | Depends on transcript storage; render chat-style |
| Diagnostic detail view (score + acertos/erros/melhorias) alongside transcript | Managers coach from the diagnostic, verify against the transcript | LOW | Drill-down pattern standard in Gong-class tools |
| Conversion rate: lead→contrato, per lawyer and per team | The success metric of the whole product; legal intake benchmarks (avg 14%, top firms 40–50%) make this the number managers care about | MEDIUM | Needs outcome marking discipline; show % marked vs unmarked to expose data gaps |
| Web app login with role separation (gestor vs advogado) | Manager sees all lawyers; lawyer must not see peers' data (or sees only own) | MEDIUM | Org → users model; decide early if lawyers get web access at all in v1 |
| Team member management (invite/remove lawyers) | Manager must onboard their lawyers without vendor support | MEDIUM | Invitation by e-mail; tied to seat billing |

#### D. SaaS account & billing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stripe subscription checkout (per-seat pricing) | PROJECT.md constraint; per-seat matches "per lawyer" value unit; Stripe handles proration on mid-cycle seat changes | MEDIUM | Stripe Checkout + webhooks; BRL pricing |
| Stripe Customer Portal (self-serve plan change, cancel, cards, invoices) | Table stakes for any Stripe SaaS; building this yourself is wasted effort | LOW | One portal-session endpoint; near-free feature |
| Webhook-driven entitlements (subscription active → extension + dashboard access) | Access must die when payment dies; standard pattern | MEDIUM | Grace period on failed payment (dunning) rather than instant lockout |
| Free trial (with reminder before expiry) | WaLeads offers 3-day no-card trial; category norm; card-on-file trials convert 2–3x better but raise friction — beta cohort may bypass trials entirely | LOW | For closed beta, manual comping via Stripe coupons is fine |
| Password reset / basic account recovery | Absolute baseline; lockouts generate support load | LOW | E-mail reset flow |
| LGPD essentials: terms of use + privacy policy acceptance, data deletion on request, encryption at rest, retention policy | Legal conversations contain sensitive case data; PROJECT.md requirement; Brazilian legal-tech competitors all market LGPD compliance | MEDIUM–HIGH | Not optional for lawyer customers — they will ask; deletion must cascade extension + dashboard + AI logs |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Suggestions that follow the agency's documented legal-sales methodology (not generic ChatGPT) | WaSpeed's "ChatGPT integration" is generic; ours encodes a proven closing methodology for legal leads — this IS the product | HIGH | The prompt/rubric "brain"; requires iterative calibration with the owner-expert against real conversations; treat as its own workstream with eval harness |
| Automatic end-of-conversation diagnostic (score every conversation, not sampled) | Gong-class "generative scorecards" applied to WhatsApp; no Brazilian WhatsApp tool does this; managers currently audit manually by logging into lawyers' phones | HIGH | Inactivity trigger + rubric scoring; the auto-trigger (vs manual) is itself the differentiator — zero lawyer effort |
| Score↔transcript↔feedback drill-down for managers | Turns the dashboard from vanity metrics into a coaching tool; matches what enterprise conversation intelligence charges $1k+/seat/yr for | MEDIUM | Requires structured diagnostic output linked to stored transcript |
| Outcome tracking wired to conversion rate (lead→contrato) | Closes the loop competitors can't: did coached behavior actually convert? Legal intake tools track this for forms, nobody tracks it inside WhatsApp | LOW–MEDIUM | Cheap to build, high strategic value; also the product's own success metric |
| Read-only, human-sends-everything posture | Marketed as a feature: drastically lower WhatsApp ban risk than bot competitors AND OAB-safer (bots doing active outreach flirt with captação vedada under Provimento 205/2021) | LOW | Positioning + architectural guarantee; state it explicitly in marketing and terms |
| Diagnostics calibrated by a legal-sales specialist (the owner) | "IA treinada por quem fecha contratos jurídicos" beats generic AI claims in this niche | MEDIUM | Calibration loop: owner grades sample conversations, scores converge; keep a golden-set of graded conversations for regression testing |
| Manager audits without accessing lawyers' WhatsApp accounts | Direct pain relief for the agency persona (today: manual login to each client's WhatsApp) | — | Emergent property of transcripts + dashboard; highlight in sales copy |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Chatbot / auto-send messages | Every Brazilian competitor has it; users will ask | WhatsApp ban risk (unofficial automation), removes human judgment, OAB captação exposure, destroys the "copiloto" positioning | Read-only + copy-to-clipboard suggestion; human always sends |
| CRM kanban, tags, scheduling, bulk messaging | Category standard in WhatsApp extensions; "why don't you have what WaSpeed has?" | Commoditized, expensive to maintain, dilutes the AI differentiator; users can run WaLeads alongside if they want CRM | Explicit positioning: "use junto com seu CRM"; verify panel coexists with competitor extensions |
| Real-time suggestion on every incoming message | Feels magical; enterprise tools (Cresta/Balto) do it for calls | LLM cost per message explodes; distracts lawyer; latency pressure; PROJECT.md already deferred | On-demand button; revisit after unit economics known |
| Per-office configurable playbooks/rubrics | Offices will say "our practice area is different" | Multiplies calibration burden before the fixed methodology is even validated; v1 needs one rubric that provably works | Fixed agency methodology in v1; collect per-office requests as v2 signal |
| Auto-insert suggestion into WhatsApp input box | One less click than copy | Technically = writing into WhatsApp DOM = one step from auto-send; raises ban-detection surface | Copy-to-clipboard with visual confirmation |
| Multi-agent shared WhatsApp account | WaLeads Premium sells this | Requires message-sending infrastructure and session multiplexing — massive scope, ban risk | One lawyer = one WhatsApp = one seat |
| Editing/overriding AI scores by lawyers | Lawyers will dispute low scores | Corrupts manager analytics and calibration data | Feedback button ("discordo da nota" + comment) that feeds calibration, doesn't change score |
| Storing/processing audio messages via transcription in v1 | Legal leads send voice notes constantly; will be requested fast | Whisper pipeline + storage cost + LGPD surface; media not readable from DOM reliably | v1: mark "[áudio]" in transcript, diagnostic notes coverage gap; strong v1.x candidate |

## Feature Dependencies

```
[Login/Auth (extension + web)]
    └──requires──> [Backend user/org model]
                       └──requires──> [Stripe subscription + webhooks] (entitlement gating)

[DOM transcript reading]
    └──required by──> [Sugerir resposta (on-demand AI)]
    └──required by──> [Transcript storage (server)]
                          └──required by──> [Auto diagnostic (score + feedback)]
                          └──required by──> [Manager transcript view]

[Auto diagnostic] ──required by──> [Per-lawyer scorecards / dashboard aggregates]
[Outcome marking] ──required by──> [Conversion rate analytics]
[Methodology "brain" (prompts + rubric)] ──required by──> [Sugerir resposta] AND [Auto diagnostic]
[Calibration loop (owner grading)] ──enhances──> [Methodology brain]

[LGPD safeguards] ──gates──> [Transcript storage] (must ship together, not after)
[Chatbot/auto-send] ──conflicts──> [Read-only ban-risk posture]
[Per-office playbooks] ──conflicts──> [Fixed-methodology calibration in v1]
```

### Dependency Notes

- **Methodology brain before both AI features:** suggestions and diagnostics share the same rubric source; building it once as a shared, versioned artifact (prompt + criteria) avoids divergence between "what the AI advises" and "what the AI grades."
- **Transcript storage gates the dashboard:** the manager dashboard is read-only over stored transcripts + diagnostics; nothing manager-facing can ship before capture/storage works.
- **LGPD ships with storage, not after:** the moment real client conversations persist server-side, encryption/retention/terms must already exist — lawyer customers are unusually likely to check.
- **Outcome marking is cheap but time-sensitive:** conversion data only accumulates from the day it ships; get it into v1 even in minimal form.
- **Stripe can lag slightly in closed beta:** entitlement architecture must exist, but actual paid checkout can be exercised via comped subscriptions for beta clients.

## MVP Definition

### Launch With (v1 — closed beta with agency clients)

- [ ] Chrome extension side panel over WhatsApp Web with login — the delivery vehicle
- [ ] Resilient DOM reading of active conversation (text; media as placeholders) — everything depends on it
- [ ] "Sugerir resposta" on-demand with methodology-grounded output + copy button — core promise #1
- [ ] Auto diagnostic on inactivity (0–10 + acertos/erros/melhorias) with manual trigger fallback — core promise #2
- [ ] Outcome marking (fechado/perdido, editable later) — feeds the success metric
- [ ] Transcript + diagnostic storage with LGPD baseline (encryption at rest, retention policy, terms, deletion) — legally mandatory
- [ ] Manager web dashboard: per-lawyer scores/evolution/comparison, conversation list, transcript + diagnostic drill-down, conversion rate
- [ ] Stripe per-seat subscription + Customer Portal + webhook entitlements (comped for beta)
- [ ] Calibration workflow (even if internal/manual): owner grades sample conversations against AI scores — without convergence, Core Value fails

### Add After Validation (v1.x)

- [ ] Audio message transcription (Whisper) — trigger: lawyers report diagnostics missing context from voice notes (near-certain in Brazil)
- [ ] Lawyer self-view of own scores/evolution in extension or web — trigger: lawyers ask "como estou indo?"
- [ ] Score-dispute feedback button — trigger: first calibration disagreements from real users
- [ ] Suggestion quality feedback (👍/👎 per suggestion) — trigger: need signal for prompt iteration at scale
- [ ] Notification/e-mail digest for managers (weekly team summary) — trigger: managers stop logging into dashboard
- [ ] Public self-serve signup + trial flow — trigger: opening beyond agency clients

### Future Consideration (v2+)

- [ ] Per-office configurable playbooks/rubrics — defer until fixed methodology is validated and demand is proven
- [ ] Real-time per-message suggestions — defer until AI unit economics and lawyer attention patterns are understood
- [ ] Follow-up reminders on stalled leads ("lead esfriou, retome") — adjacent value, but creeps toward CRM
- [ ] Practice-area-specific scoring variants (previdenciário vs trabalhista etc.) — needs data volume first
- [ ] Edge/other-browser support, desktop app — Chrome covers the beta market

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DOM transcript reading (resilient) | HIGH | HIGH | P1 |
| Sugerir resposta (methodology-grounded) | HIGH | HIGH | P1 |
| Auto diagnostic (score + feedback) | HIGH | HIGH | P1 |
| Methodology brain + calibration loop | HIGH | HIGH | P1 |
| Manager dashboard (scores, transcripts, conversion) | HIGH | MEDIUM | P1 |
| Outcome marking | HIGH | LOW | P1 |
| Extension login + entitlements | MEDIUM | MEDIUM | P1 |
| LGPD baseline (encryption, retention, terms, deletion) | MEDIUM (but mandatory) | MEDIUM | P1 |
| Stripe checkout + portal | MEDIUM | MEDIUM | P1 (can be comped in beta) |
| Broken-DOM detection + kill switch | MEDIUM | LOW | P1 |
| Onboarding tour | MEDIUM | LOW | P2 |
| Audio transcription | HIGH | MEDIUM | P2 |
| Lawyer self-view of scores | MEDIUM | LOW | P2 |
| Suggestion/score feedback buttons | MEDIUM | LOW | P2 |
| Manager e-mail digests | MEDIUM | LOW | P2 |
| Per-office playbooks | MEDIUM | HIGH | P3 |
| Real-time suggestions | MEDIUM | HIGH | P3 |

## Competitor Feature Analysis

| Feature | WaSpeed / WaLeads | Gong / Attention / Cresta class | BR legal-tech (SabioAdv, JusLead, ChatJurídico) | Our Approach |
|---------|-------------------|-------------------------------|--------------------------------------------------|--------------|
| Lives inside WhatsApp Web | Yes (DOM side panel) | No (calls/meetings/CRM) | No (official API bots, separate platforms) | Yes — same DOM side-panel pattern as WaSpeed/WaLeads |
| AI reply help | Generic ChatGPT integration (WaSpeed) | Live guidance (Cresta) / post-call (Gong) | Bot replies autonomously | On-demand suggestion, fixed legal-sales methodology, human sends |
| Conversation scoring | None | AI scorecards vs methodology rubric, every call | None | 0–10 + acertos/erros/melhorias, auto on inactivity — Gong pattern, WhatsApp context |
| Manager analytics | Basic ops metrics (WaLeads: volume, response time) | Rep scorecards, leaderboards, trends, drill-down to moments | Bot funnel metrics | Scores per lawyer, evolution/comparison, transcript drill-down, conversion rate |
| Outcome/conversion tracking | Deal value on kanban cards | CRM-linked revenue attribution | Lead counts | Explicit fechado/perdido marking → lead→contrato rate |
| Message sending/automation | Chatbots, scheduling, bulk campaigns | N/A | 24/7 bots on official API | Deliberately none (ban risk + OAB posture) |
| CRM (kanban/tags) | Core feature | CRM integrations | Full legal CRM (JusLead/Projuris) | Deliberately none — coexist with these tools |
| Compliance framing | None visible | SOC2-style enterprise | OAB + LGPD marketed prominently | LGPD baseline mandatory; read-only posture as OAB-safety argument |
| Pricing model | R$79.90–179.90/mo or R$347–397/yr | US$1k+/seat/yr enterprise | Subscription, quotes vary | Per-seat Stripe subscription; price anchor: well above WaLeads (AI value), far below Gong |

**Pricing implication:** Brazilian WhatsApp-extension buyers anchor at R$80–180/month. The AI copilot justifies a premium over that anchor, but enterprise conversation-intelligence pricing has no precedent in this market — closed beta should test willingness-to-pay.

## Legal-Sector Specific Needs

- **OAB Provimento 205/2021 boundary:** lawyers may respond to inbound leads freely but cannot do active solicitation (captação) or promise results. The AI's suggestion prompts must never generate result promises ("garanto que você ganha a causa") or comparative/sensationalist claims — this is a **rubric requirement**, not just marketing hygiene. The read-only, inbound-response posture keeps the product on the safe side where bot competitors are grayer.
- **LGPD with sensitive data:** legal-case conversations are sensitive personal data; encryption at rest, defined retention, deletion on request, and clear consent/terms are entry requirements. Lawyer buyers audit this more than typical SMBs.
- **Voice notes are endemic** in Brazilian WhatsApp legal leads — v1 must at least represent them honestly in transcripts/diagnostics; transcription is the highest-value v1.x feature.
- **Trust in AI scores requires expert validation:** conversion methodology credibility comes from the owner-specialist; the calibration loop (owner grades vs AI grades convergence) is a product feature, not just an engineering task.

## Sources

- WaSpeed product page — https://waspeed.com.br (primary vendor source; LOW confidence per seam, single source)
- WaLeads product page — https://waleads.com.br (primary vendor source; LOW confidence per seam, single source)
- AI copilot / conversation intelligence landscape (MEDIUM, cross-checked): [Gong sales coaching](https://www.gong.io/sales-coaching-software), [Attention AI coaching scorecards](https://www.attention.com/product/ai-coaching-scorecards), [Cresta automated call scoring](https://cresta.com/guides/automated-call-scoring-agent-performance-solutions), [Outreach conversation intelligence tools](https://www.outreach.ai/resources/blog/best-conversation-intelligence-software-tools), [Revenue.io generative scorecards](https://www.revenue.io/blog/generative-scorecards-sales-performance-coaching)
- WhatsApp CRM extensions (MEDIUM, cross-checked): [WAPlus extension roundup](https://waplus.io/wa-extension), [Lion CRM extension comparison](https://lioncrm.site/best-whatsapp-crm-extensions-for-chrome/), [noCRM WhatsApp extension](https://www.nocrm.io/blog/whatsapp-crm-chrome-extension-for-sales/)
- Legal intake software (MEDIUM, cross-checked): [Lawmatics](https://www.lawmatics.com/blog/what-is-intake-software), [Clio intake forms](https://www.clio.com/features/online-intake-forms/), [Legal Intaker comparison](https://www.legalintaker.com/blog/10-best-client-intake-software-for-law-firms) — conversion benchmarks (14% avg, 40–50% top, 5-min response 21x) from these secondary sources
- Brazilian legal-tech (MEDIUM, cross-checked): [JusLead](https://juslead.com/lading/), [SabioAdv](https://sabioadv.com.br/), [ChatADV](https://chatadv.com.br/), [LexAI](https://www.lexaibrasil.com/), [Projuris ADV](https://www.projuris.com.br/adv/)
- OAB Provimento 205/2021 (MEDIUM): [OAB official text](https://www.oab.org.br/leisnormas/legislacao/provimentos/205-2021), [Jusbrasil analysis](https://www.jusbrasil.com.br/artigos/marketing-juridico-permitido-como-o-provimento-205-2021-da-ordem-dos-advogados-do-brasil-oab-regula-a-publicidade-na-dvocacia/5175073683)
- SaaS billing (MEDIUM): [Stripe SaaS integration guide](https://docs.stripe.com/saas), [Stripe Billing features](https://stripe.com/billing/features), [Stripe pricing table docs](https://docs.stripe.com/payments/checkout/pricing-table)

---
*Feature research for: AI legal-sales copilot Chrome extension over WhatsApp Web*
*Researched: 2026-07-04*
