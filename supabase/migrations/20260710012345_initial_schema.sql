create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('super_admin', 'gestor', 'advogado');
create type public.profile_status as enum ('active', 'removed');
create type public.invitation_status as enum ('pending', 'accepted', 'cancelled', 'expired');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'advogado',
  status public.profile_status not null default 'active',
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'advogado',
  token_hash text not null unique,
  expires_at timestamptz not null,
  status public.invitation_status not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invitations_email_lowercase check (email = lower(email)),
  constraint invitations_no_super_admin check (role <> 'super_admin')
);

create table public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(user_id),
  wa_chat_id text,
  contact_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender text not null,
  content text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.diagnostics (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  score smallint check (score between 0 and 10),
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  organization_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);
create index invitations_organization_id_idx on public.invitations (organization_id);
create unique index invitations_pending_email_org_idx
  on public.invitations (organization_id, lower(email))
  where status = 'pending';
create index conversations_organization_id_idx on public.conversations (organization_id);
create index conversations_profile_id_idx on public.conversations (profile_id);
create index messages_organization_id_idx on public.messages (organization_id);
create index messages_conversation_id_idx on public.messages (conversation_id);
create index diagnostics_organization_id_idx on public.diagnostics (organization_id);
create index audit_log_organization_id_idx on public.audit_log (organization_id);

create schema if not exists private;

create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.profiles
  where user_id = (select auth.uid())
    and status = 'active'
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'super_admin'
      and status = 'active'
  )
$$;

create or replace function private.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role in ('gestor', 'super_admin')
      and status = 'active'
  )
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.diagnostics enable row level security;
alter table public.audit_log enable row level security;

create policy "active members read own organization"
on public.organizations
for select
to authenticated
using (
  id = (select private.current_org_id())
  or (select private.is_super_admin())
);

create policy "members read permitted profiles"
on public.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    organization_id = (select private.current_org_id())
    and (select private.is_gestor())
  )
  or (select private.is_super_admin())
);

create policy "gestores read invitations"
on public.invitations
for select
to authenticated
using (
  (
    organization_id = (select private.current_org_id())
    and (select private.is_gestor())
  )
  or (select private.is_super_admin())
);

create policy "members read permitted conversations"
on public.conversations
for select
to authenticated
using (
  (
    organization_id = (select private.current_org_id())
    and (
      (select private.is_gestor())
      or profile_id = (select auth.uid())
    )
  )
  or (select private.is_super_admin())
);

create policy "members insert own conversations"
on public.conversations
for insert
to authenticated
with check (
  organization_id = (select private.current_org_id())
  and profile_id = (select auth.uid())
);

create policy "members read permitted messages"
on public.messages
for select
to authenticated
using (
  (
    organization_id = (select private.current_org_id())
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = messages.organization_id
        and (
          (select private.is_gestor())
          or c.profile_id = (select auth.uid())
        )
    )
  )
  or (select private.is_super_admin())
);

create policy "members insert messages into own conversations"
on public.messages
for insert
to authenticated
with check (
  organization_id = (select private.current_org_id())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.organization_id = messages.organization_id
      and c.profile_id = (select auth.uid())
  )
);

create policy "members read permitted diagnostics"
on public.diagnostics
for select
to authenticated
using (
  (
    organization_id = (select private.current_org_id())
    and exists (
      select 1
      from public.conversations c
      where c.id = diagnostics.conversation_id
        and c.organization_id = diagnostics.organization_id
        and (
          (select private.is_gestor())
          or c.profile_id = (select auth.uid())
        )
    )
  )
  or (select private.is_super_admin())
);

create policy "super admins read audit log"
on public.audit_log
for select
to authenticated
using ((select private.is_super_admin()));

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  profile record;
begin
  select role, organization_id
  into profile
  from public.profiles
  where user_id = (event->>'user_id')::uuid
    and status = 'active';

  claims := event->'claims';
  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'::jsonb), true);

  if profile is not null then
    claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(profile.role::text), true);
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(profile.organization_id::text), true);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
