# Phase 2: Extensão Chrome e Leitura do WhatsApp - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 20 new/modified files
**Analogs found:** 12 / 20 (extension reader/observer modules are greenfield — no analog exists)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/extension/wxt.config.ts` | config | — | `apps/web` package layout (monorepo conventions) | partial |
| `apps/extension/entrypoints/whatsapp.content/index.tsx` | entrypoint (content script) | event-driven | — (RESEARCH Pattern 1 code example) | none |
| `apps/extension/entrypoints/whatsapp.content/panel/LoginForm.tsx` | component | request-response | `apps/web/app/(auth)/login/login-form.tsx` | exact |
| `apps/extension/entrypoints/whatsapp.content/panel/*` (estados, avisos, teaser) | component | request-response | `apps/web/app/admin/create-org-form.tsx` (client form/state) + 02-UI-SPEC contract | role-match |
| `apps/extension/entrypoints/whatsapp.content/sync/supabase.ts` | service (client factory) | request-response | `apps/web/lib/supabase/client.ts` | role-match |
| `apps/extension/entrypoints/whatsapp.content/sync/queue.ts` | service | batch | — (RESEARCH Code Examples "flush de lote") | none |
| `apps/extension/entrypoints/whatsapp.content/sync/flags.ts` | service | request-response (poll) | supabase-js select pattern in `apps/web/app/admin/page.tsx` lines 29-37 | partial |
| `apps/extension/entrypoints/whatsapp.content/reader/selectors.ts` | utility | — | — (greenfield, RESEARCH Pattern 4) | none |
| `apps/extension/entrypoints/whatsapp.content/reader/extract.ts` | utility (pure fn) | transform | — (RESEARCH Code Examples `extractMessageRow`) | none |
| `apps/extension/entrypoints/whatsapp.content/reader/observers.ts` | utility | event-driven | — (RESEARCH Pattern 3) | none |
| `apps/extension/entrypoints/whatsapp.content/reader/canary.ts` | utility | event-driven | — (RESEARCH Pattern 6) | none |
| `apps/extension/entrypoints/background.ts` | entrypoint | — | — (minimal stub, WXT requirement) | none |
| `apps/extension/tests/extract.test.ts` | test | — | `apps/web/tests/members-admin.test.ts` | role-match |
| `supabase/migrations/2026XXXX_extension_sync.sql` | migration | — | `supabase/migrations/20260710012345_initial_schema.sql` | exact |
| `packages/shared/src/index.ts` (modify: MessageDTO, status enums, Zod schemas) | shared types | — | `packages/shared/src/index.ts` | exact |
| `packages/shared/src/database.types.ts` (regen) | shared types | — | same file (regenerated via Supabase CLI) | exact |
| `apps/web/app/admin/page.tsx` (modify: health indicator D-14) | page (RSC) | request-response | same file | exact |
| `apps/web/app/admin/kill-switch-toggle.tsx` (new client component) | component | request-response | `apps/web/app/admin/create-org-form.tsx` | exact |
| `apps/web/app/api/admin/settings/route.ts` (kill-switch write, if API route used) | route handler | request-response | `apps/web/app/api/admin/organizations/route.ts` | exact |
| `apps/extension/entrypoints/whatsapp.content/style.css` | config (Tailwind entry) | — | — (WXT `cssInjectionMode: 'ui'` per RESEARCH Pattern 1) | none |

## Pattern Assignments

### `panel/LoginForm.tsx` (component, request-response)

**Analog:** `apps/web/app/(auth)/login/login-form.tsx` — copy this nearly verbatim, adapting navigation and client import.

**Core pattern** (lines 9-35): controlled `email`/`password` state, `isLoading`, `error: string | null`; on submit call `supabase.auth.signInWithPassword({ email, password })`; on error set pt-BR message `"E-mail ou senha inválidos."` and stop loading. Adaptations for the extension: no `next/navigation` router (set panel state to `authenticated` instead of `router.push`); "Esqueci minha senha" opens the Fase 1 web flow in a new tab (`chrome.tabs.create` / `window.open`) instead of `<Link href="/recuperar-senha">` (line 76).

**Styling pattern** (lines 38-79): Tailwind form vocabulary already established in the project — labels `flex flex-col gap-2 text-sm font-medium text-zinc-800`, inputs `h-11 rounded border border-zinc-300 bg-white px-3 ... focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100`, submit button `bg-emerald-700 hover:bg-emerald-800 disabled:bg-zinc-400`, error `text-sm font-medium text-red-700`, loading label swap (`"Entrando..." / "Entrar"`). Reuse this palette in the panel (subject to 02-UI-SPEC overrides), inside the Shadow DOM.

---

### `sync/supabase.ts` (service, client factory)

**Analog:** `apps/web/lib/supabase/client.ts` — same shape, different transport.

**Pattern to copy** (lines 1-12): a single exported `createClient()` factory typed with `Database` from `@copiloto/shared`, env values resolved via a dedicated helper (analog: `apps/web/lib/supabase/env.ts` pattern of validating env in one place):
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@copiloto/shared";
import { getSupabaseBrowserEnv } from "./env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
```
Extension version replaces `createBrowserClient` with `createClient` from `@supabase/supabase-js` + the `chrome.storage.local` adapter (RESEARCH Pattern 2 code), keeping: `Database` generic from `@copiloto/shared`, single-module client, env indirection (`import.meta.env.WXT_SUPABASE_URL` etc.).

---

### `supabase/migrations/2026XXXX_extension_sync.sql` (migration)

**Analog:** `supabase/migrations/20260710012345_initial_schema.sql` — follow its conventions exactly.

**Conventions to copy:**
- Table shape (lines 37-55): `id uuid primary key default extensions.gen_random_uuid()`, `organization_id uuid not null references public.organizations(id) on delete cascade`, `created_at timestamptz not null default now()`. The existing `conversations` (lines 37-45) and `messages` (lines 47-55) tables are the ones this phase ALTERs (add `wa_message_id`, `from_me`, `kind`; unique indexes per RESEARCH Pattern 5).
- Enum style (lines 3-5): `create type public.x as enum (...)` — use for `reader_status.status` if enum preferred over `check`; otherwise `check (status in (...))` matches `diagnostics.score` check style (line 61).
- Index naming (lines 75-85): `{table}_{cols}_idx` / unique `..._key`; partial unique index precedent at lines 77-79 (`invitations_pending_email_org_idx ... where status = 'pending'`) — same shape as the planned `messages (conversation_id, wa_message_id) where wa_message_id is not null`.
- RLS policy shape (lines 142-234): quoted-sentence policy names in English (`"members insert messages into own conversations"`), always `to authenticated`, org check `organization_id = (select private.current_org_id())`, self check `profile_id = (select auth.uid())`, super-admin escape `or (select private.is_super_admin())`. The messages INSERT policy (lines 221-234) with its `exists (select 1 from public.conversations c ...)` subquery is the exact template for any new message-scoped policy.
- Security-definer helpers already exist: `private.current_org_id()` (lines 89-100), `private.is_super_admin()` (lines 102-116) — reference them, do not recreate.
- New tables `app_settings` and `reader_status`: follow the same `alter table ... enable row level security;` + policy blocks; `reader_status.profile_id uuid primary key references public.profiles(user_id)` mirrors `profiles.user_id` FK style (line 14).

**Note for planner:** Fase 1 only created SELECT/INSERT policies on `conversations` (lines 176-198) — the UPDATE policy from RESEARCH Pattern 5 is genuinely missing and must be added.

---

### `packages/shared/src/index.ts` (shared types — modify)

**Analog:** same file (8 lines). Pattern: literal string-union types mirroring DB enums plus re-export of `Database`:
```typescript
export type UserRole = "super_admin" | "gestor" | "advogado";
export type ProfileStatus = "active" | "removed";
export type { Database, Json } from "./database.types";
```
Add in the same style: `export type MessageKind = "text" | "audio" | "image" | "document" | "other";`, `export type ReaderStatus = "ok" | "drift" | "broken";`, `MessageDTO` interface, Zod schemas for sync payloads. Regenerate `database.types.ts` after the migration (Supabase CLI, as Fase 1 did).

---

### `apps/web/app/admin/page.tsx` (modify — health indicator D-14 + kill-switch section)

**Analog:** same file.

**Guard pattern** (lines 7-26) — keep intact when extending: `createClient` from `../../lib/supabase/server`, `supabase.auth.getUser()` → `redirect("/login")`, then double-check `profiles.role === "super_admin" && status === "active"` → `redirect("/")`.

**Data-fetch pattern** (lines 29-37): parallel `Promise.all` of RLS-backed selects on the server client (super-admin RLS grants full read). Add `supabase.from("app_settings").select(...)` and `supabase.from("reader_status").select(...)` to this same `Promise.all`.

**Table markup pattern** (lines 93-130): `overflow-hidden rounded border border-zinc-200 bg-white` wrapper, `thead bg-zinc-100 text-zinc-600`, empty-state row with `colSpan`, `toLocaleDateString("pt-BR")` for dates (line 123) — reuse for the reader-health table (`last_seen_at` via `toLocaleString("pt-BR")`).

---

### `apps/web/app/admin/kill-switch-toggle.tsx` (new client component)

**Analog:** `apps/web/app/admin/create-org-form.tsx` — the established client-mutation pattern.

**Pattern to copy** (lines 1-38): `"use client"`, local `message`/`error`/`isLoading` state, `fetch("/api/admin/...", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(...) })`, on failure `setError(payload.error ?? "fallback pt-BR")`, on success `router.refresh()` (lines 20-38). Button styling per lines 71-77.

---

### `apps/web/app/api/admin/settings/route.ts` (kill-switch write)

**Analog:** `apps/web/app/api/admin/organizations/route.ts` — exact template for a super-admin route handler.

**Imports + validation pattern** (lines 1-13): `NextResponse`, `zod` schema at module top, `z.object(...).safeParse(await request.json().catch(() => null))` then `jsonError("...", 400)` (lines 32-38).

**Auth guard pattern** (lines 15-29): reuse `requireSuperAdmin` shape — `getActorContext(request, { forbiddenMessage })` from `apps/web/app/api/invitations/_helpers.ts`, then `context.actor.profile.role !== "super_admin"` → `jsonError(..., 403)`.

**Audit pattern** (lines 75-86): `logAudit({ action: "...", actorUserId, details, organizationId })` from `apps/web/lib/audit.ts` after every mutation — the kill-switch toggle MUST log (e.g., `action: "reader.kill_switch.toggled"`).

**Response pattern** (lines 88-95, 128): `NextResponse.json({ ... }, { status: 201 })` on create, plain `NextResponse.json({...})` on read.

Note: since super-admin RLS already allows writing `app_settings`, an alternative is writing via the server client directly in a server action — but if a route handler is chosen, this file is the template.

---

### `apps/extension/tests/extract.test.ts` (test)

**Analog:** `apps/web/tests/members-admin.test.ts` — vitest conventions.

**Pattern to copy** (lines 1-48): `import { describe, expect, it } from "vitest"`, typed helpers at file top, env-gated integration checks (`hasHostedSupabaseSecrets` flag at lines 8-11 — reuse this gating idea for any test needing live Supabase). For the reader tests specifically, the analog only provides structure; content is new: load HTML fixtures from `tests/fixtures/` into happy-dom and assert `extractMessageRow` output (RESEARCH Code Examples).

The anon/token client helpers (lines 19-36: `createClient` with `{ auth: { autoRefreshToken: false, persistSession: false } }` and `global.headers.Authorization`) are the exact template for RLS tests of the new `app_settings`/`reader_status` policies.

---

### Greenfield extension modules (no analog)

`entrypoints/whatsapp.content/index.tsx`, `reader/*`, `sync/queue.ts`, `sync/flags.ts`, `background.ts`, `wxt.config.ts`, `style.css` — no existing extension code in the repo. Planner should use the concrete code in 02-RESEARCH.md directly:
- Content script + `createShadowRootUi`: RESEARCH Pattern 1 (lines 237-262 of RESEARCH)
- Storage adapter client: RESEARCH Pattern 2
- Observers/debounce: RESEARCH Pattern 3
- Extraction: RESEARCH "Code Examples" `extractMessageRow`
- Idempotent flush: RESEARCH "Code Examples" `flush`
- Canary/kill-switch: RESEARCH Patterns 6-7

## Shared Patterns

### Supabase typed client via `@copiloto/shared`
**Source:** `apps/web/lib/supabase/client.ts` line 4 (`import type { Database } from "@copiloto/shared"`)
**Apply to:** every new Supabase client (extension `sync/supabase.ts`, tests). Never create an untyped client; the shared `Database` type is the schema contract.

### Env indirection module
**Source:** `apps/web/lib/supabase/env.ts` (referenced by `client.ts` line 6)
**Apply to:** extension config — one module validates/exports `WXT_SUPABASE_URL`/`WXT_SUPABASE_ANON_KEY`; no inline `import.meta.env` reads scattered around.

### pt-BR user-facing copy, English identifiers
**Source:** throughout Fase 1 (`login-form.tsx` line 28, `admin/page.tsx` lines 86-88, route errors "Apenas super-admin pode gerenciar organizações.")
**Apply to:** all panel states, banners D-11/D-13, admin toggle. Tone: professional, direct, "você", no emojis. Code, table names, policy names stay in English.

### RLS-first authorization
**Source:** `supabase/migrations/20260710012345_initial_schema.sql` lines 142-261 + `private.*` helpers
**Apply to:** all new tables. The extension writes under the advogado session (RLS), never service_role; the client never filters by org — the DB does.

### Audit logging on admin mutations
**Source:** `apps/web/lib/audit.ts` via `api/admin/organizations/route.ts` lines 75-86
**Apply to:** kill-switch toggle and any other super-admin write.

### Tailwind visual vocabulary (zinc + emerald)
**Source:** `login-form.tsx`, `create-org-form.tsx`, `admin/page.tsx`
**Apply to:** admin additions must match exactly; extension panel follows 02-UI-SPEC.md, which takes precedence over these classes inside the Shadow DOM.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `entrypoints/whatsapp.content/index.tsx` | content-script entrypoint | event-driven | First extension in repo; use RESEARCH Pattern 1 |
| `reader/selectors.ts`, `extract.ts`, `observers.ts`, `canary.ts` | utility | event-driven/transform | Genuinely new domain (DOM reading); RESEARCH Patterns 3-4-6 + spike fixtures |
| `sync/queue.ts` | service | batch | No batching code exists; RESEARCH flush example |
| `sync/flags.ts` | service | poll | No polling code exists; RESEARCH Pattern 7 |
| `wxt.config.ts`, `background.ts`, `style.css` | config | — | WXT scaffolding; RESEARCH Pattern 8 manifest minimalism |

## Metadata

**Analog search scope:** `apps/web/app`, `apps/web/lib`, `apps/web/tests`, `packages/shared/src`, `supabase/migrations`
**Files scanned:** 47 source files listed; 7 read in depth
**Pattern extraction date:** 2026-07-11
