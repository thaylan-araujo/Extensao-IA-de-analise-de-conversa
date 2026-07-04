# Pitfalls Research

**Domain:** AI copilot Chrome extension for WhatsApp Web — legal lead conversion SaaS (Brazilian market, LGPD)
**Researched:** 2026-07-04
**Confidence:** MEDIUM (web research cross-checked against official docs: Chrome for Developers, Stripe docs, OAB/LGPD guidance, Socket/Malwarebytes security reports)

## Critical Pitfalls

### Pitfall 1: WhatsApp Web DOM breakage with no resilience layer

**What goes wrong:**
The extension scrapes conversations via DOM selectors (`.message-in`, `.message-out`, `.selectable-text`, etc.). WhatsApp ships UI updates frequently, uses obfuscated/hashed class names, and A/B-tests layouts. One update and the copilot silently reads nothing — or worse, reads garbled/partial transcripts that get scored and stored as if valid. Lawyers see wrong diagnostics; trust in the product (the core value) evaporates before anyone notices the scraper broke.

**Why it happens:**
Teams treat selector code as "done" after it works once, scatter selectors across the codebase, and have no way to distinguish "conversation is empty" from "extraction failed."

**How to avoid:**
- Centralize ALL WhatsApp DOM access in a single extraction adapter module — the only file that knows selectors.
- Prefer stable anchors (`data-*` attributes, ARIA roles, structural position) over class names; layer fallback selector strategies.
- Build a runtime self-test: on load, verify the extractor can find the chat list, message container, and at least parse a known message shape. On failure, show an explicit "extension needs update" state and **block AI calls** — never score a partial transcript.
- Add breakage telemetry (extraction success rate per extension version) so you learn WhatsApp changed before customers complain.
- Validate extracted transcripts (sender attribution present, timestamps monotonic, non-empty) before sending to the LLM.

**Warning signs:**
Selectors referenced in more than one module; no "extraction failed" state in the UI; diagnostics generated from suspiciously short transcripts; zero telemetry on parse success.

**Phase to address:**
The DOM extraction / content-script phase (earliest technical phase). Telemetry can land with the backend phase, but the adapter isolation and self-test must exist from the first line of extraction code.

---

### Pitfall 2: Drifting from read-only into automation (WhatsApp ban territory)

**What goes wrong:**
Users get their WhatsApp numbers banned — for a law firm, losing the number that receives all leads is catastrophic. In October 2025, Socket exposed 131 Chrome extensions (a Brazilian franchise operation, DBX Tecnologia) hijacking WhatsApp Web for automated messaging; Google removed them all and Meta detects unofficial automation at the protocol level.

**Why it happens:**
Feature creep. "Just add a button that inserts the suggested reply into the input box," then "just auto-send it," then hooking WhatsApp's internal JS modules (wa-js style) because the DOM is annoying. Each step deepens ToS violation and detection surface. The project's own decision log already bans auto-send — the pitfall is eroding that decision under user pressure.

**How to avoid:**
- Hard architectural rule: the extension only observes (MutationObserver + DOM reads). No programmatic message sending, no dispatching input events into WhatsApp's composer, no injecting into WhatsApp's internal module store.
- "Copy suggestion to clipboard" is the safe UX ceiling for v1; treat even "insert into input field" as a deliberate, risk-assessed decision, not a quick win.
- Disclose residual risk in the terms of use (unofficial tool, WhatsApp ToS gray zone) so customers aren't blindsided.
- Keep the passive footprint small: don't patch WhatsApp globals, don't intercept its network traffic.

**Warning signs:**
Any PR touching WhatsApp's input composer or `window` internals; roadmap items like "one-click send"; users asking for bulk features and the team saying yes.

**Phase to address:**
Extension architecture phase (encode the rule in the design doc and code review checklist); revisit at every phase that touches the content script.

---

### Pitfall 3: Chrome Web Store rejection or takedown

**What goes wrong:**
The extension gets rejected at review or removed post-publication, cutting off distribution overnight. Post-October-2025 crackdown, WhatsApp-adjacent extensions face heightened scrutiny. Common triggers: "WhatsApp" in the name/logo (trademark/impersonation), remote-hosted code (fetching prompts or scoring logic as executable JS), permission creep (`<all_urls>` instead of `web.whatsapp.com`), vague privacy disclosures for an extension that exfiltrates chat content.

