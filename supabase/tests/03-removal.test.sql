begin;
\i helpers/00-helpers.inc

select plan(4);

create temp table fixture(key text primary key, id uuid) on commit drop;

with
  users as (
    select
      tests.create_supabase_user('gestor_removal') as gestor,
      tests.create_supabase_user('advogado_removed') as advogado
  ),
  org_a as (
    insert into public.organizations(name) values ('Org Removal') returning id
  ),
  profiles as (
    insert into public.profiles(user_id, organization_id, full_name, role)
    select users.gestor, org_a.id, 'Gestor Removal', 'gestor'::public.user_role from users, org_a
    union all select users.advogado, org_a.id, 'Advogado Removed', 'advogado'::public.user_role from users, org_a
  ),
  conv as (
    insert into public.conversations(organization_id, profile_id, wa_chat_id, contact_name)
    select org_a.id, users.advogado, 'removed-chat', 'Lead Removido'
    from users, org_a
    returning id
  )
insert into fixture(key, id)
select 'org_a', id from org_a
union all select 'gestor', gestor from users
union all select 'advogado', advogado from users
union all select 'conv', id from conv;

grant select on fixture to authenticated;

select tests.authenticate_as('advogado_removed');
select is((select count(*) from public.conversations), 1::bigint, 'advogado ativo ve a propria conversa');

reset role;
update public.profiles
set status = 'removed',
    removed_at = now()
where user_id = (select id from fixture where key = 'advogado');

select tests.authenticate_as('advogado_removed');
select is((select count(*) from public.conversations), 0::bigint, 'advogado removido perde acesso sem refresh');
select is((select count(*) from public.organizations), 0::bigint, 'advogado removido nao ve organizacao');

reset role;
select tests.authenticate_as('gestor_removal');
select is((select count(*) from public.conversations), 1::bigint, 'gestor preserva acesso ao historico do removido');

select * from finish();
rollback;
