# Phase 3 — Inventory, Counts, Waste, Daily FC

> **Covers:** Steps 3.1–3.5. Closed inventory loop: counts from mobile, waste tracking, manual receipts, theoretical FC daily job.

---

## Pre-flight check (run before ANY task in this phase)

```
git log --oneline -5
pnpm db:test
pnpm typecheck
pnpm lint
```

Expected: Phase 2 complete. Prep + checklists working. All E2E tests pass.

---

# Step 3.1 — Inventory Schema + Mobile Count UI

## Division of labor

**Claude Code:** schema, Server Actions, autosave logic, tests, Lovable prompt.
**Lovable:** mobile count UI, category tabs, per-row save indicator.

## Task 1 — Schema + Server Actions (Claude Code)

### Context to load

- `ARCHITECTURE.md` §5 (inventory_snapshots, waste_events, goods_receipts)

### Prompt for Claude Code

Create inventory schema and Server Actions.

Requirements:

1. Migration `{timestamp}_inventory.sql`:

```sql
CREATE TABLE inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  qty_expected NUMERIC,
  qty_counted NUMERIC,
  variance NUMERIC GENERATED ALWAYS AS (
    CASE WHEN qty_counted IS NOT NULL AND qty_expected IS NOT NULL
    THEN qty_counted - qty_expected ELSE NULL END
  ) STORED,
  count_date DATE NOT NULL,
  counted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ingredient_id, count_date)
);

CREATE TABLE waste_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'spoilage', 'over-prep', 'spillage', 'returned-dish', 'staff-meal', 'other'
  )),
  reason_notes TEXT,
  reported_by UUID REFERENCES auth.users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_he TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  default_delivery_days TEXT[],
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  invoice_number TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  total_cents INT,
  approved_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'disputed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id),
  qty NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit_cents INT NOT NULL,
  total_cents INT GENERATED ALWAYS AS (
    (cost_per_unit_cents * qty)::int
  ) STORED
);

-- Indexes
CREATE INDEX idx_inventory_snapshots_tenant_date ON inventory_snapshots(tenant_id, count_date);
CREATE INDEX idx_waste_events_tenant_date ON waste_events(tenant_id, occurred_at);
CREATE INDEX idx_goods_receipts_tenant ON goods_receipts(tenant_id, received_at DESC);

-- RLS on all tables (standard tenant policies)
```

2. Create `src/lib/actions/inventory.ts`:
   - `getIngredientsForCount(tenantId, category?)` → ingredients with last snapshot
   - `saveCountRow(tenantId, ingredientId, date, qtyCounted, notes?)` → upsert snapshot (autosave)
   - `getCountForDate(tenantId, date)` → all snapshots for a date
   - `getVarianceReport(tenantId, date)` → snapshots with variance > threshold
   - `computeExpectedQty(tenantId, ingredientId, date)` → last count + receipts - theoretical consumption

3. Create `src/lib/actions/waste.ts`:
   - `reportWaste(tenantId, data)` → create waste_event
   - `getWasteReport(tenantId, from, to)` → grouped by ingredient + reason
   - `getWasteToday(tenantId)` → today's waste events

4. Create `src/lib/actions/receipts.ts`:
   - `createReceipt(tenantId, data)` → new goods_receipt + lines
   - `approveReceipt(tenantId, receiptId)` → updates status + ingredient costs + inventory
   - `getReceipts(tenantId, status?)` → list with supplier info

5. Tests `tests/inventory/`:
   - `count-actions.test.ts` — autosave upsert works, variance computed
   - `expected-qty.test.ts` — correct qty expected after receipts and consumption
   - At least 8 tests

### Validation

- [ ] Migration clean
- [ ] `saveCountRow` called twice → upserts, no duplicate
- [ ] `computeExpectedQty` returns correct value with known test data
- [ ] `pnpm test` green

### Commit

`feat(inventory): schema, Server Actions for counts, waste, receipts`

### Branch

`feat/phase-3-step-1-task-1`

---

## Task 2 — Write Lovable Prompt (Claude Code)

Save to `prompts/lovable/phase-3-inventory-count.md`.

Build:

