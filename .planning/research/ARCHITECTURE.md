# Architecture Research

**Domain:** AI copilot Chrome extension for WhatsApp Web + multi-tenant SaaS dashboard (legal lead conversion, Brazilian market)
**Researched:** 2026-07-04
**Confidence:** MEDIUM (web-sourced patterns cross-verified against official Chrome/Stripe documentation and multiple independent sources; WhatsApp Web reading approach verified against active open-source projects)

## Standard Architecture

This product class ("WhatsApp Web side-panel SaaS" — same shape as WaSpeed/WaLeads, plus an LLM analysis layer) has a well-established four-part structure: a Chrome MV3 extension that observes WhatsApp Web, a backend API that owns all secrets and business logic, a web dashboard for managers, and a shared multi-tenant Postgres database. The extension is a *thin sensor + UI*; everything intelligent (LLM calls, scoring, inactivity detection, billing) lives server-side.

### System Overview

```
┌────────────────────────── Chrome (lawyer's browser) ──────────────────────────┐
│  WhatsApp Web tab (web.whatsapp.com)                                          │
│  ┌──────────────────────┐   window.postMessage   ┌───────────────────────┐    │
│  │ MAIN-world script     │◄──────────────────────►│ ISOLATED content      │    │
│  │ (wa-js bridge:        │                        │ script (relay,        │    │
│  │  reads WA internal    │                        │ DOM fallback,         │    │
│  │  store, chat events)  │                        │ active-chat tracking) │    │
│  └──────────────────────┘                        └──────────┬────────────┘    │
│                                                              │ runtime msgs    │
│  ┌──────────────────────┐    chrome.runtime ports  ┌─────────▼────────────┐   │
│  │ Side Panel UI         │◄────────────────────────►│ Background service   │   │
│  │ (login, "Sugerir      │                          │ worker (auth token   │   │
│  │  resposta", outcome   │                          │ mgmt, ALL fetches    │   │
│  │  marking, diagnostics)│                          │ to backend API)      │   │
│  └──────────────────────┘                          └─────────┬────────────┘   │
└──────────────────────────────────────────────────────────────┼────────────────┘
                                                     HTTPS + Bearer token
┌──────────────────────────────────────────────────────────────▼────────────────┐
│                              Backend API (single deployable)                   │
│  ┌──────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Auth     │ │ Transcript    │ │ LLM proxy    │ │ Inactivity│ │ Stripe    │  │
│  │ (JWT +   │ │ ingest        │ │ (methodology │ │ engine    │ │ webhooks +│  │
│  │ refresh) │ │ (upsert msgs) │ │ prompt lives │ │ (cron/    │ │ entitle-  │  │
│  │          │ │               │ │ HERE)        │ │ queue)    │ │ ments     │  │
│  └──────────┘ └───────────────┘ └──────┬───────┘ └─────┬─────┘ └─────┬─────┘  │
│                                        │               │             │        │
└────────────────────────────────────────┼───────────────┼─────────────┼────────┘
                    ┌────────────────────┤               │             │
                    ▼                    ▼               ▼             ▼
            ┌──────────────┐   ┌──────────────────────────────┐  ┌─────────┐
            │ LLM provider │   │ Postgres (multi-tenant,      │  │ Stripe  │
            │ (API key     │   │ org_id on every row, RLS,    │  │         │
            │ server-only) │   │ encrypted at rest) + job     │  └─────────┘
            └──────────────┘   │ queue (delayed jobs)         │
                               └──────────────▲───────────────┘
                                              │ reads
                               ┌──────────────┴───────────────┐
                               │ Manager Web Dashboard         │
                               │ (scores, transcripts,         │
                               │ conversion, per-lawyer views) │
                               └──────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| MAIN-world script (wa-js bridge) | Read active conversation from WhatsApp Web's internal store; emit message/chat-change events | `@wppconnect/wa-js` injected via `chrome.scripting.registerContentScripts({world:'MAIN'})`, exposes `window.WPP` (`WPP.chat` functions/events) |
| ISOLATED content script | Relay between page world and extension world; track which chat is open; DOM-selector fallback if wa-js breaks | `window.postMessage` bridge + `MutationObserver` fallback anchored on `data-id` attributes, never obfuscated class names |
| Background service worker | Owns auth tokens, performs ALL backend fetches, routes messages between content script and side panel | MV3 service worker; ephemeral — state in `chrome.storage`, listeners registered synchronously at top level |
| Side Panel UI | Login, "Sugerir resposta" button, show suggestions/diagnostics, mark outcome (fechado/perdido) | `chrome.sidePanel` API, per-tab panel, React/Vue bundle; `sidePanel.open()` requires user gesture |
| Backend API | Auth, tenant resolution, transcript ingest, LLM proxying, diagnostic scoring, entitlement gating | Node/TS monolith (Fastify/Nest/Hono) — single deployable at this scale |
| LLM proxy module | Holds provider key + the agency methodology prompt (the product's IP); builds prompts server-side from stored transcript; rate-limits per user | Thin internal service; extension only sends `conversation_id` + intent, never the prompt |
| Inactivity engine | Detect "conversation ended"; trigger diagnostic generation | Server-side: `last_activity_at` per conversation + scheduled sweep or delayed job re-scheduled on each message |
| Job queue / scheduler | Async LLM diagnostic runs, Stripe webhook processing, retention/deletion jobs | Redis-backed queue (BullMQ) or pg-based (pg-boss/Graphile Worker) — pg-based avoids extra infra |
| Manager dashboard | Per-lawyer scores/evolution, transcripts, conversion rate, subscription management | Standard web app (Next.js or similar) hitting same API, role-gated (manager vs lawyer) |
| Postgres | Multi-tenant store: orgs → users → conversations → messages → analyses → outcomes; subscription mirror | Shared schema, `org_id` on every table, RLS as defense-in-depth, encryption at rest |

## Recommended Project Structure

Monorepo — extension, dashboard, and API share types (transcript schema, analysis schema, API contracts), and this product iterates across all three at once.

```
apps/
├── extension/               # Chrome MV3 extension
│   ├── src/
│   │   ├── background/      # service worker: auth, API client, message routing
│   │   ├── content/         # ISOLATED content script: relay, chat tracking, DOM fallback
│   │   ├── page/            # MAIN-world script: wa-js bootstrap + event forwarding
│   │   ├── sidepanel/       # panel UI (login, suggest, diagnostic, outcome)
│   │   └── shared/          # extension-internal message protocol types
│   └── manifest.json
├── api/                     # backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/        # email/password, JWT + refresh
│   │   │   ├── transcripts/ # ingest/upsert messages, conversations
│   │   │   ├── ai/          # LLM proxy: suggestion + diagnostic prompts, scoring
│   │   │   ├── inactivity/  # sweep job, conversation-ended events
│   │   │   ├── billing/     # Stripe checkout, webhooks, entitlements
│   │   │   ├── orgs/        # tenants, users, roles
│   │   │   └── compliance/  # retention jobs, deletion-on-demand, audit log
│   │   ├── db/              # schema, migrations, RLS policies
│   │   └── jobs/            # queue workers (diagnostics, retention)
│   └── prompts/             # versioned methodology prompts (server-only, NEVER in extension)
├── dashboard/               # manager web app
└── packages/
    └── shared/              # zod schemas / API types shared by all three apps
