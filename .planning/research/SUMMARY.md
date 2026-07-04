# Project Research Summary

**Project:** AI copilot Chrome extension for WhatsApp Web — legal lead conversion SaaS (pt-BR)
**Domain:** Chrome MV3 extension + LLM analysis backend + multi-tenant SaaS dashboard (Brazilian legal market, LGPD, Stripe)
**Researched:** 2026-07-04
**Confidence:** MEDIUM-HIGH

## Executive Summary

This product sits in an empty market intersection: Gong-style AI conversation scoring and coaching, delivered inside WhatsApp Web where Brazilian lawyers actually sell, with a human always sending the messages. WhatsApp CRM extensions (WaSpeed, WaLeads) prove the injected-panel delivery mechanism but do zero coaching; enterprise conversation intelligence (Gong, Cresta) proves the scoring/dashboard model but doesn't touch WhatsApp; Brazilian legal-tech is bot-first and does neither. The differentiator is the methodology-encoded AI brain (suggestions + 0-10 diagnostics calibrated against the owner's expert judgment) — everything else is table stakes borrowed from adjacent categories.

The recommended build is TypeScript everywhere: a WXT-built MV3 extension (thin sensor + panel UI), a Next.js 16 app serving both the manager dashboard and the API (Route Handlers proxying all Claude API calls), Supabase Postgres in sa-east-1 with organization-scoped RLS for multi-tenancy and LGPD data residency, and Stripe hosted Checkout/Portal with webhook-mirrored entitlements. The extension never holds the Anthropic key or the methodology prompt — it syncs transcripts continuously and sends only `{conversationId}` when the lawyer asks for a suggestion. Inactivity-triggered diagnostics run server-side (cron sweep over `last_activity_at`), never in the MV3 service worker, which Chrome kills after ~30s idle.

The two existential risks are: (1) the AI brain never converging with the owner's judgment — mitigate by validating prompts against exported real conversations with a golden set BEFORE heavy extension/dashboard investment; and (2) WhatsApp Web DOM fragility — mitigate with a single isolated extraction adapter, runtime self-tests, an explicit "extraction failed" state that blocks AI calls, and breakage telemetry. Secondary risks (cross-tenant leaks of privileged legal data, LGPD exposure over the *lead's* sensitive data, LLM cost blowout, Chrome Web Store rejection) all have well-understood preventions that must be designed in from the schema phase, not retrofitted.

## Key Findings

### Recommended Stack

Single-language TypeScript monorepo across three surfaces (extension, API+dashboard, shared packages). Full detail in STACK.md.

**Core technologies:**
- **WXT 0.20.x** — MV3 extension framework — the 2025/2026 consensus pick; Plasmo is stalled (avoid)
- **React 19 + Tailwind 4** — panel (Shadow DOM-scoped) and dashboard UI
- **Next.js 16 (App Router)** — dashboard + API in one deployable; Route Handlers stream LLM responses via SSE
- **Claude API (`@anthropic-ai/sdk` 0.110.0)** — `claude-opus-4-8` default for suggestions and diagnostics (calibrate on the strongest model first); `claude-sonnet-4-6` as the post-calibration cost lever. Use structured outputs (`output_config.format`) for the `{nota, acertos, erros, melhorias}` JSON — assistant prefill is rejected (400) on current models. Prompt caching on the byte-stable methodology prompt is the single biggest cost lever.
- **Supabase (Postgres, sa-east-1)** — Auth + RLS multi-tenancy keyed on `organization_id`; São Paulo region + encryption at rest serve LGPD directly
- **Stripe 22.x** — hosted Checkout + Customer Portal + webhooks; BRL cards + Pix Automático; no Boleto (one-time only)
- **Zod 4, TanStack Query 5, Recharts 3, shadcn/ui** — supporting libraries

**Do not use:** Plasmo, whatsapp-web.js/Baileys (ban-pattern automation), LangChain, NextAuth, API keys in the extension bundle.

### Expected Features

Full detail in FEATURES.md.

