# Stack Research

**Domain:** Chrome MV3 extension (WhatsApp Web copilot) + LLM analysis backend + multi-tenant SaaS dashboard (pt-BR, LGPD, Stripe)
**Researched:** 2026-07-04
**Confidence:** HIGH (LLM/API layer, versions) / MEDIUM (framework choices, cross-checked web sources)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | 5.x | Single language across extension, backend, dashboard | One language for all three surfaces; the whole recommended ecosystem (WXT, Next.js, Anthropic SDK, Stripe SDK, Supabase) is TypeScript-first. Confidence: HIGH |
| **WXT** | 0.20.27 | Chrome MV3 extension framework (build tooling, HMR, manifest generation) | The 2025/2026 consensus pick: actively maintained, Vite-based, framework-agnostic, auto-generates MV3 manifest, cross-browser output. Plasmo (the 2023 favorite) has stalled maintenance on a dead bundler dependency. Confidence: MEDIUM (multiple independent comparisons agree) |
| **React** | 19.2.x | UI for the injected side panel and the dashboard | Shared component knowledge/skills between extension panel and dashboard; first-class in WXT and Next.js. Confidence: HIGH |
| **Next.js (App Router)** | 16.2.x | Web dashboard + backend API (Route Handlers) in one deployable | Standard 2025/2026 SaaS pattern: Route Handlers serve both the dashboard and the extension (plain HTTPS API), stream LLM responses via SSE, and keep one codebase for a solo/small team. A separate Fastify/NestJS service is not justified at this scale. Note: current major is **16**, not 15. Confidence: MEDIUM |
| **Claude API (`@anthropic-ai/sdk`)** | 0.110.0 | Reply suggestions + 0-10 conversation diagnostics in pt-BR | Verified against current Anthropic reference (2026-06). See "LLM layer" below for model IDs and pricing. Confidence: HIGH (curated official reference) |
| **Supabase (Postgres 15+)** | supabase-js 2.110.0 / @supabase/ssr 0.12.0 | Database, auth, and multi-tenant row isolation | Postgres with first-class Row Level Security keyed on `organization_id` — the standard multi-tenant SaaS pattern, enforced at the DB, not the app layer. Has **sa-east-1 (São Paulo)** region and AES-256 encryption at rest — both directly relevant to LGPD (data residency + criptografia em repouso). Confidence: MEDIUM |
| **Supabase Auth** | (bundled) | Email/password login shared by extension and dashboard | Deepest fit once on Supabase: `auth.uid()` drives RLS so tenant isolation is database-enforced on every query; cheapest per-MAU pricing ($0.00325/MAU after 50K free); email/password works from the extension via `supabase-js` with a `chrome.storage.local` storage adapter. Confidence: MEDIUM |
| **Stripe (`stripe` Node SDK)** | 22.3.0 | Subscription billing (BRL) | Required by project constraints. Stripe Checkout (hosted) + Customer Portal + webhooks is the lowest-maintenance subscription integration. Supports BRL cards; **Pix Automático** (2025 Central Bank rollout) now enables recurring Pix subscriptions through Checkout. Confidence: MEDIUM-HIGH (official Stripe docs among sources) |

### LLM Layer — Models and Pricing (verified 2026-06 reference)

| Model | Model ID | Context | Input $/1M | Output $/1M | Role in this product |
|-------|----------|---------|-----------|-------------|----------------------|
| Claude Opus 4.8 | `claude-opus-4-8` | 1M | $5.00 | $25.00 | **Default for both reply suggestions and diagnostics.** Quality of suggestions/diagnostics is the core value of this product ("if the owner doesn't agree with them, nothing else matters") — calibrate on the strongest model first. |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 1M | $3.00 | $15.00 | Cost lever for high-volume production **after** calibration proves it matches the owner's judgment. Anthropic's own guidance positions Sonnet for high-volume production workloads. |
| Claude Haiku 4.5 | `claude-haiku-4-5` | 200K | $1.00 | $5.00 | Auxiliary/simple tasks only (e.g., cheap classification). Not for the core suggestion/diagnostic path. |