**Why it happens:**
Developers name the product "WhatsApp AI Copilot," request broad permissions for convenience, and want to update prompts without republishing — so they fetch remote config that reviewers classify as remote code.

**How to avoid:**
- Product name must not lead with "WhatsApp"; describe compatibility ("funciona com WhatsApp Web") instead of implying affiliation.
- Host permissions: exactly `https://web.whatsapp.com/*` plus your own API domain. Nothing else.
- Prompts live server-side: the extension sends transcript → backend calls the LLM → returns text. Remote *data* is fine; remote *code* is not. Never `eval`, never inject fetched scripts.
- Write an honest, specific privacy policy: what conversation data is read, where it goes, retention, LGPD rights. Fill in the Chrome Web Store data-use disclosures accurately.
- Single purpose: the listing is "AI sales copilot for legal client intake" — resist bundling unrelated utilities.
- Have a fallback plan (self-hosted .crx for beta via enterprise policy is painful; better: keep the closed beta on the Web Store as "unlisted").

**Warning signs:**
Manifest requesting `tabs`/`<all_urls>`; any dynamic script loading; store listing screenshots using WhatsApp branding; privacy policy written last-minute.

**Phase to address:**
Extension scaffold phase (manifest/permissions/naming) + a dedicated pre-publication compliance checklist before the beta-launch phase.

---

### Pitfall 4: LLM cost blowout from re-sending full transcripts

**What goes wrong:**
Every "Sugerir resposta" click sends the entire conversation; every inactivity diagnostic re-sends it again. Legal intake conversations run for days with hundreds of messages. Cost per conversation grows superlinearly, and at SaaS pricing (fixed monthly fee) heavy users become unprofitable — margin death by a thousand tokens.

**Why it happens:**
Full-context prompting is the easiest thing that works in a demo. Nobody meters per-tenant cost until the first shocking invoice.

**How to avoid:**
- Token-budget the prompt from day one: system prompt (methodology) + rolling summary of older messages + verbatim recent window (e.g., last 30–50 messages).
- Use prompt caching (Anthropic cache reads are ~90% cheaper; stable system prompt + methodology makes 60–80% hit rates realistic).
- Deduplicate diagnostics: a conversation gets re-scored only if new messages arrived since the last diagnostic — inactivity triggers must be idempotent.
- Meter cost per suggestion/diagnostic per tenant from the first API call; set per-account soft caps and alerting.
- The on-demand-button decision (already made) is the right cost control — protect it; "real-time suggestions" multiplies cost 10–50x.

**Warning signs:**
No token counts in logs; prompts built by string-concatenating the whole DOM extract; unit economics never computed; diagnostic job firing repeatedly for the same idle conversation.

**Phase to address:**
AI integration phase (context strategy + caching + metering built together, not retrofitted).

---

### Pitfall 5: Uncalibrated 0-10 scoring that the expert doesn't trust

**What goes wrong:**
This kills the core value directly ("if the owner doesn't agree with the suggestions and diagnostics, nothing else matters"). Raw "rate this conversation 0-10" prompts produce scores that cluster around 7-8, shift between model versions, and vary run-to-run. The gestor dashboard then ranks lawyers on noise, managers make personnel judgments from it, and the expert owner stops believing the product.

**Why it happens:**
LLMs have no innate numeric calibration; a single holistic score hides which criteria drove it; teams ship the judge without ever measuring agreement against human expert scores.

**How to avoid:**
- Decompose the agency methodology into explicit rubric criteria, each with anchored level descriptions (what a 2 vs 8 looks like on *that* criterion). Score criteria individually; compute the 0-10 aggregate in code, not in the LLM.
- Build a golden set: 20-50 real conversations scored independently by the owner. Measure judge-vs-expert agreement (correlation / within-1-point rate) before launch, and re-run this eval on every prompt or model change.
- Make the diagnostic explain itself (acertos/erros per criterion) so disagreements are debuggable at the criterion level.
- Fix temperature low for scoring; version prompts; log model + prompt version with every diagnostic so historical scores are interpretable.
- Treat calibration as a standing workflow (owner reviews N diagnostics/week and marks agree/disagree), not a one-time setup.