**Must have (table stakes / v1):**
- Injected side panel over WhatsApp Web with pt-BR login and persistent session
- Resilient DOM transcript reading (text; media as "[áudio]"/"[imagem]" placeholders) + graceful "extension broken" state with kill switch
- "Sugerir resposta" on-demand with methodology-grounded output + copy-to-clipboard (<10s, streaming)
- Auto diagnostic on inactivity (0-10 + acertos/erros/melhorias) with manual trigger fallback
- Outcome marking (fechado/perdido, editable later) → conversion rate analytics
- Manager dashboard: per-lawyer scorecards, evolution/comparison, conversation list with filters, transcript + diagnostic drill-down, conversion rate
- Stripe per-seat subscription + Portal + webhook entitlements (comped for beta)
- LGPD baseline shipped WITH transcript storage: encryption, retention, deletion cascade, terms
- Calibration workflow: owner grades sample conversations vs AI scores until convergence

**Should have (differentiators):**
- Methodology-encoded suggestions (the product IP — not generic ChatGPT)
- Automatic every-conversation scoring (no Brazilian WhatsApp tool does this)
- Read-only human-sends-everything posture, marketed as WhatsApp-ban-safe and OAB-safe (Provimento 205/2021: no result promises in AI output — a rubric requirement)

**Defer (v1.x/v2+):** audio transcription (highest-value v1.x — voice notes are endemic), lawyer self-view, feedback buttons, per-office playbooks, real-time suggestions, CRM features (anti-feature — coexist with WaLeads instead).

### Architecture Approach

Four-part structure: MV3 extension (thin sensor + UI), backend API owning all secrets and business logic, manager dashboard, shared multi-tenant Postgres. Extension continuously syncs transcripts (idempotent upserts keyed on `wa_message_id`); the server copy is canonical. All LLM calls proxy through the backend, which assembles prompts from stored transcripts + the server-side versioned methodology prompt (`prompt_version` logged on every analysis for calibration). Inactivity detection is a server-side cron sweep. Stripe state is webhook-mirrored to a local `subscriptions` table gating every AI endpoint. Monorepo with `packages/shared` Zod schemas crossing all boundaries.

**Major components:**
1. **Extension** — content script(s) reading WhatsApp Web + side panel UI + service worker owning tokens and all fetches (no state in worker globals, `chrome.alarms` not `setTimeout`)
2. **Backend API modules** — auth, transcript ingest, LLM proxy (methodology prompt lives here), inactivity engine, billing/entitlements, orgs, compliance (retention/deletion/audit)
3. **Postgres** — orgs → users (manager|lawyer) → conversations → messages (encrypted body) → analyses (score, feedback JSON, prompt_version, token_usage); RLS on every table
4. **Manager dashboard** — role-gated reads over the same API

**Open architectural decision (flagged):** STACK.md and PITFALLS.md recommend DOM-only reading via an injected Shadow-DOM panel (lowest ToS/ban surface, matches competitor UX); ARCHITECTURE.md proposes a wa-js MAIN-world bridge (more stable data) + `chrome.sidePanel`. Recommendation: **injected Shadow-DOM panel + DOM-only extraction adapter** for v1 — PITFALLS.md explicitly warns that hooking WhatsApp's internal modules deepens ToS violation and Meta detection surface, and the read-only posture is a marketed differentiator. Keep wa-js as a documented fallback if DOM reading proves untenable. Resolve during extension architecture phase planning.

### Critical Pitfalls

Top 5 of 10 (full detail in PITFALLS.md):

1. **Building the platform before validating the AI brain (P10)** — validate prompts against exported real conversations in a script harness with an owner-graded golden set as an explicit early milestone gate; no extension required
2. **Uncalibrated 0-10 scoring (P5)** — decompose the methodology into anchored rubric criteria, score per-criterion, aggregate in code; measure judge-vs-expert agreement before any score reaches a gestor dashboard; re-run evals on every prompt/model change
3. **WhatsApp DOM breakage with no resilience (P1)** — single extraction adapter module, runtime self-test, explicit failure state that blocks AI calls, breakage telemetry
4. **LGPD exposure over the lead's sensitive data (P6)** — the data subject is the lead, not the customer; encryption/retention/deletion-cascade/audit-log designed into the schema phase; DPA + training-exclusion tier with Anthropic; never log transcript content
5. **MV3 service worker state loss killing the flagship diagnostic (P7)** — inactivity detection server-side only; test with the worker force-killed

