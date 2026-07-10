begin;
\i supabase/tests/00-helpers.sql

select plan(7);

create temp table fixture(key text primary key, id uuid) on commit drop;

with
  users as (
    select
      tests.create_supabase_user('gestor_a') as gestor_a,
      tests.create_supabase_user('gestor_b') as gestor_b
  ),
  org_a as (
    insert into public.organizations(name) values ('Org A') returning id
  ),
  org_b as (
    insert into public.organizations(name) values ('Org B') returning id
  ),
  profile_a as (
    insert into public.profiles(user_id, organization_id, full_name, role)
    select users.gestor_a, org_a.id, 'Gestor A', 'gestor'::public.user_role
    from users, org_a
  ),
  profile_b as (
    insert into public.profiles(user_id, organization_id, full_name, role)
    select users.gestor_b, org_b.id, 'Gestor B', 'gestor'::public.user_role
    from users, org_b
  ),
  conv_a as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_a.id, users.gestor_a, 'chat-a', 'Lead A'
    from users, org_a
    returning id
  ),
  conv_b as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_b.id, users.gestor_b, 'chat-b', 'Lead B'
    from users, org_b
    returning id
  ),
  msg_a as (
    insert into public.messages(conversation_id, organization_id, sender, content, sent_at)
    select conv_a.id, org_a.id, 'lead', 'Mensagem A', now()
    from conv_a, org_a
  ),
  msg_b as (
    insert into public.messages(conversation_id, organization_id, sender, content, sent_at)
    select conv_b.id, org_b.id, 'lead', 'Mensagem B', now()
    from conv_b, org_b
  )
insert into fixture(key, id)
select 'org_a', id from org_a
union all select 'org_b', id from org_b
union all select 'gestor_a', gestor_a from users
union all select 'gestor_b', gestor_b from users
union all select 'conv_a', id from conv_a
union all select 'conv_b', id from conv_b;

select tests.authenticate_as('gestor_a');
select is((select count(*) from public.organizations), 1::bigint, 'gestor A ve somente a propria organizacao');
select is((select count(*) from public.conversations), 1::bigint, 'gestor A ve somente a conversa da propria org');
select is((select count(*) from public.messages), 1::bigint, 'gestor A ve somente a mensagem da propria org');
select is_empty(
  $$ select 1 from public.profiles where organization_id = (select id from fixture where key = 'org_b') $$,
  'gestor A nao ve profiles da org B'
);
select is_empty(
  $$ select 1 from public.conversations where organization_id = (select id from fixture where key = 'org_b') $$,
  'gestor A nao ve conversations da org B'
);

reset role;
select tests.authenticate_as('gestor_b');
select is((select count(*) from public.conversations), 1::bigint, 'gestor B ve somente a propria conversa');
select is_empty(
  $$ select 1 from public.messages where organization_id = (select id from fixture where key = 'org_a') $$,
  'gestor B nao ve messages da org A'
);

select * from finish();
rollback;
