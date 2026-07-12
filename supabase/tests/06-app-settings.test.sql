begin;
\i helpers/00-helpers.inc

select plan(8);

create temp table fixture(key text primary key, id uuid) on commit drop;

with
  users as (
    select
      tests.create_supabase_user('settings_super') as super_admin,
      tests.create_supabase_user('settings_advogado_a') as advogado_a,
      tests.create_supabase_user('settings_advogado_b') as advogado_b
  ),
  internal_org as (
    insert into public.organizations(name) values ('Elite Juris Settings') returning id
  ),
  org_a as (
    insert into public.organizations(name) values ('Org Settings A') returning id
  ),
  org_b as (
    insert into public.organizations(name) values ('Org Settings B') returning id
  ),
  profiles as (
    insert into public.profiles(user_id, organization_id, full_name, role)
    select users.super_admin, internal_org.id, 'Super Admin Settings', 'super_admin'::public.user_role from users, internal_org
    union all select users.advogado_a, org_a.id, 'Advogado Settings A', 'advogado'::public.user_role from users, org_a
    union all select users.advogado_b, org_b.id, 'Advogado Settings B', 'advogado'::public.user_role from users, org_b
  )
insert into fixture(key, id)
select 'org_a', id from org_a
union all select 'org_b', id from org_b
union all select 'advogado_a', advogado_a from users
union all select 'advogado_b', advogado_b from users;

grant select on fixture to authenticated;

select tests.authenticate_as('settings_advogado_a');

select is(
  (select value from public.app_settings where key = 'reader_enabled'),
  'true'::jsonb,
  'authenticated le reader_enabled semeado como true'
);

-- policy ALL de app_settings filtra advogado: update afeta 0 linhas
update public.app_settings
set value = 'false'::jsonb
where key = 'reader_enabled';

select is(
  (select value from public.app_settings where key = 'reader_enabled'),
  'true'::jsonb,
  'advogado nao escreve o kill-switch (update afeta 0 linhas)'
);

select lives_ok(
  $$ insert into public.reader_status(profile_id, organization_id, status, extension_version)
     values (
       (select id from fixture where key = 'advogado_a'),
       (select id from fixture where key = 'org_a'),
       'ok', '0.1.0'
     ) $$,
  'advogado insere o proprio heartbeat em reader_status'
);

-- heartbeat seguinte: upsert atualiza a propria linha
insert into public.reader_status(profile_id, organization_id, status, extension_version)
values (
  (select id from fixture where key = 'advogado_a'),
  (select id from fixture where key = 'org_a'),
  'drift', '0.1.0'
)
on conflict (profile_id) do update
set status = excluded.status,
    last_seen_at = now();

select is(
  (select status from public.reader_status where profile_id = (select id from fixture where key = 'advogado_a')),
  'drift',
  'advogado upserta a propria linha de reader_status'
);

select throws_ok(
  $$ insert into public.reader_status(profile_id, organization_id, status)
     values (
       (select id from fixture where key = 'advogado_b'),
       (select id from fixture where key = 'org_b'),
       'ok'
     ) $$,
  '42501',
  null,
  'advogado nao grava heartbeat de outro profile'
);

reset role;
select tests.authenticate_as('settings_advogado_b');

insert into public.reader_status(profile_id, organization_id, status)
values (
  (select id from fixture where key = 'advogado_b'),
  (select id from fixture where key = 'org_b'),
  'ok'
);

select is(
  (select count(*) from public.reader_status),
  1::bigint,
  'advogado le somente a propria linha de reader_status'
);

reset role;
select tests.authenticate_as('settings_super');

select is(
  (select count(*) from public.reader_status),
  2::bigint,
  'super-admin le todas as linhas de reader_status'
);

update public.app_settings
set value = 'false'::jsonb
where key = 'reader_enabled';

select is(
  (select value from public.app_settings where key = 'reader_enabled'),
  'false'::jsonb,
  'super-admin altera o kill-switch (1 linha)'
);

select * from finish();
rollback;