**Use the exact IDs above — no date suffixes** (e.g. `claude-opus-4-8`, never `claude-opus-4-8-20xxxxxx`).

Key API features to design around (all verified current):

- **Structured outputs** (`output_config.format` with a JSON schema, or `client.messages.parse()`): guarantees the diagnostic returns valid `{nota: 0-10, acertos: [], erros: [], melhorias: []}` JSON. The old `output_format` param is deprecated; assistant-prefill tricks are **rejected (400)** on current models — structured outputs is the replacement.
- **Prompt caching** (`cache_control: {type: "ephemeral"}`): the fixed agency methodology ("cérebro da IA") is a large, stable system prompt shared by every request — cache it. Reads cost ~0.1x input price; this is the single biggest cost lever for this product. Keep the methodology prompt byte-stable (no timestamps interpolated into it).
- **Adaptive thinking** (`thinking: {type: "adaptive"}`): the current thinking mode on Opus 4.8/Sonnet 4.6. Do **not** use `budget_tokens` (removed/deprecated). Control depth with `output_config: {effort: "low"|"medium"|"high"}` — start `medium` for suggestions (latency-sensitive button click), `high` for diagnostics (async, quality-sensitive).
- **Message Batches API** (50% price cut, results within ~1h): diagnostics fire on conversation inactivity and are not latency-sensitive — batching them is an optional cost optimization for later, not v1.
- **pt-BR:** fully supported; prompt and output language are controlled entirely by your prompts. No special configuration.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.3.x | Styling for panel + dashboard | Everywhere; v4 has zero-config Vite/Next integration. In the injected panel, scope styles inside Shadow DOM to avoid colliding with WhatsApp Web CSS |
| shadcn/ui | latest (CLI) | Dashboard component library | Dashboard tables, cards, dialogs; copy-in components, no runtime dep |
| Recharts | 3.9.x | Dashboard charts (score evolution, conversion rate) | Manager analytics views |
| TanStack Query | 5.101.x | Data fetching/caching in extension panel and dashboard | All client-side API calls; handles auth-token refresh retries cleanly |
| Zod | 4.4.x | Runtime validation of API payloads, webhook bodies, LLM JSON | Every Route Handler input; second line of defense on LLM structured output |
| Drizzle ORM | 0.45.x | Typed SQL over Supabase Postgres from Route Handlers | Optional: use for server-side queries where you bypass RLS with the service role; plain `supabase-js` is enough for v1 |
| `stripe` (Node) | 22.3.0 | Checkout sessions, webhook verification, Customer Portal | All billing code, server-side only |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| WXT dev server | Extension HMR against a real Chrome profile | `wxt dev` auto-reloads content scripts; test against live WhatsApp Web |
| Stripe CLI | Local webhook forwarding | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Supabase CLI | Local Postgres + migrations + RLS policy testing | Migrations checked into repo; test RLS with `anon` vs `service_role` keys |
| Vercel | Hosting for Next.js app | Zero-config; note Route Handler timeout limits for long LLM calls — stream responses to stay within limits |
| Vitest + Playwright | Unit tests + extension E2E | WXT has documented Playwright patterns for loading unpacked extensions |

## Architecture Notes That Constrain the Stack

