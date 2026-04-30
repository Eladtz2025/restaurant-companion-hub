-- pgTAP tests for auth.custom_access_token_hook
-- Run with: supabase test db

begin;

select plan(7);

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Minimal tenant + user + membership fixture.
do $$
begin
  -- tenant
  insert into public.tenants (id, name, slug)
  values ('00000000-0000-0000-0000-000000000001', 'Test Restaurant', 'test-restaurant')
  on conflict (id) do nothing;

  -- auth user (bypass GoTrue — insert directly for unit testing)
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000002',
    'owner@test.example',
    crypt('password', gen_salt('bf')),
    now(), now(), now()
  )
  on conflict (id) do nothing;

  -- membership
  insert into public.tenant_members (tenant_id, user_id, role)
  values (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'owner'
  )
  on conflict (tenant_id, user_id) do nothing;
end;
$$;

-- ── test 1: function exists ───────────────────────────────────────────────────
select has_function(
  'auth',
  'custom_access_token_hook',
  array['jsonb'],
  'auth.custom_access_token_hook(jsonb) should exist'
);

-- ── test 2: returns jsonb ─────────────────────────────────────────────────────
select function_returns(
  'auth',
  'custom_access_token_hook',
  array['jsonb'],
  'jsonb',
  'hook should return jsonb'
);

-- ── test 3: hook injects tenant_id for a known member ─────────────────────────
declare
  v_event  jsonb;
  v_result jsonb;
begin
  v_event := jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-000000000002',
    'claims',  '{}'::jsonb
  );
  v_result := auth.custom_access_token_hook(v_event);

  select ok(
    (v_result -> 'claims' ->> 'tenant_id') = '00000000-0000-0000-0000-000000000001',
    'claims.tenant_id should equal the user''s tenant'
  );
end;

-- ── test 4: hook injects user_role ────────────────────────────────────────────
declare
  v_event  jsonb;
  v_result jsonb;
begin
  v_event := jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-000000000002',
    'claims',  '{}'::jsonb
  );
  v_result := auth.custom_access_token_hook(v_event);

  select ok(
    (v_result -> 'claims' ->> 'user_role') = 'owner',
    'claims.user_role should equal the membership role'
  );
end;

-- ── test 5: hook preserves existing claims ────────────────────────────────────
declare
  v_event  jsonb;
  v_result jsonb;
begin
  v_event := jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-000000000002',
    'claims',  '{"sub": "existing-sub", "iss": "supabase"}'::jsonb
  );
  v_result := auth.custom_access_token_hook(v_event);

  select ok(
    (v_result -> 'claims' ->> 'sub') = 'existing-sub',
    'hook should preserve pre-existing claims'
  );
end;

-- ── test 6: no claims injected for user with no membership ───────────────────
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000099';
  v_event   jsonb;
  v_result  jsonb;
begin
  -- ensure user exists but has no membership
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user_id, 'nomember@test.example', crypt('pw', gen_salt('bf')), now(), now(), now())
  on conflict (id) do nothing;

  v_event  := jsonb_build_object('user_id', v_user_id, 'claims', '{}'::jsonb);
  v_result := auth.custom_access_token_hook(v_event);

  select ok(
    (v_result -> 'claims' -> 'tenant_id') is null,
    'claims.tenant_id should be absent for user with no membership'
  );
end;

-- ── test 7: execute permission granted to supabase_auth_admin ────────────────
select ok(
  has_function_privilege('supabase_auth_admin', 'auth.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'supabase_auth_admin should have EXECUTE on the hook'
);

select * from finish();

rollback;
