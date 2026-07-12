-- Extension sync: dedup natural key on messages, stable conversation identity,
-- conversations UPDATE policy, kill-switch (app_settings) and reader health (reader_status).

-- 1. Natural WhatsApp key + metadata on messages (EXT-04).
alter table public.messages
  add column wa_message_id text,
  add column from_me boolean not null default false,
  add column kind text not null default 'text'
    constraint messages_kind_check check (kind in ('text', 'audio', 'image', 'document', 'other'));

-- 2. Dedup unique indexes — deliberately NOT partial (documented deviation from
-- RESEARCH Pattern 5): the PostgREST upsert emits ON CONFLICT (cols) without a
-- WHERE predicate, and Postgres cannot infer a PARTIAL unique index without it —
-- the upsert would fail. Default unique indexes are NULLS DISTINCT, so legacy or
-- future rows with null wa_message_id/wa_chat_id remain allowed.
create unique index messages_conversation_wa_id_key
  on public.messages (conversation_id, wa_message_id);

create unique index conversations_profile_wa_chat_key
  on public.conversations (profile_id, wa_chat_id);

-- 3. Fase 1 only created SELECT/INSERT on conversations; the conversations upsert
-- (D-01) needs UPDATE on conflict (contact_name/updated_at).
create policy "members update own conversations"
on public.conversations
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id())
)
with check (
  profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id())
);

-- 4. Kill-switch global (D-15). jsonb value is extensible to per-org granularity
-- later without a new migration.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "authenticated read settings"
on public.app_settings
for select
to authenticated
using (true);

create policy "super admins manage settings"
on public.app_settings
for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

insert into public.app_settings (key, value)
values ('reader_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- 5. Reader health heartbeat (D-14). details carries only metadata (failed
-- selector, counts) — NEVER message content (T-02-06).
create table public.reader_status (
  profile_id uuid primary key references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('ok', 'drift', 'broken')),
  extension_version text,
  details jsonb,
  last_seen_at timestamptz not null default now()
);

create index reader_status_organization_id_idx on public.reader_status (organization_id);

alter table public.reader_status enable row level security;

create policy "members read own reader status"
on public.reader_status
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.is_super_admin())
);

create policy "members insert own reader status"
on public.reader_status
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id())
);

create policy "members update own reader status"
on public.reader_status
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id())
)
with check (
  profile_id = (select auth.uid())
  and organization_id = (select private.current_org_id())
);

-- 6. Grants following the Fase 1 per-table grant pattern. RLS restricts
-- app_settings writes to super-admin; the grant only opens the table level.
grant select on table
  public.app_settings,
  public.reader_status
to authenticated;

grant insert, update on table
  public.app_settings,
  public.reader_status
to authenticated;

-- Fase 1 granted only select/insert on conversations; without the table-level
-- UPDATE privilege the new UPDATE policy is inert and the upsert fails with 42501.
grant update on table public.conversations to authenticated;