```

### Structure Rationale

- **`page/` vs `content/` split:** MV3 forces the wa-js bridge into the page's MAIN world (separate JS context); keeping it a distinct entry point makes the postMessage boundary explicit and testable.
- **`api/prompts/` as first-class directory:** the methodology prompt is the core IP and will be iterated constantly during calibration — version it like code, keep it server-side only.
- **`packages/shared/`:** the transcript message shape crosses three boundaries (page→content→SW→API→DB→dashboard); one schema definition prevents drift.
- **Module-per-domain in API:** matches the phase build order (auth → transcripts → ai → inactivity → billing → compliance) so phases map to modules.

## Architectural Patterns

### Pattern 1: MAIN-world store bridge with DOM fallback (WhatsApp reading)

**What:** Instead of scraping WhatsApp Web's obfuscated CSS classes, inject `@wppconnect/wa-js` into the page's MAIN world. It hooks WhatsApp Web's internal module store and exposes stable functions/events (`WPP.chat.getMessages`, `WPP.on('chat.new_message')`). Keep a minimal DOM-based reader (anchored on `data-id` / `.message-in` / `.message-out` / `role` attributes with `MutationObserver`) as a degraded fallback.
**When to use:** Always, for this product — it is the difference between breaking on every WhatsApp CSS refresh vs breaking only on internal-module refactors (which wa-js maintainers patch quickly; it is actively maintained, v4.x, MIT).
**Trade-offs:** Adds a dependency you must update when WhatsApp ships breaking changes; MAIN-world injection must be registered from the service worker (`chrome.scripting.registerContentScripts` with `world: 'MAIN'` — declaring MAIN world statically in manifest is unreliable). wa-js exposes a global (`window.WPP`) that can collide with competitors' extensions built on the same lib — configure a custom global name.

**Example:**
```typescript
// background/register.ts — MAIN world must be registered programmatically
chrome.scripting.registerContentScripts([{
  id: 'wa-bridge',
  matches: ['https://web.whatsapp.com/*'],
  js: ['page/wa-bridge.js'],   // bundles wa-js
  world: 'MAIN',
  runAt: 'document_idle',
}]);

