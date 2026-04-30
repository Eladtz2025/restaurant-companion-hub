-- pgTAP tests: core schema RLS + constraints
-- Run: supabase test db

BEGIN;

SELECT plan(12);

-- ============================================================
-- Setup: two tenants, users, and memberships
-- ============================================================

-- Tenant A
INSERT INTO public.tenants (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a'),
  ('b0000000-0000-0000-0000-000000000001', 'Tenant B', 'tenant-b');

-- Users (insert into auth.users)
INSERT INTO auth.users (id, email) VALUES
  ('u0000000-0000-0000-0000-000000000001', 'chef_a@test.com'),
  ('u0000000-0000-0000-0000-000000000002', 'staff_a@test.com'),
  ('u0000000-0000-0000-0000-000000000003', 'manager_a@test.com'),
  ('u0000000-0000-0000-0000-000000000004', 'chef_b@test.com');

INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'chef'),
  ('a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002', 'staff'),
  ('a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000003', 'manager'),
  ('b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000004', 'chef');

-- Seed data for tenant A
INSERT INTO public.menu_items (id, tenant_id, name_he, category, price_cents) VALUES
  ('m0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'שניצל', 'main', 6000);

INSERT INTO public.ingredients (id, tenant_id, name_he, unit, cost_per_unit_cents) VALUES
  ('i0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'עוף', 'kg', 1500);

INSERT INTO public.recipes (id, tenant_id, name_he, type, yield_qty, yield_unit) VALUES
  ('r0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'שניצל עוף', 'menu', 1, 'unit'),
  ('r0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'בסיס ציר', 'prep', 1, 'l');

-- ============================================================
-- Test 1: Chef from tenant A CAN read menu_items of tenant A
-- ============================================================
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000001"}';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.menu_items
    WHERE id = 'm0000000-0000-0000-0000-000000000001'
  ),
  'chef from tenant A can read menu_items of tenant A'
);

-- ============================================================
-- Test 2: Chef from tenant B CANNOT read menu_items of tenant A
-- ============================================================
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000004"}';

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.menu_items
    WHERE id = 'm0000000-0000-0000-0000-000000000001'
  ),
  'chef from tenant B cannot read menu_items of tenant A'
);

-- ============================================================
-- Test 3: Staff from tenant A CANNOT DELETE menu_items
-- ============================================================
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000002"}';

SELECT throws_ok(
  $$ DELETE FROM public.menu_items WHERE id = 'm0000000-0000-0000-0000-000000000001' $$,
  NULL,
  'staff cannot delete menu_items'
);

-- ============================================================
-- Test 4: Manager from tenant A CAN DELETE menu_items
-- ============================================================
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000003"}';

-- Insert a disposable item for the manager to delete
INSERT INTO public.menu_items (id, tenant_id, name_he, category, price_cents) VALUES
  ('m0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000001', 'פריט למחיקה', 'side', 1000);

SELECT lives_ok(
  $$ DELETE FROM public.menu_items WHERE id = 'm0000000-0000-0000-0000-000000000099' $$,
  'manager can delete menu_items'
);

-- ============================================================
-- Test 5: Chef from tenant A CAN read ingredients of tenant A
-- ============================================================
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000001"}';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.ingredients
    WHERE id = 'i0000000-0000-0000-0000-000000000001'
  ),
  'chef from tenant A can read ingredients of tenant A'
);

-- ============================================================
-- Test 6: Chef from tenant B CANNOT read ingredients of tenant A
-- ============================================================
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000004"}';

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.ingredients
    WHERE id = 'i0000000-0000-0000-0000-000000000001'
  ),
  'chef from tenant B cannot read ingredients of tenant A'
);

-- ============================================================
-- Test 7: recipe_components CHECK rejects row with BOTH keys set
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.recipe_components
       (tenant_id, recipe_id, ingredient_id, sub_recipe_id, qty, unit)
     VALUES (
       'a0000000-0000-0000-0000-000000000001',
       'r0000000-0000-0000-0000-000000000001',
       'i0000000-0000-0000-0000-000000000001',
       'r0000000-0000-0000-0000-000000000002',
       100, 'g'
     ) $$,
  '23514',
  'recipe_component_source_xor rejects row with both ingredient_id and sub_recipe_id set'
);

-- ============================================================
-- Test 8: recipe_components CHECK rejects row with NEITHER key set
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.recipe_components
       (tenant_id, recipe_id, ingredient_id, sub_recipe_id, qty, unit)
     VALUES (
       'a0000000-0000-0000-0000-000000000001',
       'r0000000-0000-0000-0000-000000000001',
       NULL, NULL, 100, 'g'
     ) $$,
  '23514',
  'recipe_component_source_xor rejects row with neither ingredient_id nor sub_recipe_id'
);

-- ============================================================
-- Test 9: recipe_components valid row (ingredient_id only) succeeds
-- ============================================================
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000001"}';

SELECT lives_ok(
  $$ INSERT INTO public.recipe_components
       (id, tenant_id, recipe_id, ingredient_id, sub_recipe_id, qty, unit)
     VALUES (
       'c0000000-0000-0000-0000-000000000001',
       'a0000000-0000-0000-0000-000000000001',
       'r0000000-0000-0000-0000-000000000001',
       'i0000000-0000-0000-0000-000000000001',
       NULL, 200, 'g'
     ) $$,
  'valid recipe_component with ingredient_id only inserts successfully'
);

-- ============================================================
-- Test 10: recipe_components valid row (sub_recipe_id only) succeeds
-- ============================================================
SELECT lives_ok(
  $$ INSERT INTO public.recipe_components
       (id, tenant_id, recipe_id, ingredient_id, sub_recipe_id, qty, unit)
     VALUES (
       'c0000000-0000-0000-0000-000000000002',
       'a0000000-0000-0000-0000-000000000001',
       'r0000000-0000-0000-0000-000000000001',
       NULL,
       'r0000000-0000-0000-0000-000000000002',
       0.5, 'l'
     ) $$,
  'valid recipe_component with sub_recipe_id only inserts successfully'
);

-- ============================================================
-- Test 11: audit trigger fires on menu_item price change
-- ============================================================
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"u0000000-0000-0000-0000-000000000003"}';

UPDATE public.menu_items
  SET price_cents = 7000
  WHERE id = 'm0000000-0000-0000-0000-000000000001';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public._audit_log
    WHERE table_name = 'menu_items'
      AND action = 'menu_item.price_changed'
      AND record_id = 'm0000000-0000-0000-0000-000000000001'
      AND (old_data->>'price_cents')::int = 6000
      AND (new_data->>'price_cents')::int = 7000
  ),
  'audit trigger fires on menu_item price change with before/after values'
);

-- ============================================================
-- Test 12: audit trigger fires on recipe_component insert
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM public._audit_log
    WHERE table_name = 'recipe_components'
      AND action = 'recipe_component.created'
  ),
  'audit trigger fires on recipe_component insert'
);

SELECT * FROM finish();
ROLLBACK;