Also critical: cross-tenant leak prevention (RLS + CI two-org tests before dashboard ships), LLM cost (caching + rolling summary window + per-tenant metering from day one), Chrome Web Store compliance (no "WhatsApp" in name, minimal permissions, no remote code), and read-only discipline (no composer injection, ever).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: AI Brain Validation Spike
**Rationale:** Existential risk first. If the methodology-as-prompts doesn't converge with the owner's judgment, everything else is inventory (PITFALLS P10, P5). Requires no extension — the agency already has transcripts from manual audits.
**Delivers:** Versioned methodology prompts (suggestion + diagnostic rubric), structured-output schemas, golden set of 20-50 owner-graded conversations, measured judge-vs-expert agreement, eval harness for regression on prompt changes.
**Addresses:** Methodology brain + calibration loop (FEATURES P1).
**Avoids:** P10 (platform before engine), P5 (uncalibrated scores), P4 (context/caching strategy designed here).

### Phase 2: Backend Foundation + Multi-Tenant Schema + Auth
**Rationale:** Everything depends on tenant-scoped identity; encryption and deletion-cascade decisions must be made in the schema, not bolted on (ARCHITECTURE anti-pattern 6, PITFALLS P6/P8).
**Delivers:** Supabase project (sa-east-1), orgs/users/conversations/messages/analyses schema with RLS, email/password auth, CI cross-tenant test suite, encrypted message bodies, audit log skeleton.
**Uses:** Supabase, Next.js Route Handlers, Zod, Drizzle (optional).
**Implements:** Multi-tenancy pattern (ARCHITECTURE Pattern 4).

### Phase 3: Extension Shell + WhatsApp Reading + Transcript Sync
**Rationale:** Highest remaining technical risk — validate the extension↔backend seam and DOM extraction early. Nothing AI-facing works without reliable transcript sync (ARCHITECTURE Flow 1).
**Delivers:** WXT MV3 extension, injected Shadow-DOM panel with login, single extraction adapter with self-test + failure state, debounced idempotent message upload, breakage telemetry, Web Store-compliant manifest (naming, minimal permissions).
**Avoids:** P1 (DOM fragility), P2 (read-only rule encoded in review checklist), P3 (store compliance), P7 (no worker state).

### Phase 4: "Sugerir Resposta" (On-Demand Suggestion)
**Rationale:** First end-to-end moment of core value, testable with the owner; builds on validated prompts (Phase 1) and reliable sync (Phase 3).
**Delivers:** Server-side LLM proxy with entitlement gate + rate limit + per-tenant token metering + prompt caching, streaming panel UX with copy-to-clipboard, usage logging.
**Avoids:** P4 (cost blowout — metering and caching land here, not later).

### Phase 5: Inactivity Diagnostic + Outcome Marking
**Rationale:** Completes the per-conversation loop and starts producing real calibration data. Server-side by necessity (P7).
**Delivers:** Cron sweep over `last_activity_at`, idempotent diagnostic job (re-score only on new messages), 0-10 + acertos/erros/melhorias stored with prompt_version, manual trigger fallback, fechado/perdido marking, conversation reopen/supersede handling.

### Phase 6: Manager Dashboard
**Rationale:** Read-only over data that now exists. Gated on Phase 1 calibration acceptance and Phase 2 cross-tenant tests (PITFALLS: never surface unvalidated scores to gestores; never ship dashboard before tenant isolation is proven).
**Delivers:** Per-lawyer scorecards, evolution/comparison charts, conversation list with filters, transcript + diagnostic drill-down, conversion rate (with % unmarked exposed).

### Phase 7: Billing (Thin) + LGPD Hardening + Beta Launch Gate
**Rationale:** Beta cohort is hand-picked agency clients — thin billing suffices (single price, Checkout, one `subscription_active` flag, comped via coupons). LGPD engineering already in the schema; this phase completes the operational side and gates the beta.
**Delivers:** Stripe Checkout + Portal + signature-verified idempotent webhooks, status→behavior matrix, retention job, deletion-on-demand cascade (DB + backups policy + provider), terms/privacy policy covering AI processing + international transfer, DPA signed, Web Store pre-publication compliance checklist, onboarding tour.

### Phase Ordering Rationale

