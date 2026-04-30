-- Phase 1 Step 1.1: Core schema — menu_items, ingredients, recipes, recipe_components
-- Order: a) menu_items  b) ingredients  c) recipes  d) recipe_components
--        e) set_updated_at triggers  f) audit triggers

-- ============================================================
-- a. menu_items
-- ============================================================

CREATE TABLE public.menu_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pos_external_id TEXT,
  name_he         TEXT        NOT NULL,
  name_en         TEXT,
  category        TEXT        NOT NULL,
  price_cents     INT         NOT NULL CHECK (price_cents >= 0),
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_tenant      ON public.menu_items(tenant_id);
CREATE INDEX idx_menu_items_pos_id      ON public.menu_items(tenant_id, pos_external_id)
  WHERE pos_external_id IS NOT NULL;

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- All members can read their tenant's menu items.
CREATE POLICY "menu_items_select_member"
  ON public.menu_items FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Any member can create menu items.
CREATE POLICY "menu_items_insert_member"
  ON public.menu_items FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- Any member can update menu items.
CREATE POLICY "menu_items_update_member"
  ON public.menu_items FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- Only owner or manager can delete menu items.
CREATE POLICY "menu_items_delete_manager"
  ON public.menu_items FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

-- ============================================================
-- b. ingredients
-- ============================================================

CREATE TABLE public.ingredients (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name_he             TEXT        NOT NULL,
  name_en             TEXT,
  unit                TEXT        NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'unit', 'pkg')),
  cost_per_unit_cents INT         NOT NULL DEFAULT 0 CHECK (cost_per_unit_cents >= 0),
  active              BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredients_tenant ON public.ingredients(tenant_id);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredients_select_member"
  ON public.ingredients FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "ingredients_insert_member"
  ON public.ingredients FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "ingredients_update_member"
  ON public.ingredients FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "ingredients_delete_manager"
  ON public.ingredients FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

-- ============================================================
-- c. recipes
-- ============================================================

CREATE TABLE public.recipes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name_he     TEXT        NOT NULL,
  name_en     TEXT,
  type        TEXT        NOT NULL CHECK (type IN ('menu', 'prep')),
  yield_qty   NUMERIC     NOT NULL DEFAULT 1 CHECK (yield_qty > 0),
  yield_unit  TEXT        NOT NULL DEFAULT 'unit'
                CHECK (yield_unit IN ('kg', 'g', 'l', 'ml', 'unit', 'pkg')),
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_tenant ON public.recipes(tenant_id);
CREATE INDEX idx_recipes_type   ON public.recipes(tenant_id, type);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select_member"
  ON public.recipes FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipes_insert_member"
  ON public.recipes FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipes_update_member"
  ON public.recipes FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipes_delete_manager"
  ON public.recipes FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

-- ============================================================
-- d. recipe_components  (the Bill of Materials)
-- ============================================================

CREATE TABLE public.recipe_components (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_id      UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id  UUID        REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  sub_recipe_id  UUID        REFERENCES public.recipes(id) ON DELETE RESTRICT,
  qty            NUMERIC     NOT NULL CHECK (qty > 0),
  unit           TEXT        NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'unit', 'pkg')),
  sort_order     INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exactly one of ingredient_id or sub_recipe_id must be set.
  CONSTRAINT recipe_component_source_xor CHECK (
    (ingredient_id IS NOT NULL AND sub_recipe_id IS NULL)
    OR
    (ingredient_id IS NULL AND sub_recipe_id IS NOT NULL)
  )
);

CREATE INDEX idx_recipe_components_tenant    ON public.recipe_components(tenant_id);
CREATE INDEX idx_recipe_components_recipe    ON public.recipe_components(recipe_id);
CREATE INDEX idx_recipe_components_ingr      ON public.recipe_components(ingredient_id)
  WHERE ingredient_id IS NOT NULL;
CREATE INDEX idx_recipe_components_subrecipe ON public.recipe_components(sub_recipe_id)
  WHERE sub_recipe_id IS NOT NULL;

ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_components_select_member"
  ON public.recipe_components FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipe_components_insert_member"
  ON public.recipe_components FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipe_components_update_member"
  ON public.recipe_components FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipe_components_delete_member"
  ON public.recipe_components FOR DELETE
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- ============================================================
-- e. set_updated_at triggers (reuse the function from baseline)
-- ============================================================

CREATE TRIGGER menu_items_set_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER ingredients_set_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER recipes_set_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- f. Audit triggers
-- ============================================================

-- Audit: menu_items price changes.
CREATE OR REPLACE FUNCTION public.audit_menu_item_price()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.price_cents IS DISTINCT FROM NEW.price_cents THEN
    INSERT INTO public._audit_log (
      tenant_id, user_id, action, table_name, record_id, old_data, new_data
    ) VALUES (
      NEW.tenant_id,
      auth.uid(),
      'menu_item.price_changed',
      'menu_items',
      NEW.id,
      jsonb_build_object('price_cents', OLD.price_cents),
      jsonb_build_object('price_cents', NEW.price_cents)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER menu_items_audit_price
  AFTER UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_menu_item_price();

-- Audit: recipe_components — any INSERT / UPDATE / DELETE.
CREATE OR REPLACE FUNCTION public.audit_recipe_component()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public._audit_log (
      tenant_id, user_id, action, table_name, record_id, old_data, new_data
    ) VALUES (
      NEW.tenant_id, auth.uid(),
      'recipe_component.created', 'recipe_components', NEW.id,
      NULL, to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public._audit_log (
      tenant_id, user_id, action, table_name, record_id, old_data, new_data
    ) VALUES (
      NEW.tenant_id, auth.uid(),
      'recipe_component.updated', 'recipe_components', NEW.id,
      to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public._audit_log (
      tenant_id, user_id, action, table_name, record_id, old_data, new_data
    ) VALUES (
      OLD.tenant_id, auth.uid(),
      'recipe_component.deleted', 'recipe_components', OLD.id,
      to_jsonb(OLD), NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER recipe_components_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_components
  FOR EACH ROW EXECUTE FUNCTION public.audit_recipe_component();

-- Rollback reference (do NOT uncomment in production):
-- DROP TRIGGER IF EXISTS recipe_components_audit ON public.recipe_components;
-- DROP TRIGGER IF EXISTS menu_items_audit_price ON public.menu_items;
-- DROP TRIGGER IF EXISTS recipes_set_updated_at ON public.recipes;
-- DROP TRIGGER IF EXISTS ingredients_set_updated_at ON public.ingredients;
-- DROP TRIGGER IF EXISTS menu_items_set_updated_at ON public.menu_items;
-- DROP TABLE IF EXISTS public.recipe_components;
-- DROP TABLE IF EXISTS public.recipes;
-- DROP TABLE IF EXISTS public.ingredients;
-- DROP TABLE IF EXISTS public.menu_items;
