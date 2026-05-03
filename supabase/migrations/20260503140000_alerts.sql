-- Phase 3.1: alert_rules + alerts — KPI threshold monitoring

-- ============================================================
-- a. alert_rules
-- ============================================================

CREATE TABLE public.alert_rules (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric     TEXT        NOT NULL CHECK (metric IN (
                           'prep_completion_rate',
                           'checklist_completion_rate',
                           'fc_percent',
                           'active_recipes'
                         )),
  threshold  NUMERIC     NOT NULL,
  operator   TEXT        NOT NULL CHECK (operator IN ('lt','gt','lte','gte')),
  severity   TEXT        NOT NULL DEFAULT 'warning'
                         CHECK (severity IN ('info','warning','critical')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, metric, operator, threshold)
);

CREATE INDEX idx_alert_rules_tenant_active
  ON public.alert_rules(tenant_id)
  WHERE active = true;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_rules_select_member"
  ON public.alert_rules FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "alert_rules_insert_manager"
  ON public.alert_rules FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND public.user_role_in(tenant_id) IN ('owner', 'manager')
  );

CREATE POLICY "alert_rules_update_manager"
  ON public.alert_rules FOR UPDATE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'))
  WITH CHECK (public.user_role_in(tenant_id) IN ('owner', 'manager'));

CREATE POLICY "alert_rules_delete_manager"
  ON public.alert_rules FOR DELETE
  USING (public.user_role_in(tenant_id) IN ('owner', 'manager'));

-- ============================================================
-- b. alerts — fired alert instances
-- ============================================================

CREATE TABLE public.alerts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id          UUID        REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  metric           TEXT        NOT NULL,
  value            NUMERIC     NOT NULL,
  threshold        NUMERIC     NOT NULL,
  severity         TEXT        NOT NULL CHECK (severity IN ('info','warning','critical')),
  message          TEXT        NOT NULL,
  acknowledged     BOOLEAN     NOT NULL DEFAULT false,
  acknowledged_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at  TIMESTAMPTZ,
  fired_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  date             DATE        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_tenant_date
  ON public.alerts(tenant_id, date, acknowledged);

CREATE INDEX idx_alerts_tenant_unacked
  ON public.alerts(tenant_id)
  WHERE acknowledged = false;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select_member"
  ON public.alerts FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Only service role (Inngest) inserts alerts; members can acknowledge
CREATE POLICY "alerts_insert_manager"
  ON public.alerts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "alerts_update_member"
  ON public.alerts FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- Rollback:
-- DROP TABLE IF EXISTS public.alerts;
-- DROP TABLE IF EXISTS public.alert_rules;