1. **Injected sidebar, not `chrome.sidePanel`.** The competitors (WaSpeed/WaLeads-style) render *inside* the WhatsApp Web page layout. Chrome's native Side Panel API (Chrome 114+) lives outside the page and cannot sit flush with the chat UI, and the content script must read the conversation DOM anyway. Standard pattern: MV3 service worker + content script that mounts a React app inside a **Shadow DOM** container appended to WhatsApp Web's layout (style isolation both directions), plus a separate DOM-reader module with defensive selectors (WhatsApp updates break selectors — isolate them in one file). Confidence: MEDIUM.
2. **The extension never holds the Anthropic API key.** All LLM calls go extension → your Next.js API (authenticated with the Supabase session JWT) → Claude API. This is mandatory: keys shipped in an extension bundle are public, and the server hop is also where you enforce plan limits, log transcripts, and apply the fixed methodology prompt.
3. **Multi-tenancy = `organization_id` column + RLS.** One schema, row-level isolation; policies keyed on the JWT's org claim. Managers see all lawyers in their org; lawyers see their own conversations. This is enforced in Postgres, not in every endpoint.
4. **LGPD:** host in `sa-east-1` (São Paulo), encryption at rest is included at the infra level; add an application-level retention job (scheduled deletion per the retention policy) and a "delete on demand" endpoint. Note: sending conversation content to Anthropic (US processor) must be covered in the terms of use / DPA — flag for the compliance phase.

## Installation

