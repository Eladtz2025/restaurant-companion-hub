CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'chef', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.memberships (tenant_id);

CREATE OR REPLACE FUNCTION public.user_tenant_ids()
  RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.user_role_in(p_tenant_id UUID)
  RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.memberships WHERE user_id = auth.uid() AND tenant_id = p_tenant_id $$;

CREATE TABLE IF NOT EXISTS public._audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants (id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON public._audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public._audit_log (created_at);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER tenants_set_updated_at
  BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants;
CREATE POLICY "tenants_select_own" ON public.tenants FOR SELECT
  USING (id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS "memberships_select_own" ON public.memberships;
CREATE POLICY "memberships_select_own" ON public.memberships FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_log_select_member" ON public._audit_log;
CREATE POLICY "audit_log_select_member" ON public._audit_log FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS "memberships_select_tenant_owner" ON public.memberships;
CREATE POLICY "memberships_select_tenant_owner" ON public.memberships FOR SELECT
  USING (public.user_role_in(tenant_id) = 'owner');

DROP POLICY IF EXISTS "memberships_select_tenant_manager" ON public.memberships;
CREATE POLICY "memberships_select_tenant_manager" ON public.memberships FOR SELECT
  USING (public.user_role_in(tenant_id) = 'manager');

DROP POLICY IF EXISTS "memberships_insert_owner" ON public.memberships;
CREATE POLICY "memberships_insert_owner" ON public.memberships FOR INSERT
  WITH CHECK (public.user_role_in(tenant_id) = 'owner');

DROP POLICY IF EXISTS "memberships_update_owner" ON public.memberships;
CREATE POLICY "memberships_update_owner" ON public.memberships FOR UPDATE
  USING (public.user_role_in(tenant_id) = 'owner')
  WITH CHECK (public.user_role_in(tenant_id) = 'owner');

DROP POLICY IF EXISTS "memberships_delete_owner" ON public.memberships;
CREATE POLICY "memberships_delete_owner" ON public.memberships FOR DELETE
  USING (public.user_role_in(tenant_id) = 'owner' AND user_id <> auth.uid());

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pos_external_id TEXT, name_he TEXT NOT NULL, name_en TEXT, category TEXT NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents >= 0), active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON public.menu_items(tenant_id);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_items_select_member" ON public.menu_items;
CREATE POLICY "menu_items_select_member" ON public.menu_items FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "menu_items_insert_member" ON public.menu_items;
CREATE POLICY "menu_items_insert_member" ON public.menu_items FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "menu_items_update_member" ON public.menu_items;
CREATE POLICY "menu_items_update_member" ON public.menu_items FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "menu_items_delete_manager" ON public.menu_items;
CREATE POLICY "menu_items_delete_manager" ON public.menu_items FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name_he TEXT NOT NULL, name_en TEXT,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'unit', 'pkg')),
  cost_per_unit_cents INT NOT NULL DEFAULT 0 CHECK (cost_per_unit_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  pkg_qty NUMERIC CHECK (pkg_qty IS NULL OR pkg_qty > 0),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('produce', 'meat', 'fish', 'dairy', 'dry', 'alcohol', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON public.ingredients(tenant_id);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ingredients_select_member" ON public.ingredients;
CREATE POLICY "ingredients_select_member" ON public.ingredients FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "ingredients_insert_member" ON public.ingredients;
CREATE POLICY "ingredients_insert_member" ON public.ingredients FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "ingredients_update_member" ON public.ingredients;
CREATE POLICY "ingredients_update_member" ON public.ingredients FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "ingredients_delete_manager" ON public.ingredients;
CREATE POLICY "ingredients_delete_manager" ON public.ingredients FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name_he TEXT NOT NULL, name_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('menu', 'prep')),
  yield_qty NUMERIC NOT NULL DEFAULT 1 CHECK (yield_qty > 0),
  yield_unit TEXT NOT NULL DEFAULT 'unit' CHECK (yield_unit IN ('kg', 'g', 'l', 'ml', 'unit', 'pkg')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON public.recipes(tenant_id);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_select_member" ON public.recipes;
CREATE POLICY "recipes_select_member" ON public.recipes FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "recipes_insert_member" ON public.recipes;
CREATE POLICY "recipes_insert_member" ON public.recipes FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "recipes_update_member" ON public.recipes;
CREATE POLICY "recipes_update_member" ON public.recipes FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "recipes_delete_manager" ON public.recipes;
CREATE POLICY "recipes_delete_manager" ON public.recipes FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

CREATE TABLE IF NOT EXISTS public.recipe_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  sub_recipe_id UUID REFERENCES public.recipes(id) ON DELETE RESTRICT,
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'unit', 'pkg')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recipe_component_source_xor CHECK (
    (ingredient_id IS NOT NULL AND sub_recipe_id IS NULL) OR
    (ingredient_id IS NULL AND sub_recipe_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_recipe_components_tenant ON public.recipe_components(tenant_id);
ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipe_components_select_member" ON public.recipe_components;
CREATE POLICY "recipe_components_select_member" ON public.recipe_components FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "recipe_components_insert_member" ON public.recipe_components;
CREATE POLICY "recipe_components_insert_member" ON public.recipe_components FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "recipe_components_update_member" ON public.recipe_components;
CREATE POLICY "recipe_components_update_member" ON public.recipe_components FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
DROP POLICY IF EXISTS "recipe_components_delete_member" ON public.recipe_components;
CREATE POLICY "recipe_components_delete_member" ON public.recipe_components FOR DELETE
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE OR REPLACE TRIGGER menu_items_set_updated_at
  BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER ingredients_set_updated_at
  BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER recipes_set_updated_at
  BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();