-- ============================================================
-- Phase 3 — Run All Migrations
-- Paste this entire file into Supabase SQL Editor and run.
-- Each section is idempotent (IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. recipe_columns (20260503100000)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_recipe
  ON public.menu_items(recipe_id)
  WHERE recipe_id IS NOT NULL;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS instructions_md TEXT,
  ADD COLUMN IF NOT EXISTS video_url       TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. recipe_versions (20260503110000)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_id   UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  version     INT         NOT NULL,
  change_note TEXT,
  restored_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (recipe_id, version)
);

CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe
  ON public.recipe_versions(recipe_id, version DESC);

ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recipe_versions' AND policyname='recipe_versions_select_member') THEN
    CREATE POLICY "recipe_versions_select_member" ON public.recipe_versions FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recipe_versions' AND policyname='recipe_versions_insert_member') THEN
    CREATE POLICY "recipe_versions_insert_member" ON public.recipe_versions FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.user_role_in(tenant_id) IN ('owner','manager','chef'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recipe_versions' AND policyname='recipe_versions_update_member') THEN
    CREATE POLICY "recipe_versions_update_member" ON public.recipe_versions FOR UPDATE
      USING (tenant_id IN (SELECT public.user_tenant_ids()))
      WITH CHECK (public.user_role_in(tenant_id) IN ('owner','manager','chef'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. prep_tasks (20260503120000)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prep_tasks (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_id    UUID          NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  prep_date    DATE          NOT NULL,
  qty_required NUMERIC(10,3) NOT NULL CHECK (qty_required >= 0),
  qty_actual   NUMERIC(10,3)           CHECK (qty_actual >= 0),
  unit         TEXT          NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','in_progress','done','skipped')),
  notes        TEXT,
  assigned_to  UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recipe_id, prep_date)
);

CREATE INDEX IF NOT EXISTS idx_prep_tasks_tenant_date ON public.prep_tasks(tenant_id, prep_date);
CREATE INDEX IF NOT EXISTS idx_prep_tasks_status      ON public.prep_tasks(tenant_id, prep_date, status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='prep_tasks_set_updated_at') THEN
    CREATE TRIGGER prep_tasks_set_updated_at
      BEFORE UPDATE ON public.prep_tasks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.prep_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prep_tasks' AND policyname='prep_tasks_select_member') THEN
    CREATE POLICY "prep_tasks_select_member" ON public.prep_tasks FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prep_tasks' AND policyname='prep_tasks_insert_member') THEN
    CREATE POLICY "prep_tasks_insert_member" ON public.prep_tasks FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prep_tasks' AND policyname='prep_tasks_update_member') THEN
    CREATE POLICY "prep_tasks_update_member" ON public.prep_tasks FOR UPDATE
      USING (tenant_id IN (SELECT public.user_tenant_ids()))
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prep_tasks' AND policyname='prep_tasks_delete_manager') THEN
    CREATE POLICY "prep_tasks_delete_manager" ON public.prep_tasks FOR DELETE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. checklists (20260503130000)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklists (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  shift      TEXT        NOT NULL CHECK (shift IN ('morning','afternoon','evening','night')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklists_tenant_shift
  ON public.checklists(tenant_id, shift) WHERE active = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='checklists_set_updated_at') THEN
    CREATE TRIGGER checklists_set_updated_at
      BEFORE UPDATE ON public.checklists
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklists' AND policyname='checklists_select_member') THEN
    CREATE POLICY "checklists_select_member" ON public.checklists FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklists' AND policyname='checklists_insert_manager') THEN
    CREATE POLICY "checklists_insert_manager" ON public.checklists FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklists' AND policyname='checklists_update_manager') THEN
    CREATE POLICY "checklists_update_manager" ON public.checklists FOR UPDATE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'))
      WITH CHECK (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklists' AND policyname='checklists_delete_owner') THEN
    CREATE POLICY "checklists_delete_owner" ON public.checklists FOR DELETE
      USING (public.user_role_in(tenant_id) = 'owner');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  checklist_id UUID        NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  text         TEXT        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist
  ON public.checklist_items(checklist_id, sort_order);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_items' AND policyname='checklist_items_select_member') THEN
    CREATE POLICY "checklist_items_select_member" ON public.checklist_items FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_items' AND policyname='checklist_items_insert_manager') THEN
    CREATE POLICY "checklist_items_insert_manager" ON public.checklist_items FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_items' AND policyname='checklist_items_update_manager') THEN
    CREATE POLICY "checklist_items_update_manager" ON public.checklist_items FOR UPDATE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'))
      WITH CHECK (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_items' AND policyname='checklist_items_delete_manager') THEN
    CREATE POLICY "checklist_items_delete_manager" ON public.checklist_items FOR DELETE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.checklist_completions (
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

CREATE INDEX IF NOT EXISTS idx_checklist_completions_tenant_date
  ON public.checklist_completions(tenant_id, completion_date);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='checklist_completions_set_updated_at') THEN
    CREATE TRIGGER checklist_completions_set_updated_at
      BEFORE UPDATE ON public.checklist_completions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_completions' AND policyname='checklist_completions_select_member') THEN
    CREATE POLICY "checklist_completions_select_member" ON public.checklist_completions FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_completions' AND policyname='checklist_completions_insert_member') THEN
    CREATE POLICY "checklist_completions_insert_member" ON public.checklist_completions FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_completions' AND policyname='checklist_completions_update_member') THEN
    CREATE POLICY "checklist_completions_update_member" ON public.checklist_completions FOR UPDATE
      USING (tenant_id IN (SELECT public.user_tenant_ids()))
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. alerts (20260503140000)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric     TEXT        NOT NULL CHECK (metric IN ('prep_completion_rate','checklist_completion_rate','fc_percent','active_recipes')),
  threshold  NUMERIC     NOT NULL,
  operator   TEXT        NOT NULL CHECK (operator IN ('lt','gt','lte','gte')),
  severity   TEXT        NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric, operator, threshold)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant_active
  ON public.alert_rules(tenant_id) WHERE active = true;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_select_member') THEN
    CREATE POLICY "alert_rules_select_member" ON public.alert_rules FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_insert_manager') THEN
    CREATE POLICY "alert_rules_insert_manager" ON public.alert_rules FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_update_manager') THEN
    CREATE POLICY "alert_rules_update_manager" ON public.alert_rules FOR UPDATE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'))
      WITH CHECK (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_delete_manager') THEN
    CREATE POLICY "alert_rules_delete_manager" ON public.alert_rules FOR DELETE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.alerts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id         UUID        REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  metric          TEXT        NOT NULL,
  value           NUMERIC     NOT NULL,
  threshold       NUMERIC     NOT NULL,
  severity        TEXT        NOT NULL CHECK (severity IN ('info','warning','critical')),
  message         TEXT        NOT NULL,
  acknowledged    BOOLEAN     NOT NULL DEFAULT false,
  acknowledged_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  date            DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_date
  ON public.alerts(tenant_id, date, acknowledged);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unacked
  ON public.alerts(tenant_id) WHERE acknowledged = false;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='alerts_select_member') THEN
    CREATE POLICY "alerts_select_member" ON public.alerts FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='alerts_insert_manager') THEN
    CREATE POLICY "alerts_insert_manager" ON public.alerts FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='alerts_update_member') THEN
    CREATE POLICY "alerts_update_member" ON public.alerts FOR UPDATE
      USING (tenant_id IN (SELECT public.user_tenant_ids()))
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. manager_overrides (20260503150000)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.manager_overrides (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type    TEXT        NOT NULL CHECK (entity_type IN ('prep_task')),
  entity_id      UUID        NOT NULL,
  field          TEXT        NOT NULL,
  original_value JSONB       NOT NULL,
  override_value JSONB       NOT NULL,
  reason         TEXT        CHECK (char_length(reason) <= 500),
  overridden_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reverted       BOOLEAN     NOT NULL DEFAULT false,
  reverted_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_overrides_entity
  ON public.manager_overrides(tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_manager_overrides_tenant
  ON public.manager_overrides(tenant_id, created_at DESC);

ALTER TABLE public.manager_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='manager_overrides' AND policyname='manager_overrides_select_member') THEN
    CREATE POLICY "manager_overrides_select_member" ON public.manager_overrides FOR SELECT
      USING (tenant_id IN (SELECT public.user_tenant_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='manager_overrides' AND policyname='manager_overrides_insert_manager') THEN
    CREATE POLICY "manager_overrides_insert_manager" ON public.manager_overrides FOR INSERT
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='manager_overrides' AND policyname='manager_overrides_update_manager') THEN
    CREATE POLICY "manager_overrides_update_manager" ON public.manager_overrides FOR UPDATE
      USING (public.user_role_in(tenant_id) IN ('owner','manager'))
      WITH CHECK (public.user_role_in(tenant_id) IN ('owner','manager'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. storage buckets (20260503160000)
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('recipe-images',         'recipe-images',         true,  5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('checklist-signatures',  'checklist-signatures',  false, 1048576, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='recipe_images_select_public') THEN
    CREATE POLICY "recipe_images_select_public" ON storage.objects FOR SELECT
      USING (bucket_id = 'recipe-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='recipe_images_insert_member') THEN
    CREATE POLICY "recipe_images_insert_member" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'recipe-images' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='recipe_images_delete_owner') THEN
    CREATE POLICY "recipe_images_delete_owner" ON storage.objects FOR DELETE
      USING (bucket_id = 'recipe-images' AND auth.uid() = owner);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='signatures_select_member') THEN
    CREATE POLICY "signatures_select_member" ON storage.objects FOR SELECT
      USING (bucket_id = 'checklist-signatures' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='signatures_insert_member') THEN
    CREATE POLICY "signatures_insert_member" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'checklist-signatures' AND auth.role() = 'authenticated');
  END IF;
END $$;
