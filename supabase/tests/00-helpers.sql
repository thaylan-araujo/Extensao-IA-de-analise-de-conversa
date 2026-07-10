create schema if not exists tests;

create or replace function tests.identifier_to_uuid(identifier text)
returns uuid
language sql
stable
as $$
  select (
    substr(md5(identifier), 1, 8) || '-' ||
    substr(md5(identifier), 9, 4) || '-' ||
    substr(md5(identifier), 13, 4) || '-' ||
    substr(md5(identifier), 17, 4) || '-' ||
    substr(md5(identifier), 21, 12)
  )::uuid
$$;

create or replace function tests.create_supabase_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := tests.identifier_to_uuid(identifier);
  user_email text := identifier || '@example.test';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    user_email,
    extensions.crypt('password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    created_at,
    updated_at,
    last_sign_in_at
  )
  values (
    user_id::text,
    user_id,
    user_email,
    'email',
    jsonb_build_object('sub', user_id::text, 'email', user_email),
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

  return user_id;
end;
$$;

create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
as $$
declare
  user_id uuid := tests.identifier_to_uuid(identifier);
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;