// page/wa-bridge.js — page world, talks to content script via postMessage
WPP.webpack.onFullReady(() => {
  WPP.on('chat.new_message', (msg) => {
    window.postMessage({ src: 'copiloto', type: 'NEW_MESSAGE', payload: serialize(msg) }, '*');
  });
});

// content/relay.ts — ISOLATED world, forwards to service worker
window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.src === 'copiloto') {
    chrome.runtime.sendMessage(e.data);
  }
});
```

### Pattern 2: Backend LLM proxy — extension never builds prompts

**What:** The extension NEVER holds LLM API keys (any bundled key is trivially extractable from the CRX). More importantly here: the extension doesn't even send the prompt. It syncs the transcript to the backend continuously; when the lawyer clicks "Sugerir resposta," it sends only `{ conversationId }`. The backend assembles the prompt from the stored transcript + the server-side methodology prompt, calls the LLM, logs tokens/cost per org, and returns the suggestion.
**When to use:** Always. This simultaneously solves: key security, methodology-prompt IP protection, per-tenant rate limiting/cost control, prompt iteration without extension re-release (Chrome Web Store review takes days), and gives the diagnostic engine the same transcript source.
**Trade-offs:** Requires transcript sync to be reliable *before* suggestions work (build-order dependency). Adds one network hop of latency — irrelevant next to LLM latency.

**Example:**
```typescript
// api/modules/ai/suggest.ts
async function suggest(orgId: string, userId: string, conversationId: string) {
  await assertEntitled(orgId);                    // subscription gate
  await rateLimit(userId, 'suggest');             // cost control
  const transcript = await getTranscript(orgId, conversationId);
  const prompt = buildSuggestionPrompt(METHODOLOGY_V1, transcript); // server-only IP
  const res = await llm.complete(prompt);
  await logUsage(orgId, userId, res.usage);
  return res.text;
}
```

### Pattern 3: Server-side inactivity detection (conversation-ended trigger)

**What:** The client cannot be trusted to detect "conversation ended" — the lawyer closes the tab, the laptop sleeps, and MV3 service workers are killed within ~30s of idle. Instead: every transcript sync updates `conversations.last_activity_at`. A server job detects conversations whose `last_activity_at` exceeded the threshold (e.g., 6–24h for WhatsApp's async cadence) AND that have no diagnostic yet, then enqueues the diagnostic LLM job.

Two implementations, pick one:
1. **Periodic sweep (recommended for v1):** cron every N minutes runs one indexed query (`WHERE last_activity_at < now() - interval AND diagnostic_status = 'pending'`). Dead simple, idempotent, no per-conversation timer state.
2. **Delayed job per conversation:** enqueue a delayed job on each message, cancel/reschedule on the next message. Lower latency precision, but more moving parts and race conditions in multi-instance deployments (industry implementations — e.g., Rasa's inactivity handling — need Redis-backed timers and race guards for exactly this).

**When to use:** Sweep for v1; delayed jobs only if diagnostic timing precision ever matters (it doesn't — "some hours after the conversation went quiet" is the requirement).
**Trade-offs:** Sweep granularity = cron interval (fine). Must guard against re-analysis when a lead replies *after* a diagnostic was generated — model this explicitly (either reopen the conversation and supersede the diagnostic, or version diagnostics per conversation "episode").

### Pattern 4: Shared-schema multi-tenancy with RLS backstop

**What:** Single Postgres database, single schema, `org_id` column on every tenant-owned table, composite indexes led by `org_id`. Postgres Row Level Security as defense-in-depth: policies filter by `current_setting('app.current_org_id')`, set per-transaction via `set_config(..., true)` (transaction-scoped — safe with PgBouncer transaction pooling). The API resolves org from the verified JWT and sets it on every transaction; RLS guarantees a code bug can't leak another agency's transcripts.
**When to use:** This exact product — tenant counts in the dozens-to-hundreds (agencies/law offices), highly sensitive data (leaked legal conversations would be catastrophic), single small team operating it.
**Trade-offs:** RLS adds slight per-query overhead and requires discipline (all access through a wrapper that sets tenant context, including background jobs). It complements, never replaces, API-boundary tenant checks.

**Data model (tenant hierarchy):**
```
organizations (agency/law office; stripe_customer_id, plan, status)
  └── users (role: manager | lawyer; email/password auth)
        └── conversations (wa_chat_id, lead label/phone-hash, last_activity_at,
            outcome: open | won | lost, diagnostic_status)
              ├── messages (wa_message_id UNIQUE per conversation, direction,
              │             body [encrypted], timestamp)  ← upsert-idempotent
              └── analyses (type: suggestion | diagnostic; score 0-10,
                            feedback JSON, prompt_version, model, token_usage)