```bash
# Extension (separate package in a monorepo, e.g. apps/extension)
npx wxt@latest init extension    # choose React + TypeScript
npm i @supabase/supabase-js @tanstack/react-query zod
npm i -D tailwindcss

# Dashboard + API (apps/web)
npx create-next-app@latest web   # App Router, TypeScript, Tailwind
npm i @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr stripe zod @tanstack/react-query recharts
npx shadcn@latest init

# Dev dependencies
npm i -D vitest playwright supabase
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT | CRXJS (Vite plugin) | If you want a minimal Vite plugin instead of a framework and accept hand-writing the manifest; recently revived, best-in-class content-script HMR |
| Injected Shadow-DOM sidebar | `chrome.sidePanel` API | If a detached browser-level panel is acceptable UX (it isn't for the WaSpeed-style flush panel this product copies) |
| Next.js Route Handlers | Separate Fastify/NestJS API | When a second team owns the API, or you add non-HTTP workloads (queues, websockets at scale). Revisit post-beta |
| Supabase | Neon + self-managed auth/storage | If you want pure Postgres and already have an auth answer; you lose the integrated Auth→RLS story and must assemble LGPD pieces yourself |
| Supabase Auth | Better Auth | If you later leave Supabase: Better Auth is the strongest TypeScript-native library with built-in organizations/RBAC plugins, users in your own Postgres |
| Supabase Auth | Clerk | If sign-up conversion UX matters more than cost ($0.02/MAU after 10K) and you accept user data living in Clerk's DB — weaker fit with RLS |
| `claude-opus-4-8` | `claude-sonnet-4-6` | After calibration: if Sonnet's suggestions/diagnostics match the owner's judgment in blind comparison, switch the high-volume path and cut token cost ~40% |
| Stripe Checkout (hosted) | Stripe Elements (embedded) | Only if the hosted page's UX is unacceptable; hosted page handles Pix/card method display logic automatically |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Plasmo** | Maintenance has stalled; pinned to an inactive bundler (Parcel) that blocks modern tooling — risky base for a product needing continuous updates as WhatsApp changes | WXT |
| **whatsapp-web.js / Baileys (WhatsApp automation libs)** | Puppeteer/protocol-based automation — exactly the pattern WhatsApp bans accounts for; also wrong architecture (this product reads the DOM of the user's own open tab, read-only) | Content-script DOM reading |
| **Assistant prefill for forcing JSON** | Returns 400 on current Claude models | `output_config.format` (structured outputs) / `messages.parse()` |
| **`budget_tokens` thinking config** | Removed on Opus 4.7+/rejected with 400; deprecated on Sonnet 4.6 | `thinking: {type: "adaptive"}` + `output_config.effort` |
| **Boleto for subscriptions** | One-time payment method only; cannot power recurring billing | Cards (BRL) + Pix Automático via Stripe Checkout |
| **Anthropic API key in the extension** | Bundle is public; key theft is guaranteed; no way to enforce plan limits | Server-side proxy in Next.js Route Handlers |
| **LangChain / heavy LLM frameworks** | Two well-defined calls (suggest, diagnose) with a fixed prompt need no orchestration layer; adds churn and obscures prompt-caching control | Direct `@anthropic-ai/sdk` calls |
| **NextAuth / Auth.js** | Weakest organizations/multi-tenant story of the candidates; community-maintained pace | Supabase Auth (or Better Auth if off Supabase) |
| **MongoDB / DynamoDB** | Relational data (orgs → lawyers → conversations → scores) with per-tenant RLS is a Postgres problem | Supabase Postgres |

## Stack Patterns by Variant

**If diagnostics volume grows and cost bites:**
- Route inactivity-triggered diagnostics through the Message Batches API (50% off, ≤1h latency)
- Because diagnostics are async by design (inactivity trigger), users never see the latency

**If Vercel function limits constrain long LLM calls:**
- Always stream (`client.messages.stream`) from Route Handlers; if still constrained, move only the LLM proxy route to a small Fastify service or a Supabase Edge Function — keep everything else in Next.js

**If the extension must later support Edge/Firefox:**
- WXT already builds cross-browser from the same codebase; keep browser-specific code behind WXT's `browser` abstraction

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| wxt@0.20.x | react@19, tailwindcss@4 | WXT is framework-agnostic; React module `@wxt-dev/module-react` |
| next@16.2.x | react@19.2.x | Next 16 requires React 19 |
| @supabase/ssr@0.12 | next@16 App Router | Use `@supabase/ssr` for cookie-based sessions in the dashboard; plain `supabase-js` + `chrome.storage` adapter in the extension |
| stripe@22.x | Node 18+ | Pin the Stripe API version string in code; upgrade deliberately |
| zod@4.x | drizzle-orm@0.45, @anthropic-ai/sdk helpers | Zod 4 is current; check any lib still requiring zod@3 peer (declining) |
| @anthropic-ai/sdk@0.110.0 | Node 18+ | Use `client.messages.stream()` + `finalMessage()`; typed error classes |

## Sources

- Anthropic claude-api skill reference (cached 2026-06) — model IDs, pricing, structured outputs, prompt caching, adaptive thinking, Batches API — **HIGH confidence (curated/official)**
- npm registry (queried 2026-07-04) — all version numbers verified live — **HIGH confidence**
- [WXT vs Plasmo vs CRXJS 2026 comparisons](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/), [wxt.dev comparison](https://wxt.dev/guide/resources/compare), [dev.to comparison](https://dev.to/quangpl/plasmo-vs-crxjs-vs-wxt-which-chrome-extension-framework-should-you-use-in-2026-37o4) — framework recommendation — **MEDIUM (cross-checked)**
- [Chrome side panel + content script patterns](https://dev.to/jgrisafe/interacting-with-web-content-using-chromes-new-side-panel-extension-feature-4ock), [WhatsApp Web extension example architecture](https://github.com/bioenable/whatsapp-web-chrome-extension), [noCRM WhatsApp extension](https://www.nocrm.io/app-integrations/whatsapp-crm-integration/create-leads-from-whatsapp-nocrm-simple-sales) — injection pattern — **MEDIUM**
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security), [multi-tenant RLS patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — multi-tenancy — **MEDIUM**
- [Better Auth vs Clerk vs Supabase Auth](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk), [Supabase vs Clerk](https://www.devtoolsacademy.com/blog/supabase-vs-clerk) — auth choice — **MEDIUM**
- [Stripe Pix docs](https://docs.stripe.com/payments/pix), [Stripe Boleto docs](https://docs.stripe.com/payments/boleto), [Brazil payment methods](https://support.stripe.com/questions/accepted-payment-methods-in-brazil) — billing — **MEDIUM-HIGH (official docs)**
- [Next.js vs separate backend for AI apps](https://www.groovyweb.co/blog/expressjs-vs-nextjs-ai-apps-2026), [SSE LLM streaming in Next.js](https://upstash.com/blog/sse-streaming-llm-responses) — backend shape — **MEDIUM**

---
*Stack research for: AI copilot Chrome extension for WhatsApp Web — legal lead conversion SaaS (pt-BR)*
*Researched: 2026-07-04*
