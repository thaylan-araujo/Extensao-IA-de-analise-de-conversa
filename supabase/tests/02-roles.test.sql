begin;
\i helpers/00-helpers.inc

select plan(9);

create temp table fixture(key text primary key, id uuid) on commit drop;

with
  users as (
    select
      tests.create_supabase_user('super_admin') as super_admin,
      tests.create_supabase_user('gestor_roles') as gestor,
      tests.create_supabase_user('advogado_1') as advogado_1,
      tests.create_supabase_user('advogado_2') as advogado_2
  ),
  internal_org as (
    insert into public.organizations(name) values ('Elite Juris Interna') returning id
  ),
  org_a as (
    insert into public.organizations(name) values ('Org Roles A') returning id
  ),
  org_b as (
    insert into public.organizations(name) values ('Org Roles B') returning id
  ),
  profiles as (
    insert into public.profiles(user_id, organization_id, full_name, role)
    select users.super_admin, internal_org.id, 'Super Admin', 'super_admin'::public.user_role from users, internal_org
    union all select users.gestor, org_a.id, 'Gestor Roles', 'gestor'::public.user_role from users, org_a
    union all select users.advogado_1, org_a.id, 'Advogado 1', 'advogado'::public.user_role from users, org_a
    union all select users.advogado_2, org_a.id, 'Advogado 2', 'advogado'::public.user_role from users, org_a
  ),
  conv_1 as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_a.id, users.advogado_1, 'roles-1', 'Lead 1'
    from users, org_a
    returning id
  ),
  conv_2 as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_a.id, users.advogado_2, 'roles-2', 'Lead 2'
    from users, org_a
    returning id
  )
insert into fixture(key, id)
select 'org_a', id from org_a
union all select 'org_b', id from org_b
union all select 'gestor', gestor from users
union all select 'advogado_1', advogado_1 from users
union all select 'advogado_2', advogado_2 from users
union all select 'conv_1', id from conv_1
union all select 'conv_2', id from conv_2;

select tests.authenticate_as('advogado_1');
select is((select count(*) from public.conversations), 1::bigint, 'advogado ve somente a propria conversa');
select is((select count(*) from public.profiles), 1::bigint, 'advogado ve somente o proprio profile');
select is((select count(*) from public.invitations), 0::bigint, 'advogado nao le invitations');
select throws_ok(
  $$ insert into public.conversations(organization_id, profile_id, contact_name)
     values ((select id from fixture where key = 'org_b'), (select id from fixture where key = 'advogado_1'), 'Lead proibido') $$,
  '42501',
  'advogado nao insere conversa em outra org'
);
select throws_ok(
  $$ insert into public.conversations(organization_id, profile_id, contact_name)
     values ((select id from fixture where key = 'org_a'), (select id from fixture where key = 'advogado_2'), 'Lead de colega') $$,
  '42501',
  'advogado nao insere conversa para outro usuario'
);
select throws_ok(
  $$ insert into public.diagnostics(conversation_id, organization_id, score)
     values ((select id from fixture where key = 'conv_1'), (select id from fixture where key = 'org_a'), 8) $$,
  '42501',
  'authenticated nao insere diagnostics'
);
select throws_ok(
  $$ insert into public.audit_log(actor_user_id, action, organization_id)
     values ((select id from fixture where key = 'advogado_1'), 'test', (select id from fixture where key = 'org_a')) $$,
  '42501',
  'authenticated nao insere audit_log'
);

reset role;
select tests.authenticate_as('gestor_roles');
select is((select count(*) from public.conversations), 2::bigint, 'gestor ve conversas da equipe');

reset role;
select tests.authenticate_as('super_admin');
select is((select count(*) from public.conversations), 2::bigint, 'super_admin atravessa orgs para suporte');

select * from finish();
rollback;
