-- Phase 3.1: manager_overrides — audited field overrides by managers

CREATE TABLE public.manager_overrides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type   TEXT        NOT NULL CHECK (entity_type IN ('prep_task')),
  entity_id     UUID        NOT NULL,
  field         TEXT        NOT NULL,
  original_value JSONB      NOT NULL,
  override_value JSONB      NOT NULL,
  reason        TEXT        CHECK (char_length(reason) <= 500),
  overridden_by UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reverted      BOOLEAN     NOT NULL DEFAULT false,
  reverted_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manager_overrides_entity
  ON public.manager_overrides(tenant_id, entity_type, entity_id);

CREATE INDEX idx_manager_overrides_tenant
  ON public.manager_overrides(tenant_id, created_at DESC);

ALTER TABLE public.manager_overrides ENABLE ROW LEVEL SECURITY;

-- All members can read overrides for their tenant
CREATE POLICY "manager_overrides_select_member"
  ON public.manager_overrides FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Only owner/manager can create overrides
CREATE POLICY "manager_overrides_insert_manager"
  ON public.manager_overrides FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND public.user_role_in(tenant_id) IN ('owner', 'manager')
  );

-- Only owner/manager can revert (update reverted fields)
CREATE POLICY "manager_overrides_update_manager"
  ON public.manager_overrides FOR UPDATE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'))
  WITH CHECK (public.user_role_in(tenant_id) IN ('owner', 'manager'));

-- Overrides are never deleted — only reverted
-- No DELETE policy intentionally.

-- Rollback:
-- DROP TABLE IF EXISTS public.manager_overrides;