1. **`/[tenantSlug]/inventory/count` page** — mobile count screen:
   - Date selector (default today)
   - Category tabs: "הכל" | "ירקות" | "בשר/דגים" | "חלבי" | "יבש" | "אלכוהול"
   - List of ingredients per category:
     - Name (large Hebrew)
     - Expected qty (gray): "צפוי: 5.2 ק"ג"
     - Number input for counted qty (large, numeric keyboard)
     - Unit label
     - Save indicator: gray dot → green checkmark after save
     - Notes field (expandable)
   - Auto-save on blur (no save button needed)
   - Progress: "32/80 מרכיבים נספרו"
   - "סיים ספירה" button at bottom

2. **`/[tenantSlug]/inventory/snapshot` page** — variance view:
   - Table: מרכיב, צפוי, נספר, פער, %פער
   - Color: green if |variance| < 5%, yellow 5-15%, red > 15%
   - Filter: "הכל" | "חריגות בלבד"
   - "סמן כפסולת" action per row

### ⏸ PAUSE — Lovable builds inventory count UI.

## Task 3 — Wire + Fix (Claude Code)

1. Wire count screen to `saveCountRow` (autosave on blur).
2. Wire snapshot page to `getVarianceReport`.
3. Anomaly detection (Haiku): after count saved, if variance > 15% call AI:
   - Task type: `inventory.anomaly_suggestion`
   - Prompt: "מרכיב X: צפוי 10ק"ג, נספר 6ק"ג. הצע סיבה אפשרית בעברית קצרה."
   - Show suggestion as tooltip on variance row
4. E2E test: count 5 ingredients → verify snapshots in DB → check variance colors.

### Validation

- [ ] Count auto-saves without button
- [ ] Variance colors correct
- [ ] AI anomaly suggestion appears for > 15% variance
- [ ] Mobile usable on 375px

### Commit

`feat(inventory): wire count UI, variance display, AI anomaly suggestions`

### Branch

`feat/phase-3-step-1-task-3`

---

# Step 3.2 — Waste Tracking

## Division of labor

**Claude Code:** waste report queries, AI detection, Lovable prompt.
**Lovable:** fast waste entry UI, reason picklist, weekly report.

## Task 1 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-3-waste.md`.

Build:

1. **`/[tenantSlug]/waste` page** — fast entry:
   - "דיווח Waste חדש" button → modal:
     - Ingredient selector (combobox, search)
     - Qty + unit
     - Reason: 6 large tap-target buttons (spoilage/over-prep/spillage/returned-dish/staff-meal/other)
     - Notes (optional)
     - "דווח" button
   - Today's waste feed (list of events)
   - Weekly summary: "שבוע זה: ₪1,230 waste"

2. **Waste report widget** on owner dashboard:
   - Top 5 waste items this week
   - Trend vs last week

After Lovable:

1. Wire entry form to `reportWaste`.
2. Wire today's feed to `getWasteToday`.
3. AI repeat detection (Haiku): if same ingredient wasted 3+ times in 7 days:
   - Show alert: "תשומת לב: [מרכיב] דווח כפסולת 4 פעמים השבוע"
4. E2E test: report 3 waste events → verify in DB.

### Validation

- [ ] Waste entry works from mobile
- [ ] Repeat alert fires after 3rd waste of same ingredient
- [ ] Weekly cost accurate

### Commit

`feat(waste): waste tracking UI, AI repeat detection`

---

# Step 3.3 — Manual Goods Receipts

## Division of labor

**Claude Code:** receipt approval logic, cost update pipeline, Lovable prompt.
**Lovable:** receipt list, create receipt form, approve UI.

## Task 1 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-3-receipts.md`.

Build:

1. **`/[tenantSlug]/inventory/receipts` page**:
   - List: supplier, invoice #, date, total, status badge
   - "קליטת סחורה חדשה" button

2. **Create receipt form** (full page, not modal — many line items):
   - Supplier selector + "ספק חדש" option
   - Invoice number + date
   - Line items table:
     - Ingredient selector (combobox)
     - Qty + unit
     - Cost per unit (₪)
     - Total auto-calculated
   - "הוסף שורה" button
   - Grand total
   - "שמור לאישור" button