**Warning signs:**
All conversations scoring 6-8; owner says "essa nota não faz sentido" more than occasionally; no golden dataset in the repo; prompt changes shipped without re-running evals; dashboard comparing lawyers on scores nobody validated.

**Phase to address:**
Dedicated AI calibration phase, sequenced BEFORE the manager dashboard phase — do not surface scores to gestores until judge-expert agreement is measured and acceptable.

---

### Pitfall 6: LGPD exposure — storing sensitive third-party data the data subject never consented to

**What goes wrong:**
Transcripts contain the *lead's* data — often sensitive under LGPD Art. 5º/11 (health conditions in injury cases, religion, political opinion, family disputes) — and the lead never agreed to a third-party SaaS storing and AI-processing their messages. Add lawyers' sigilo profissional (Estatuto da OAB) on top. One breach or one ANPD complaint from a lead who discovers their legal matter was stored by an unknown startup is an existential event for a product sold to law firms.

**Why it happens:**
Teams design LGPD compliance around their *customer* (the lawyer) and forget the actual data subject is the lead. Compliance is treated as a terms-of-use writing task instead of an engineering requirement.

**How to avoid:**
- Get roles right contractually: the law firm is controlador; the SaaS is operador. The contrato/termos must obligate the firm to have a lawful basis and to inform leads (e.g., in their own privacy notice), and must define the SaaS's processing scope strictly.
- Engineering controls sized for sensitive data: encryption at rest and in transit, per-tenant access scoping, audit logs on transcript access (especially gestor reads), defined retention with automated secure deletion, deletion-on-demand endpoint that actually cascades (DB + backups policy + LLM provider).
- LLM provider: sign the DPA, use API tiers with training exclusion / zero-data-retention options, document the international transfer (Art. 33) in the privacy policy. Minimize what's sent — the LLM needs the conversation, not the lead's phone number; strip identifiers where feasible.
- Don't log transcript content in application logs / error trackers (Sentry breadcrumbs are a classic silent leak).
- Have an incident-response note: LGPD requires ANPD + data-subject notification for relevant incidents.

**Warning signs:**
Transcripts visible in logs; no retention job; "we'll do the DPA later"; privacy policy silent about AI processing or international transfer; deletion implemented as `deleted_at` flag with data still readable.

**Phase to address:**
Data/backend foundation phase (encryption, tenancy, retention, audit) + a compliance checklist gate before the closed-beta phase. Retrofitting encryption/retention after real client data exists is far more expensive.

---

### Pitfall 7: MV3 service worker state loss breaks the inactivity diagnostic

**What goes wrong:**
The flagship "diagnóstico automático por inatividade" is exactly the feature MV3 punishes: Chrome kills the extension service worker after ~30s idle, wiping all in-memory state. `setTimeout`/`setInterval` timers die with it. An inactivity timer held in a worker variable will simply never fire — the diagnostic silently doesn't happen, and it works fine in dev (where DevTools keeps the worker alive) then fails in production.

**Why it happens:**
Developers carry MV2/背景-page mental models: persistent background state, reliable timers. DevTools masks the termination behavior during development.

