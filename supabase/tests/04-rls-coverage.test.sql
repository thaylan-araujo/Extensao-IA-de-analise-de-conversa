begin;
\i supabase/tests/00-helpers.sql

select plan(2);

select is(
  (
    select count(*)
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'organizations',
        'profiles',
        'invitations',
        'conversations',
        'messages',
        'diagnostics',
        'audit_log'
      )
      and not rowsecurity
  ),
  0::bigint,
  'todas as tabelas de dominio public tem RLS habilitado'
);

select is(
  (
    select count(*)
    from unnest(array[
      'organizations',
      'profiles',
      'invitations',
      'conversations',
      'messages',
      'diagnostics',
      'audit_log'
    ]) as expected(tablename)
    where not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = expected.tablename
    )
  ),
  0::bigint,
  'todas as tabelas de dominio public possuem ao menos uma policy'
);

select * from finish();
rollback;