subscriptions (mirror of Stripe state, keyed by org)
audit_log / deletion_requests (LGPD)
```
Key modeling notes: `wa_message_id` (WhatsApp's own `data-id`) makes transcript upload idempotent — the extension can re-send overlapping batches safely. `prompt_version` on analyses is essential for the calibration loop (comparing owner's judgment against specific methodology versions).

### Pattern 5: Webhook-mirrored Stripe entitlements

**What:** Use hosted Stripe Checkout to start subscriptions and the hosted Customer Portal for self-service. The database mirrors subscription state via webhooks (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) — signature-verified, processed idempotently (webhooks retry). Every AI endpoint gates on the org's mirrored status; the extension login response includes entitlement so the panel can show "assinatura inativa" states.
**When to use:** Always for early-stage SaaS — hosted surfaces eliminate PCI scope and card-form work.
**Trade-offs:** Webhook handling must be idempotent and async; there is a short window between payment and webhook arrival — treat `checkout.session.completed` as source of truth, not the redirect.

## Data Flow

### Flow 1: Transcript sync (continuous, foundation for everything)

```
WhatsApp store event (new msg / chat opened)
  → MAIN-world wa-js bridge (serialize msg)
  → postMessage → ISOLATED content script
  → chrome.runtime message → background service worker (batch + debounce)
  → POST /conversations/:waChatId/messages (Bearer token)
  → API: resolve org from JWT → upsert by wa_message_id → update last_activity_at
  → Postgres (body encrypted at rest)
```
Direction: extension → backend, one-way, idempotent. The extension keeps only a small send-buffer in `chrome.storage`; the server copy is canonical.

### Flow 2: On-demand suggestion

```
Lawyer clicks "Sugerir resposta" (side panel)
  → panel → SW → POST /ai/suggest { conversationId }
  → API: entitlement gate → rate limit → load transcript from DB
  → build prompt (server-side methodology) → LLM provider
  → suggestion stored as analysis row → returned to panel → lawyer reads, types manually
