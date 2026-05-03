-- Phase 3.1: inventory_snapshots, waste_events, suppliers, goods_receipts, goods_receipt_lines

CREATE TABLE public.inventory_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingredient_id   UUID        NOT NULL REFERENCES public.ingredients(id),
  qty_expected    NUMERIC,
  qty_counted     NUMERIC,
  variance        NUMERIC GENERATED ALWAYS AS (
    CASE WHEN qty_counted IS NOT NULL AND qty_expected IS NOT NULL
    THEN qty_counted - qty_expected ELSE NULL END
  ) STORED,
  count_date      DATE        NOT NULL,
  counted_by      UUID        REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ingredient_id, count_date)
);

CREATE TABLE public.waste_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingredient_id UUID        NOT NULL REFERENCES public.ingredients(id),
  qty           NUMERIC     NOT NULL CHECK (qty > 0),
  unit          TEXT        NOT NULL,
  reason        TEXT        NOT NULL CHECK (reason IN (
    'spoilage', 'over-prep', 'spillage', 'returned-dish', 'staff-meal', 'other'
  )),
  reason_notes  TEXT,
  reported_by   UUID        REFERENCES auth.users(id),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name_he              TEXT        NOT NULL,
  contact_phone        TEXT,
  contact_email        TEXT,
  default_delivery_days TEXT[],
  active               BOOLEAN     NOT NULL DEFAULT true
);

CREATE TABLE public.goods_receipts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id    UUID        REFERENCES public.suppliers(id),
  invoice_number TEXT,
  received_at    TIMESTAMPTZ NOT NULL,
  total_cents    INT,
  approved_by    UUID        REFERENCES auth.users(id),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'disputed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goods_receipt_lines (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_id          UUID    NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  ingredient_id       UUID    REFERENCES public.ingredients(id),
  qty                 NUMERIC NOT NULL,
  unit                TEXT    NOT NULL,
  cost_per_unit_cents INT     NOT NULL,
  total_cents         INT GENERATED ALWAYS AS (
    (cost_per_unit_cents * qty)::int
  ) STORED
);

-- Indexes
CREATE INDEX idx_inventory_snapshots_tenant_date
  ON public.inventory_snapshots(tenant_id, count_date);

CREATE INDEX idx_waste_events_tenant_date
  ON public.waste_events(tenant_id, occurred_at);

CREATE INDEX idx_goods_receipts_tenant
  ON public.goods_receipts(tenant_id, received_at DESC);

CREATE INDEX idx_goods_receipt_lines_receipt
  ON public.goods_receipt_lines(receipt_id);

-- RLS
ALTER TABLE public.inventory_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines   ENABLE ROW LEVEL SECURITY;

-- inventory_snapshots
CREATE POLICY "inventory_snapshots_select_member"
  ON public.inventory_snapshots FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "inventory_snapshots_insert_member"
  ON public.inventory_snapshots FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "inventory_snapshots_update_member"
  ON public.inventory_snapshots FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- waste_events
CREATE POLICY "waste_events_select_member"
  ON public.waste_events FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "waste_events_insert_member"
  ON public.waste_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- suppliers
CREATE POLICY "suppliers_select_member"
  ON public.suppliers FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "suppliers_insert_manager"
  ON public.suppliers FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "suppliers_update_manager"
  ON public.suppliers FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- goods_receipts
CREATE POLICY "goods_receipts_select_member"
  ON public.goods_receipts FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "goods_receipts_insert_member"
  ON public.goods_receipts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "goods_receipts_update_member"
  ON public.goods_receipts FOR UPDATE
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

-- goods_receipt_lines
CREATE POLICY "goods_receipt_lines_select_member"
  ON public.goods_receipt_lines FOR SELECT
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "goods_receipt_lines_insert_member"
  ON public.goods_receipt_lines FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