- **Risk-first:** the two make-or-break unknowns (AI convergence, WhatsApp reading) land in Phases 1 and 3, before any polish investment.
- **Dependency-driven:** transcript sync (3) gates suggestions (4); diagnostics (5) gate the dashboard (6); schema decisions (2) gate LGPD (7) — matching FEATURES.md's dependency graph and ARCHITECTURE.md's build order.
- **Pitfall-gated:** calibration acceptance gates the dashboard; cross-tenant CI tests gate the dashboard; compliance checklist gates beta launch.
- **Billing deliberately late:** entitlement architecture exists from Phase 2/4, but full self-serve billing before AI validation is the classic sequencing mistake (P9).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** LLM-as-judge calibration methodology, rubric design, eval harness patterns — an AI-SPEC design contract is a strong fit
- **Phase 3:** WhatsApp Web DOM structure specifics and the DOM-vs-wa-js decision — fragile, sparsely documented, changes frequently; needs hands-on spike during planning

Phases with standard patterns (skip research-phase):
- **Phase 2:** Supabase RLS multi-tenancy is thoroughly documented
- **Phase 6:** Standard dashboard CRUD/aggregation over existing data
- **Phase 7:** Stripe hosted Checkout + webhooks is the most-documented SaaS pattern in existence

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (LLM/API layer) / MEDIUM (frameworks) | Claude API details from curated official reference; versions verified on npm; framework picks from cross-checked comparisons |
| Features | MEDIUM | Cross-checked competitor primary pages + category analysis; no hands-on trials; the market-gap claim is well-triangulated |
| Architecture | MEDIUM | Patterns verified against official Chrome/Stripe docs and active OSS projects; one internal conflict (wa-js vs DOM-only) flagged |
| Pitfalls | MEDIUM | Cross-checked against official docs and multi-outlet security reporting (Oct 2025 extension crackdown is well-corroborated) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **DOM-only vs wa-js bridge:** research files disagree; recommendation is DOM-only for v1 (lowest ban/ToS surface), but resolve with a hands-on spike during Phase 3 planning — if DOM extraction proves too unreliable, revisit wa-js with eyes open about detection risk.
- **Willingness-to-pay:** Brazilian buyers anchor at R$80-180/mo; no market precedent for AI-copilot premium — test pricing in beta, don't over-engineer plan tiers.
- **Inactivity window tuning:** no researched consensus on the right threshold (6-24h suggested) — make it configurable, tune with beta data.
- **Anthropic DPA / zero-data-retention tier for sensitive legal data:** verify concrete availability and terms during Phase 7 planning; also confirm international-transfer language for LGPD Art. 33.
- **Voice notes coverage gap:** v1 diagnostics will honestly note "[áudio]" gaps; expect fast user pressure — keep the Whisper pipeline as a scoped v1.x design, not scope creep.

## Sources

### Primary (HIGH confidence)
- Anthropic claude-api reference (cached 2026-06) — model IDs (`claude-opus-4-8`, `claude-sonnet-4-6`), pricing, structured outputs, prompt caching, adaptive thinking, Batches API
- npm registry (2026-07-04) — all package versions verified live
- Official docs: Chrome for Developers (MV3 service workers, sidePanel, Web Store policies), Stripe (subscriptions, webhooks, Pix/Boleto), Supabase (RLS)

### Secondary (MEDIUM confidence)
- Extension framework comparisons (WXT vs Plasmo vs CRXJS, multiple independent sources)
- Competitor primary pages: WaSpeed, WaLeads, WAPlus, JusLead, SabioAdv, ChatADV, LexAI; Gong/Attention/Cresta product pages
- OAB Provimento 205/2021 text + analyses; LGPD guidance (OAB Campinas guide, ConJur, Migalhas)
- Socket/Malwarebytes/Forbes reporting on the Oct 2025 WhatsApp-extension crackdown (131 extensions removed)
- Multi-tenant RLS patterns (AWS, Nile, OWASP); LLM-as-judge calibration (LangChain, Galileo, GoDaddy)

### Tertiary (LOW confidence)
- Legal intake conversion benchmarks (14% avg, 40-50% top firms) — secondary vendor sources; treat as directional
- Token-budget and ZDR-gateway practitioner posts — validate during implementation

---
*Research completed: 2026-07-04*
*Ready for roadmap: yes*