```
Note: suggestion is generated from the *server's* stored transcript, which is why Flow 1 must be reliable first. (Optional freshness guard: panel sends the latest `wa_message_id` it can see; API waits for/ingests it before prompting.)

### Flow 3: Automatic diagnostic (inactivity)

```
cron sweep (server) → conversations idle > threshold, diagnostic_status = pending
  → enqueue diagnostic job → worker: load transcript → scoring prompt (0-10 + feedback)
  → store analysis (type=diagnostic, prompt_version) → mark diagnostic_status = done
  → surfaced in side panel on next open + manager dashboard
```
Fully server-side; works even if the lawyer never reopens Chrome.

### Flow 4: Outcome + manager view

```
Lawyer marks "contrato fechado / perdido" (panel) → PATCH /conversations/:id/outcome
Manager dashboard → GET /orgs/:id/report → per-lawyer avg score, evolution,
  conversion rate (won / closed), transcript drill-down → same API, role-gated (RLS backstop)
```

### State Management (extension)

The MV3 service worker is ephemeral — no in-memory session. Auth tokens in `chrome.storage` (access token in `chrome.storage.session`, refresh token in `chrome.storage.local`); refresh-before-request with a ~60s expiry buffer; on 401/revocation, clear storage and flip the panel to logged-out. Side panel ↔ SW via `chrome.runtime.connect` port (panel lifetime = port lifetime, which also tells the SW when the panel is open).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Beta (1 agency, ~10-50 lawyers) | Single API deployable + Postgres (managed, e.g. Supabase/RDS/Neon) + pg-based job queue. No Redis, no microservices. This is the v1 target. |
| 1k-10k lawyers | Move queue to Redis/BullMQ if pg queue strains; add read replica for dashboard reports; batch transcript ingestion endpoint; LLM cost controls become the real constraint (caching, cheaper models for diagnostics). |
| 100k+ | Not a v1 concern. Partition conversations/messages by org_id; consider dedicated ingest service. |

### Scaling Priorities

1. **First bottleneck: LLM cost, not traffic.** Diagnostics fire automatically per conversation — cap diagnostics/day/org, use a cheaper model for scoring than for suggestions, and monitor token usage per org from day one (the `token_usage` column pays for itself).
2. **Second bottleneck: message ingest chattiness.** Naive per-message POSTs from a busy lawyer are wasteful — debounce/batch in the service worker (e.g., flush every 5–10s or 20 messages).

## Anti-Patterns

### Anti-Pattern 1: LLM API key (or methodology prompt) in the extension

**What people do:** Call OpenAI/Anthropic directly from the extension with a bundled key, prompt assembled client-side.
**Why it's wrong:** CRX bundles are trivially unzipped — key theft, unbounded cost, and your methodology prompt (the entire competitive moat per PROJECT.md) is copied by the first competitor who inspects the bundle.
**Do this instead:** Pattern 2 — extension sends `conversationId` only; keys and prompts live server-side; prompt iteration ships without Web Store review.

### Anti-Pattern 2: Scraping WhatsApp Web by CSS class names

**What people do:** `document.querySelectorAll('._amk4 ._ao3e')`-style selectors on obfuscated, build-generated class names.
**Why it's wrong:** These classes change on every WhatsApp Web deploy — the product silently breaks weekly.
**Do this instead:** wa-js MAIN-world bridge as primary (reads the internal store, not the DOM); if any DOM reading is needed, anchor on semantic attributes (`data-id`, `role`, `.message-in/.message-out` which are longer-lived) and centralize every selector in one versioned module with a health-check that reports breakage telemetry to the backend.

### Anti-Pattern 3: Client-side "conversation ended" timers

**What people do:** `setTimeout` in the content script or service worker to trigger the diagnostic after N minutes of silence.
**Why it's wrong:** MV3 service workers are killed after ~30s idle; tabs close; laptops sleep. Diagnostics silently never fire — and this feature is the product's headline ("advogado não precisa lembrar de finalizar").
**Do this instead:** Pattern 3 — server-side `last_activity_at` + cron sweep. The server already has the transcript; it needs nothing from the client to decide.

### Anti-Pattern 4: Treating the extension's local data as canonical

**What people do:** Accumulate transcript in extension storage and upload "the whole conversation" at diagnostic time.
**Why it's wrong:** `chrome.storage` is per-browser and evictable; the manager dashboard and the inactivity engine both need the transcript server-side long before the conversation ends; a lost laptop loses data.
**Do this instead:** Continuous idempotent sync (Flow 1) with `wa_message_id` upserts; extension holds only an unsent buffer.

### Anti-Pattern 5: Trusting Checkout redirects / polling Stripe

**What people do:** Grant access on the `success_url` redirect, or poll the Stripe API for subscription status per request.
**Why it's wrong:** Redirects can be spoofed/abandoned; polling adds latency and rate-limit risk.
**Do this instead:** Pattern 5 — webhook-mirrored `subscriptions` table, signature-verified, idempotent handlers; gate on the local mirror.

### Anti-Pattern 6: LGPD as a final phase

**What people do:** Build everything on plaintext transcripts, bolt on encryption/retention before launch.
**Why it's wrong:** Encryption-at-rest strategy (application-level column encryption vs disk-level, per-org keys enabling crypto-shredding for deletion-on-demand) changes the messages table design and every query path. Retention deletion also interacts with the analyses/reporting model (aggregates must survive transcript deletion).
**Do this instead:** Decide in the schema phase: disk-level encryption (managed Postgres default) + application-level encryption for `messages.body` with per-org data keys; retention job and deletion-request workflow designed alongside the transcript module; keep score/conversion aggregates in analyses rows so LGPD deletion of transcripts doesn't destroy the manager's historical metrics.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| WhatsApp Web (unofficial) | wa-js MAIN-world injection + DOM fallback; read-only | ToS gray zone (accepted per PROJECT.md); expect breakage on WA updates — ship extension update pipeline + breakage telemetry from day one; Web Store review latency (days) is your patch bottleneck, so keep selectors/bridge logic as remotely-configurable as policy allows (Chrome forbids remote *code*, but remote *config* — selector maps, thresholds — is allowed) |
| LLM provider | Server-side SDK, one thin internal `ai` module; log tokens per org | Keep provider-agnostic interface — calibration may demand model swaps; pt-BR quality matters in model choice |
| Stripe | Hosted Checkout + Customer Portal + webhooks → local mirror | Webhook endpoint must be idempotent; test with `stripe listen` locally |
| Chrome Web Store | Distribution channel | Review adds days of latency to any extension fix — a reason to keep logic server-side |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| MAIN world ↔ ISOLATED content script | `window.postMessage` (namespaced, origin-checked) | Only serializable message data crosses; validate everything — the page world is hostile territory |
| Content script / side panel ↔ service worker | `chrome.runtime` messages + long-lived ports | SW is the single owner of tokens and network; panel and content script never fetch directly |
| Extension ↔ Backend API | HTTPS REST + Bearer JWT (refresh flow) | Same API serves dashboard; version it (`/v1`) — old extension versions linger in the field |
| Dashboard ↔ Backend API | Same REST API, role-gated (manager sees org-wide, lawyer sees own) | Enforce role at API + RLS backstop |
| API ↔ Jobs/queue | Enqueue with org context; workers set tenant context before DB access | RLS applies to workers too — easy to forget |

## Suggested Build Order (dependency-driven)

1. **Backend skeleton + multi-tenant schema + auth** — orgs/users/JWT; everything depends on tenant-scoped identity. (RLS policies land with the first migrations.)
2. **Extension shell** — MV3 manifest, side panel opens on WhatsApp Web, login against backend, token lifecycle in SW. Proves the extension↔backend seam.
3. **WhatsApp reading + transcript sync** — wa-js bridge, active-chat tracking, idempotent message upload. *Highest technical risk — validate early; everything AI depends on it.* (Flow 1)
4. **LLM suggestion ("Sugerir resposta")** — server-side prompt from stored transcript, panel UX. First moment the core value is testable with the owner. (Flow 2)
5. **Inactivity diagnostic + outcome marking** — sweep job, scoring prompt (0-10 + feedback), won/lost marking. Completes the per-conversation loop and starts producing calibration data. (Flow 3)
6. **Manager dashboard** — reads data that now exists: scores, transcripts, conversion per lawyer. (Flow 4)
7. **Stripe billing + entitlement gating** — can run last before beta since the beta cohort is the agency's own clients; gate AI endpoints once live.
8. **LGPD hardening pass** — retention jobs, deletion-on-demand workflow, terms — *but* encryption/crypto-shredding decisions are made back in step 1's schema (see Anti-Pattern 6).

Rationale: risk-first (WhatsApp reading is the make-or-break unknown), then value-first (suggestions/diagnostics enable the owner's iterative calibration, which PROJECT.md names as the real success criterion), then monetization/compliance which are well-trodden and don't inform earlier design beyond the schema decisions noted.

## Sources

- WhatsApp Web reading: [wppconnect-team/wa-js (GitHub)](https://github.com/wppconnect-team/wa-js), [wa-js docs](https://wppconnect.io/wa-js/), [WhatsApp-Web-AI-Assistant example extension](https://github.com/silham/WhatsApp-Web-AI-Assistant), [WhatsApp voice transcription extension write-up (data-id / IndexedDB details)](https://www.pascal-poredda.com/blog/a-chrome-extension-to-transcribe-whatsapp-voice-messages), [MV3 WhatsApp automation extension](https://dev.to/emmanuel_saleem_46200ad37/i-built-a-whatsapp-web-automation-chrome-extension-manifest-v3-5hl1)
- MV3 architecture: [Migrate to a service worker (Chrome for Developers)](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers), [chrome.sidePanel API reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [Side Panel launch blog](https://developer.chrome.com/blog/extension-side-panel-launch), [MAIN-world injection in MV3](https://davidwalsh.name/inject-global-mv3), [Side panel ↔ content script pattern](https://dev.to/jgrisafe/interacting-with-web-content-using-chromes-new-side-panel-extension-feature-4ock)
- LLM proxy: [kaiban-llm-proxy (frontend key-hiding proxy)](https://github.com/kaiban-ai/kaiban-llm-proxy), [LiteLLM proxy docs](https://docs.litellm.ai/docs/simple_proxy), [LLM-powered Chrome extensions guide](https://palospublishing.com/developing-chrome-extensions-powered-by-llms/)
- Extension auth: [OAuth refresh tokens in a Chrome extension](https://www.xiegerts.com/post/chrome-extension-google-oauth-refresh-token/), [Curity: storing tokens in the browser](https://curity.medium.com/best-practices-for-storing-access-tokens-in-the-browser-6b3d515d9814)
- Inactivity detection: [Zendesk chat timeout behavior](https://support.zendesk.com/hc/en-us/articles/4408836091034-When-do-chats-time-out), [Temporal: persistent conversational AI (server-side timer pattern)](https://temporal.io/blog/building-a-persistent-conversational-ai-chatbot-with-temporal), [Genesys async chat deployment (inactivity semantics)](https://docs.genesys.com/Documentation/ESChat/latest/Admin/DeployAsyncReg?action=pdfpage)
- Multi-tenancy: [AWS: multi-tenant isolation with Postgres RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/), [Nile: shipping multi-tenant SaaS with RLS](https://www.thenile.dev/blog/multi-tenant-rls), [PlanetScale: approaches to tenancy in Postgres](https://planetscale.com/blog/approaches-to-tenancy-in-postgres)
- Stripe: [Build a subscriptions integration (Stripe docs)](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [Webhooks with subscriptions (Stripe docs)](https://docs.stripe.com/billing/subscriptions/webhooks), [SaaS subscriptions use case (Stripe docs)](https://docs.stripe.com/get-started/use-cases/saas-subscriptions)
- LGPD: [Serpro: dados sensíveis LGPD](https://www.serpro.gov.br/lgpd/menu/protecao-de-dados/dados-sensiveis-lgpd), [Crypto-shredding vs LGPD Art. 18](https://www.calculadora-raid.org/artigos/o-paradoxo-da-imutabilidade-blindagem-contra-ransomware-versus-o-artigo-18-da-lgpd/), [LGPD e criptografia](https://www.every.com.br/post/lgpd-na-%C3%A1rea-e-a-criptografia-de-dados-pessoais)

---
*Architecture research for: AI copilot Chrome extension for WhatsApp Web + multi-tenant SaaS (legal lead conversion)*
*Researched: 2026-07-04*