**How to avoid:**
- Never hold state in worker globals. Persist conversation activity timestamps to `chrome.storage.local` (or better: to the backend).
- Use `chrome.alarms` (not `setTimeout`) for inactivity checks — or move inactivity detection server-side entirely (extension pushes "last message at T" events; a backend cron decides when a conversation went idle and triggers the diagnostic). Server-side is more robust: it survives browser closes, laptop sleep, and worker death.
- Register all event listeners synchronously at the top level of the worker script; async registration silently drops wake-up events.
- Test with the worker forcibly terminated mid-flow (chrome://serviceworker-internals, or "stop" in chrome://extensions) — make it part of the QA checklist.
- Long LLM calls: a single event handler running >5min kills the worker; route LLM calls through the backend, not the worker.

**Warning signs:**
Any `let`-scoped state in the service worker; `setTimeout` anywhere in worker code; diagnostics that fire in dev but not for real users; WebSocket connections from the worker.

**Phase to address:**
Extension architecture phase (state/timer strategy decided up front) and the diagnostic-trigger phase (choose server-side inactivity detection).

---

### Pitfall 8: Cross-tenant transcript leak in the manager dashboard

**What goes wrong:**
One law firm's client conversations appear in another firm's dashboard. With privileged legal-case data, a single incident destroys the product's credibility and creates LGPD liability. Real-world failure modes go beyond a missing `WHERE tenant_id`: connection-pool contamination (tenant context not reset between pooled connections), cache keys not tenant-prefixed, admin/reporting endpoints bypassing RLS, and Postgres edge cases (CVE-2024-10976).

**Why it happens:**
Tenancy is enforced by convention ("remember to filter by org_id") instead of by mechanism; the manager dashboard adds aggregate queries written in a hurry that skip the scoping helper.

**How to avoid:**
- Enforce tenant scoping at one mandatory layer: Postgres RLS with session tenant context, or a repository layer where raw DB access is lint-forbidden. Both is better.
- If pooling + RLS: ensure the pooler issues `RESET ALL`/`DISCARD ALL` between checkouts.
- Prefix every cache key with tenant ID; treat cache as untrusted.
- Automated cross-tenant tests in CI: create two orgs, assert org B can never read org A's transcripts/scores through any endpoint (including exports and aggregates).
- The org model has two levels here (agência → escritórios → advogados during beta; later escritório = tenant). Model tenancy explicitly from the start so the beta's "agency sees all clients" superpower is a scoped role, not an RLS bypass.

**Warning signs:**
Endpoints querying by `conversation_id` alone without org check; ad-hoc SQL in dashboard aggregates; "admin mode" using a service-role connection; no cross-tenant test suite.

**Phase to address:**
Backend/data foundation phase (tenancy mechanism) with the cross-tenant test suite required before the manager dashboard phase ships.

---

### Pitfall 9: Stripe billing wired to entitlements incorrectly (or built at the wrong time)

**What goes wrong:**
Two failure flavors. (a) *Mechanical*: webhooks unverified, non-idempotent, or doing heavy work inline (Stripe needs a 2xx quickly; retries then double-provision accounts); subscription status changes (past_due, canceled) never flip the flag the app actually gates on, so churned users keep access — or paying users get locked out. Failed payments silently cancel subscriptions, losing 5-10% of MRR to recoverable involuntary churn. (b) *Sequencing*: building full self-serve billing before the closed beta, when beta users are hand-picked agency clients who could be provisioned manually — weeks spent on plan/upgrade/proration UX before knowing if the AI is good enough to sell.

**Why it happens:**
Billing feels like "real SaaS" so founders build it early and fully; webhook edge cases (out-of-order events, duplicates) don't appear in test mode happy paths.

**How to avoid:**
- For the beta: minimal Stripe — a single price, Checkout link, and a webhook that flips one `subscription_active` flag. Manual comping via Stripe dashboard is fine. Defer plans/proration/self-serve portal until post-validation (Stripe's hosted Customer Portal covers most of it when needed).
- Webhook hygiene: verify signatures, store processed event IDs (idempotency), enqueue heavy work, never assume event order — fetch current subscription state from the API when in doubt.
- Map every subscription status to explicit app behavior: trialing/active → access; past_due → access + warning + dunning; unpaid/canceled → downgrade.
- Enable Stripe Smart Retries + dunning emails before opening to market.
- Gate access on ONE canonical field that the webhook handler is the single writer of.

**Warning signs:**
Access checks reading `plan` while webhooks write `subscription_status`; webhook handler with no event-ID table; billing epic scheduled before AI calibration epic; test-mode-only testing.

**Phase to address:**
A thin billing phase late in the beta track (after AI validation); full billing hardening in the market-launch phase.

---

### Pitfall 10: Building the dashboard/platform before validating the AI brain

**What goes wrong:**
Months go into extension polish, dashboard charts, auth, and billing while the actual differentiator — suggestions and diagnostics the expert owner agrees with — remains unvalidated. If the methodology-as-prompts doesn't converge with the owner's judgment, everything built around it is inventory. This is the domain-specific version of "building the frame before the engine."

**Why it happens:**
Platform work has clear specs and visible progress; AI calibration is ambiguous, iterative, and requires the owner's time. Teams gravitate to the certain work.

**How to avoid:**
- Validate the AI brain with the cheapest possible harness: export real conversations (the agency already audits WhatsApp manually — transcripts exist), run them through the prompt pipeline in a script/notebook, and iterate with the owner until agreement is acceptable. No extension required for this.
- Sequence the roadmap so "AI quality validated on real conversations" is an explicit early milestone gate.
- Schedule the owner's calibration time as a project dependency — it's the scarcest resource.

**Warning signs:**
Roadmap where the extension UI, dashboard, and billing all precede any AI evaluation; owner hasn't scored a single AI output by mid-project; "we'll tune the prompts during beta."

**Phase to address:**
First or second phase of the roadmap — an AI validation spike using exported real conversations, before heavy extension/dashboard investment.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Selectors inline in content script (no adapter module) | Ships faster | Every WhatsApp update = multi-file emergency surgery | Never |
| Sending full transcript on every LLM call | Simple prompt code | Superlinear cost growth; unprofitable heavy users | MVP/beta only, with metering in place |
| Single holistic 0-10 prompt (no rubric) | Quick demo | Untrustworthy scores; expert rejects product | Prototype only, never in gestor dashboard |
| `deleted_at` soft-delete as "LGPD deletion" | Easy to implement | Non-compliant; data still readable; breach exposure | Never for transcript content |
| Tenancy by convention (manual `where org_id`) | No RLS learning curve | One missed filter = cross-firm leak of privileged data | Never |
| Manual account provisioning instead of self-serve billing | Skips weeks of billing UX | Ops toil at scale | Yes — throughout closed beta |
| Prompts hardcoded in extension bundle | No backend needed | Store re-review for every prompt tweak; exposes methodology IP | Never — prompts belong server-side |
| Skipping worker-termination testing | Faster QA | Inactivity diagnostics fail only in production | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| WhatsApp Web DOM | Assuming class names are stable; treating empty extraction as "no messages" | Stable anchors + fallbacks; distinguish "empty" from "extraction failed"; block AI on failure |
| WhatsApp Web DOM | Injecting into WhatsApp's internal JS modules for richer data | DOM-observation only; internals = deeper ToS violation + Meta detection |
| Chrome Web Store | "WhatsApp" in extension name/branding; broad host permissions | Compatibility phrasing; permissions limited to `web.whatsapp.com` + own API |
| LLM API (from extension) | Calling the LLM directly from the extension with an embedded API key | All LLM calls via backend; key never ships to client; enables metering + prompt secrecy |
| LLM API | No DPA / default data-retention tier for sensitive legal data | Signed DPA, training exclusion / ZDR tier, transfer disclosure in privacy policy |
| Stripe webhooks | Trusting event payloads without signature check; processing duplicates; assuming order | Verify signature, dedupe by event ID, enqueue work, fetch fresh state from API |
| Stripe | Gating access on a field webhooks don't write | One canonical entitlement field, single writer = webhook handler |
| chrome.storage | Treating it as secure storage for auth tokens/transcripts | It's readable on the machine; keep transcripts server-side, tokens short-lived |
| Sentry/logging | Error breadcrumbs capturing message content | Scrub transcript fields from all telemetry |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-history LLM prompts | Cost per suggestion climbs over conversation life | Rolling summary + recent window + prompt caching | Conversations >100 msgs; ~immediately for legal intake threads |
| MutationObserver on entire WhatsApp DOM | WhatsApp Web gets laggy; lawyers blame the extension | Observe narrow containers; debounce; extract on demand where possible | Busy accounts with constant incoming messages |
| Re-scoring idle conversations repeatedly | Duplicate diagnostics, duplicate cost | Idempotent trigger keyed on (conversation, last_message_at) | First week of real usage |
| Loading full transcripts in dashboard lists | Slow gestor dashboard | Store/serve summaries + scores; lazy-load transcript detail | Firms with hundreds of conversations |
| Un-metered LLM spend | Fine at 5 beta users, invoice shock later | Per-tenant token metering + alerts from day one | 20-50 active lawyers |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Transcripts unencrypted at rest | LGPD Art. 46 violation + breach of privileged legal data | Disk/column encryption; documented key management |
| Cross-tenant read paths (pool contamination, cache keys, admin bypass) | Firm A reads Firm B's privileged conversations | RLS + connection reset, tenant-prefixed cache, CI cross-tenant tests |
| LLM API key bundled in extension | Key theft → unlimited spend + data access | Backend-proxied LLM calls only |
| Transcript content in logs/error trackers | Silent sensitive-data sprawl outside the encrypted store | Log scrubbing; never log message bodies |
| No audit trail on transcript access | Can't answer "who read this privileged conversation" (sigilo profissional) | Access logs on transcript reads, esp. gestor views |
| Deletion requests not cascading to LLM provider/backups | Non-compliant "exclusão sob demanda" | Deletion runbook covering DB, backups policy, provider retention tier |
| Extension auth tokens long-lived in chrome.storage | Token theft from compromised machine | Short-lived tokens + refresh; revoke on subscription end |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent extraction failure | Lawyer trusts a diagnostic built on a broken/partial read | Explicit health indicator; block suggestions when extraction is unverified |
| Score without explanation | "Nota 4? Por quê?" — distrust, dashboard resentment | Per-criterion feedback (acertos/erros/melhorias) with the score |
| Diagnostic fires while negotiation is just slow | Premature "conversa perdida" framing demotivates | Tunable inactivity window; allow re-open/re-score when conversation resumes |
| Suggestion latency >10s with no feedback | Lawyer sends their own reply; feature abandoned | Streaming or progress state; keep P95 latency tight |
| Dashboard as surveillance | Lawyers sabotage adoption ("ferramenta de vigilância") | Frame as coaching: show lawyer their own feedback first; gestor view aggregates |
| Suggestions ignoring pt-BR legal register | Generic "sales-y" text lawyers won't send | Methodology prompt + tone constraints; expert review of suggestion style in calibration |

## "Looks Done But Isn't" Checklist

- [ ] **DOM extraction:** Works on your account — verify against long conversations, media/audio messages, replies/quotes, deleted messages, group chats (excluded?), and after a forced WhatsApp Web refresh.
- [ ] **Inactivity diagnostic:** Fires in dev — verify with service worker forcibly terminated, browser closed overnight, and laptop sleep (server-side trigger is the real fix).
- [ ] **LLM scoring:** Produces plausible scores — verify measured agreement vs. owner's scores on a golden set, and re-verify after any prompt/model change.
- [ ] **LGPD deletion:** Endpoint exists — verify data actually unrecoverable (DB rows, backups policy, LLM provider retention, logs).
- [ ] **Multi-tenancy:** Queries filtered — verify with automated two-org cross-access tests on every endpoint including exports/aggregates.
- [ ] **Stripe:** Checkout works — verify webhook signature check, duplicate-event handling, past_due/canceled behavior, and access revocation on cancellation.
- [ ] **Chrome Web Store:** Extension approved once — verify listing survives permission audits (re-review happens on every update), and privacy disclosures match actual data flows.
- [ ] **Conversion tracking:** Outcome buttons exist — verify lawyers actually mark outcomes (if unmarked conversations dominate, conversion metrics are fiction; needs nudges/defaults).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WhatsApp UI update breaks extraction | LOW-MEDIUM (if adapter isolated) | Fix selectors in adapter, ship extension update, wait store review (hours-days); user-facing "update pending" state covers the gap |
| Chrome Web Store takedown | HIGH | Appeal with policy remediation; meanwhile beta users on unlisted/self-hosted path; fix root cause (naming/permissions/disclosures) |
| Customer number banned by WhatsApp | HIGH (trust) | Support Meta appeal; audit that extension stayed read-only; reinforce ToS disclosure; if pattern emerges, re-audit footprint |
| Scores diverged from expert after model update | MEDIUM | Pin previous model version; re-run golden-set eval; recalibrate prompts; annotate affected diagnostics in dashboard |
| Cross-tenant leak discovered | HIGH | Incident response: scope the exposure, ANPD/controller notification per LGPD, fix mechanism (RLS/pool), add CI tests, disclosure to affected firms |
| LLM cost overrun | LOW-MEDIUM | Enable caching + summary window; add per-tenant caps; reprice heavy tiers |
| Billing state drift (access vs. Stripe) | LOW | Reconciliation job comparing Stripe subscriptions to entitlement flags; backfill |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI unvalidated before platform build (P10) | Phase 1-2: AI validation spike on exported real conversations | Owner-scored golden set exists; agreement threshold met before extension/dashboard phases start |
| Uncalibrated scoring (P5) | AI calibration phase (before dashboard phase) | Judge-vs-expert agreement measured; eval re-run in CI on prompt changes |
| DOM fragility (P1) | Extension extraction phase | Single adapter module; runtime self-test; extraction-failure UI state demonstrated |
| Read-only drift / ban risk (P2) | Extension architecture phase + ongoing review | Code review checklist: no send, no composer injection, no WhatsApp internals |
| Web Store rejection (P3) | Extension scaffold phase + pre-launch compliance gate | Manifest audit (permissions, no remote code); naming/trademark check; privacy disclosures complete |
| MV3 worker state loss (P7) | Extension architecture + diagnostic-trigger phase | Inactivity diagnostic fires with worker force-killed; no globals/setTimeout in worker |
| LLM cost blowout (P4) | AI integration phase | Token metering per tenant live; context window strategy + caching implemented; cost-per-conversation dashboard |
| LGPD exposure (P6) | Backend/data foundation phase + pre-beta compliance gate | Encryption verified; retention job runs; deletion cascades; DPA signed; privacy policy covers AI + transfer |
| Cross-tenant leak (P8) | Backend foundation phase (before dashboard ships) | CI cross-tenant test suite green; RLS/pool reset configured |
| Stripe mistakes (P9) | Thin billing phase (late beta) → hardening at market launch | Webhook signature+idempotency tests; status→behavior matrix implemented; dunning enabled pre-launch |

## Sources

Confidence tiers assigned via gsd-tools classify-confidence (websearch cross-verified = MEDIUM).

- [Socket/Hacker News: 131 Chrome extensions hijacking WhatsApp Web (Oct 2025)](https://thehackernews.com/2025/10/131-chrome-extensions-caught-hijacking.html) — MEDIUM (multi-outlet corroboration: [Malwarebytes](https://www.malwarebytes.com/blog/news/2025/10/over-100-chrome-extensions-break-whatsapps-anti-spam-rules), [Forbes](https://www.forbes.com/sites/zakdoffman/2025/10/21/if-you-use-whatsapp-delete-every-chrome-extension-on-this-list/))
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) + [Remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) — MEDIUM (official)
- [Chrome extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — MEDIUM (official)
- [Stripe: Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) + [webhook best practices](https://docs.stripe.com/webhooks) — MEDIUM (official)
- [InstaTunnel: Multi-tenant leakage — when RLS fails](https://instatunnel.my/blog/multi-tenant-leakage-when-row-level-security-fails-in-saas) + [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — MEDIUM
- [Guia LGPD aplicada aos Escritórios de Advocacia (OAB Campinas)](https://oabcampinas.org.br/wp-content/uploads/2021/12/Guia-LGPD_Advocacia.pdf) + [ConJur: sigilo profissional e LGPD](https://www.conjur.com.br/2020-jan-29/opiniao-sigilo-profissional-advogado-frente-lgpd/) + [Migalhas: advogados como controladores/operadores](https://www.migalhas.com.br/coluna/impressoes-digitais/336001/qual-o-papel-dos-advogados-enquanto-agentes-de-tratamento-de-dados--controladores-ou-operadores) — MEDIUM
- [LangChain: Calibrating LLM-as-Judge with human corrections](https://www.langchain.com/resources/llm-as-a-judge) + [Galileo: 7 LLM-as-judge mistakes](https://galileo.ai/blog/why-llm-as-a-judge-fails) + [GoDaddy: Calibrating scores of LLM-as-a-judge](https://www.godaddy.com/resources/news/calibrating-scores-of-llm-as-a-judge) — MEDIUM
- [Token budget management in production LLM systems](https://tianpan.co/blog/2025-11-11-managing-token-budgets-production-llm-systems) + [Mem0: chat history summarization](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — LOW-MEDIUM
- [Zero data retention for LLM providers](https://www.teleskope.ai/post/zero-data-retention) + [Merge: ZDR gateway](https://www.merge.dev/blog/zero-data-retention-gateway) — LOW-MEDIUM
- [5 Things We Got Wrong About Stripe Billing](https://dev.to/obsidiancladlabs/5-things-we-got-wrong-about-stripe-billing-3439) — LOW (single-source practitioner post-mortem, consistent with official docs)

---
*Pitfalls research for: AI copilot Chrome extension for WhatsApp Web (legal SaaS, LGPD)*
*Researched: 2026-07-04*
