-- Phase 3.1: checklists + checklist_items + checklist_completions

-- ============================================================
-- a. checklists
-- ============================================================

CREATE TABLE public.checklists (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  shift      TEXT        NOT NULL CHECK (shift IN ('morning','afternoon','evening','night')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklists_tenant_shift
  ON public.checklists(tenant_id, shift)
  WHERE active = true;

CREATE TRIGGER checklists_set_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_select_member"
  ON public.checklists FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "checklists_insert_manager"
  ON public.checklists FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND public.user_role_in(tenant_id) IN ('owner', 'manager')
  );

CREATE POLICY "checklists_update_manager"
  ON public.checklists FOR UPDATE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'))
  WITH CHECK (public.user_role_in(tenant_id) IN ('owner', 'manager'));

CREATE POLICY "checklists_delete_owner"
  ON public.checklists FOR DELETE
  USING (public.user_role_in(tenant_id) = 'owner');

-- ============================================================
-- b. checklist_items
-- ============================================================

CREATE TABLE public.checklist_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  checklist_id UUID        NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  text         TEXT        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_checklist
  ON public.checklist_items(checklist_id, sort_order);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select_member"
  ON public.checklist_items FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "checklist_items_insert_manager"
  ON public.checklist_items FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND public.user_role_in(tenant_id) IN ('owner', 'manager')
  );

CREATE POLICY "checklist_items_update_manager"
  ON public.checklist_items FOR UPDATE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'))
  WITH CHECK (public.user_role_in(tenant_id) IN ('owner', 'manager'));

CREATE POLICY "checklist_items_delete_manager"
  ON public.checklist_items FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

-- ============================================================
-- c. checklist_completions
-- ============================================================

CREATE TABLE public.checklist_completions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  checklist_id     UUID        NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  completion_date  DATE        NOT NULL,
  completed_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  signature_url    TEXT,
  completed_items  TEXT[]      NOT NULL DEFAULT '{}',
  notes            TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','partial','completed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (checklist_id, completion_date)
);

CREATE INDEX idx_checklist_completions_tenant_date
  ON public.checklist_completions(tenant_id, completion_date);

CREATE TRIGGER checklist_completions_set_updated_at
  BEFORE UPDATE ON public.checklist_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_completions_select_member"
  ON public.checklist_completions FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "checklist_completions_insert_member"
  ON public.checklist_completions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "checklist_completions_update_member"
  ON public.checklist_completions FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- Rollback:
-- DROP TABLE IF EXISTS public.checklist_completions;
-- DROP TABLE IF EXISTS public.checklist_items;
-- DROP TABLE IF EXISTS public.checklists;
