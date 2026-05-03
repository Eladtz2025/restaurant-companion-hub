-- Phase 3.1: recipe_versions — snapshot history for recipes

CREATE TABLE public.recipe_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_id   UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  version     INT         NOT NULL,
  change_note TEXT,
  restored_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (recipe_id, version)
);

CREATE INDEX idx_recipe_versions_recipe
  ON public.recipe_versions(recipe_id, version DESC);

ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_versions_select_member"
  ON public.recipe_versions FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "recipe_versions_insert_member"
  ON public.recipe_versions FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND public.user_role_in(tenant_id) IN ('owner', 'manager', 'chef')
  );

CREATE POLICY "recipe_versions_update_member"
  ON public.recipe_versions FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (public.user_role_in(tenant_id) IN ('owner', 'manager', 'chef'));

-- Rollback:
-- DROP TABLE IF EXISTS public.recipe_versions;
