begin;
\i helpers/00-helpers.inc

select plan(6);

create temp table fixture(key text primary key, id uuid) on commit drop;

with
  users as (
    select
      tests.create_supabase_user('sync_advogado_a') as advogado_a,
      tests.create_supabase_user('sync_advogado_b') as advogado_b
  ),
  org_a as (
    insert into public.organizations(name) values ('Org Sync A') returning id
  ),
  org_b as (
    insert into public.organizations(name) values ('Org Sync B') returning id
  ),
  profiles as (
    insert into public.profiles(user_id, organization_id, full_name, role)
    select users.advogado_a, org_a.id, 'Advogado Sync A', 'advogado'::public.user_role from users, org_a
    union all select users.advogado_b, org_b.id, 'Advogado Sync B', 'advogado'::public.user_role from users, org_b
  ),
  conv_a as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_a.id, users.advogado_a, 'sync-chat-a', 'Lead Sync A'
    from users, org_a
    returning id
  ),
  conv_b as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_b.id, users.advogado_b, 'sync-chat-b', 'Lead Sync B'
    from users, org_b
    returning id
  )
insert into fixture(key, id)
select 'org_a', id from org_a
union all select 'org_b', id from org_b
union all select 'advogado_a', advogado_a from users
union all select 'advogado_b', advogado_b from users
union all select 'conv_a', id from conv_a
union all select 'conv_b', id from conv_b;

grant select on fixture to authenticated;

select tests.authenticate_as('sync_advogado_a');

select lives_ok(
  $$ insert into public.messages(conversation_id, organization_id, sender, content, sent_at, wa_message_id, from_me, kind)
     values (
       (select id from fixture where key = 'conv_a'),
       (select id from fixture where key = 'org_a'),
       'lead', 'Primeira mensagem', now(), 'wamid-dedup-1', false, 'text'
     )
     on conflict (conversation_id, wa_message_id) do nothing $$,
  'advogado insere message na propria conversa'
);

-- reprocessar a mesma mensagem: ON CONFLICT DO NOTHING nao duplica (EXT-04)
insert into public.messages(conversation_id, organization_id, sender, content, sent_at, wa_message_id, from_me, kind)
values (
  (select id from fixture where key = 'conv_a'),
  (select id from fixture where key = 'org_a'),
  'lead', 'Primeira mensagem', now(), 'wamid-dedup-1', false, 'text'
)
on conflict (conversation_id, wa_message_id) do nothing;

select results_eq(
  $$ select count(*) from public.messages
     where conversation_id = (select id from fixture where key = 'conv_a')
       and wa_message_id = 'wamid-dedup-1' $$,
  array[1::bigint],
  'inserir a mesma (conversation_id, wa_message_id) duas vezes mantem exatamente 1 linha'
);

select throws_ok(
  $$ insert into public.messages(conversation_id, organization_id, sender, content, sent_at, wa_message_id)
     values (
       (select id from fixture where key = 'conv_b'),
       (select id from fixture where key = 'org_b'),
       'lead', 'Invasao', now(), 'wamid-cross-1'
     ) $$,
  '42501',
  null,
  'advogado nao insere message em conversa de outra org'
);

-- reabrir o mesmo chat: upsert de conversation nao duplica (conversations_profile_wa_chat_key)
insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
values (
  (select id from fixture where key = 'org_a'),
  (select id from fixture where key = 'advogado_a'),
  'sync-chat-a', 'Lead Sync A'
)
on conflict (profile_id, wa_chat_id) do nothing;

select results_eq(
  $$ select count(*) from public.conversations
     where profile_id = (select id from fixture where key = 'advogado_a')
       and wa_chat_id = 'sync-chat-a' $$,
  array[1::bigint],
  'reinserir a mesma (profile_id, wa_chat_id) mantem exatamente 1 conversation'
);

update public.conversations
set contact_name = 'Lead Sync A Editado'
where id = (select id from fixture where key = 'conv_a');

select is(
  (select contact_name from public.conversations where id = (select id from fixture where key = 'conv_a')),
  'Lead Sync A Editado',
  'advogado atualiza contact_name da propria conversation'
);

-- update em conversa alheia: USING filtra a linha, 0 linhas afetadas
update public.conversations
set contact_name = 'Hackeado'
where id = (select id from fixture where key = 'conv_b');

reset role;

select is(
  (select contact_name from public.conversations where id = (select id from fixture where key = 'conv_b')),
  'Lead Sync B',
  'update em conversation de outro advogado afeta 0 linhas'
);

select * from finish();
rollback;
