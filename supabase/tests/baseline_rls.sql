BEGIN;

SELECT plan(5);

-- Test 1: Without auth context, user_tenant_ids() returns empty
SELECT is(
  (SELECT count(*)::int FROM public.user_tenant_ids()),
  0,
  'user_tenant_ids() returns empty when no auth context'
);

-- Test 2: Without auth context, tenants table returns no rows (RLS blocks)
SELECT is(
  (SELECT count(*)::int FROM public.tenants),
  0,
  'tenants table returns no rows without auth context'
);

-- Test 3: Without auth context, memberships table returns no rows (RLS blocks)
SELECT is(
  (SELECT count(*)::int FROM public.memberships),
  0,
  'memberships table returns no rows without auth context'
);

-- Test 4: Service role can see all tenants
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT count(*)::int FROM public.tenants),
  1,
  'service role (postgres) can see all tenants'
);

-- Test 5: Service role can see all memberships
SELECT is(
  (SELECT count(*)::int FROM public.memberships),
  4,
  'service role (postgres) can see all memberships'
);

SELECT * FROM finish();

ROLLBACK;