3. **Approve receipt UI** (manager/owner):
   - Review lines
   - Edit if needed
   - "אשר קליטה" → updates ingredient costs + inventory

After Lovable:

1. Wire create to `createReceipt`.
2. Wire approve to `approveReceipt` — this updates `current_cost_per_unit_cents` on ingredients.
3. After approval: trigger `food_cost.recompute` Inngest event.
4. E2E: create receipt, approve, verify ingredient cost updated.

### Validation

- [ ] Receipt created with correct lines
- [ ] Approval updates ingredient cost in DB
- [ ] FC recompute job triggered

### Commit

`feat(receipts): manual goods receipt with approval pipeline`

---

# Step 3.4 — FC Engine Stage A (Daily Job)

## Task 1 — Daily FC Inngest Job (Claude Code)

### Prompt for Claude Code

Build the daily Food Cost computation job.

Requirements:

1. Create `src/lib/food-cost/daily-snapshot.ts`:

```typescript
export interface DailyFCSnapshot {
  tenantId: string;
  date: Date;
  revenueCents: number; // from sales (Phase 4 — 0 for now)
  theoreticalCostCents: number;
  fcPercent: number;
  topCostItems: { menuItemId: string; costCents: number }[];
}

export async function computeDailyFC(tenantId: string, date: Date): Promise<DailyFCSnapshot>;
```

2. Create migration `{timestamp}_daily_fc_snapshots.sql`:

```sql
CREATE TABLE daily_fc_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  revenue_cents INT NOT NULL DEFAULT 0,
  theoretical_cost_cents INT NOT NULL DEFAULT 0,
  fc_percent NUMERIC(5,2),
  top_cost_items JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date)
);
CREATE INDEX idx_daily_fc_tenant_date ON daily_fc_snapshots(tenant_id, snapshot_date DESC);
```

3. Create Inngest job `inngest/functions/fc-recompute.ts`:
   - Cron: `0 3 * * *` (06:00 IST = 03:00 UTC)
   - For each tenant: compute yesterday's FC → upsert to `daily_fc_snapshots`
   - Also triggered by event `fc/recompute.requested` (from receipt approval)

4. Alert if FC > tenant target:
   - Add `fc_target_percent NUMERIC` to `tenants` table (default 32.0)
   - After compute: if fcPercent > target + 2 → create alert

5. Tests `tests/food-cost/daily-snapshot.test.ts`:
   - Correct computation with known menu items and costs
   - Alert created when over target
   - At least 6 tests

### Validation

- [ ] Job runs manually via test endpoint
- [ ] Snapshot saved to DB
- [ ] Alert created if FC > target
- [ ] `pnpm test` green

### Commit

`feat(food-cost): daily FC snapshot job with alerts`

---

# Step 3.5 — FC Dashboard + 30-day Trend

## Task 1 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-3-fc-dashboard.md`.

Build:

1. **FC section on owner dashboard** (upgrade existing):
   - Today's FC% card (large, color-coded)
   - Target line: "יעד: 32%"
   - 30-day sparkline chart (recharts)

2. **`/[tenantSlug]/financial/food-cost` page**:
   - 30-day bar chart: FC% per day
   - Target line overlay
   - Summary: avg FC%, best day, worst day
   - Table: date, revenue, cost, FC%, vs target
   - Alert list: days > target

After Lovable:

1. Wire chart to `daily_fc_snapshots` data.
2. Wire alerts to alert system.
3. E2E: generate FC snapshots for 7 days → verify chart shows correct data.

### Validation

- [ ] Chart renders with real data
- [ ] Target line visible
- [ ] Days over target highlighted in red

### Commit

`feat(food-cost): FC dashboard with 30-day trend chart`

---

## End of Phase 3

Phase 3 Definition of Done:

- [ ] Weekly count of 80 ingredients takes < 30 min
- [ ] Waste reported in seconds from mobile
- [ ] Receipt approval updates ingredient costs
- [ ] Daily FC job runs and snapshots stored
- [ ] 30-day trend chart renders
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean

Read `TIMELINE.md`. Next is Phase 4. Check if `PHASE-4-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
