# Phase 7 — Marketman + Actual Food Cost + Statistical Forecast

> **Covers:** Steps 7.1–7.5. Marketman inventory integration, actual FC engine (theoretical vs real), shrinkage analysis, statistical forecast replacing SimpleAverageProvider.

> 🔥 **Most critical phase commercially.** FC accuracy determines if the product sells.

> ⚠️ **Before starting:** Confirm Marketman API credentials in `.env.local`. If not available → MockInventoryAdapter with ComingSoonBadge.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
```

Expected: Phase 6 complete. Financial dashboard, OCR, Sumit all working.

---

# Step 7.1 — Marketman Adapter

## Division of labor

**Claude Code:** adapter, schema, sync job, mock adapter.

## Task 1 — Marketman Adapter (Claude Code)

### Context to load

- `ARCHITECTURE.md` §8 (Adapter Pattern)
- `src/adapters/types.ts`

### Prompt for Claude Code

Create Marketman inventory adapter.

Requirements:

1. Create `src/adapters/marketman/api.ts` — InventoryAdapter:
   - Base URL: `https://api.marketman.com/v3`
   - Auth: API key in header
   - `fetchInventoryLevels()` → map to `InventoryLevel[]`
   - `fetchPurchaseOrders({ status? })` → map to `PurchaseOrder[]`
   - `pushReceipt(receipt)` → optional, only if Marketman supports it

2. Types for Marketman responses:

```typescript
interface MarketmanInventoryItem {
  GUID: string;
  Name: string;
  UnitType: string;
  Quantity: number;
  Cost: number;
}
```

3. Map Marketman items → internal ingredients:
   - Match by name (fuzzy) or by saved `external_id`
   - Store `marketman_item_guid` on `ingredients` table:
     ```sql
     -- migration: {timestamp}_marketman_link.sql
     ALTER TABLE ingredients ADD COLUMN marketman_guid TEXT;
     CREATE INDEX idx_ingredients_marketman ON ingredients(tenant_id, marketman_guid);
     ```

4. Create `src/adapters/mock/mock-inventory.ts` — MockInventoryAdapter:
   - Returns realistic inventory levels for 50 ingredients
   - Costs match seeded ingredient data ±10%

5. Inngest sync job `inngest/functions/sync-marketman.ts`:
   - Cron: `0 3 * * *` (06:00 IST)
   - Fetch inventory levels → update ingredient costs if changed > 5%
   - Fetch purchase orders → create goods_receipts in `pending` status

6. Tests `tests/adapters/marketman.test.ts`:
   - Correct mapping of Marketman format to internal types
   - Cost update only fires when change > 5% (to avoid noise)
   - At least 5 tests

### Validation

- [ ] Migration clean
- [ ] Mock adapter returns plausible inventory data
- [ ] Sync updates ingredient costs
- [ ] `pnpm test` green

### Commit

`feat(marketman): Marketman adapter, mock adapter, sync job`

---

# Step 7.2 — Actual Food Cost Engine

## Division of labor

**Claude Code:** actual FC calculator, shrinkage engine, AI insight, Lovable prompt.
**Lovable:** actual FC dashboard, shrinkage drill-down.

## Task 1 — Actual FC Calculator (Claude Code)

### Context to load

- `ARCHITECTURE.md` §12 (Food Cost Stage B)
- `src/lib/food-cost/calculator.ts`
- `src/lib/actions/inventory.ts`

### Prompt for Claude Code

Build the actual Food Cost engine.

Requirements:

1. Create `src/lib/food-cost/actual-fc.ts`:

```typescript
export interface ActualFCPeriod {
  from: Date;
  to: Date;
  openingInventoryCents: number;
  closingInventoryCents: number;
  purchasesCents: number;
  actualConsumptionCents: number;
  theoreticalConsumptionCents: number;
  shrinkageCents: number;
  shrinkagePercent: number;
  actualFCPercent: number;
  theoreticalFCPercent: number;
  byCategory: Record<
    string,
    {
      shrinkageCents: number;
      shrinkagePercent: number;
    }
  >;
  byIngredient: {
    ingredientId: string;
    nameHe: string;
    theoreticalQty: number;
    actualQty: number;
    variance: number;
    variancePercent: number;
    costCents: number;
  }[];
}

export async function computeActualFC(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<ActualFCPeriod>;
```

Formula:

```
Opening inventory (snapshot at `from`)
+ Purchases (goods_receipts approved in period)
- Closing inventory (snapshot at `to`)
= Actual consumption

Theoretical consumption = sum(sale_items × recipe_cost) in period

Shrinkage = actual - theoretical
Shrinkage % = shrinkage / actual × 100
```

2. Inngest job `inngest/functions/fc-actual-compute.ts`:
   - Event-triggered: `fc/inventory-count.completed`
   - Fired after each inventory count is saved
   - Computes actual FC for period since last count

3. Create prompt `prompts/fc-insight/v1.md`:

```
אתה יועץ פיננסי למסעדות. קיבלת נתוני Food Cost:

FC תיאורטי: {theoretical}%
FC בפועל: {actual}%
Shrinkage: {shrinkage}% ({shrinkage_ils}₪)
קטגוריות עם shrinkage גבוה: {top_categories}
מרכיבים עם פער גדול: {top_ingredients}

כתוב בעברית (80-100 מילה) תובנה אחת ממוקדת + המלצה אחת פעולה ספציפית.
```

4. `src/lib/actions/ai-fc-insight.ts`:
   - `generateFCInsight(tenantId, userId, actualFC)` → AI insight text

5. Tests `tests/food-cost/actual-fc.test.ts`:
   - Correct shrinkage with known data
   - Zero shrinkage when actual = theoretical
   - Correct category breakdown
   - At least 8 tests

### Validation

- [ ] `computeActualFC` returns correct values for seeded test data
- [ ] Shrinkage % correct with manual verification
- [ ] AI insight generated
- [ ] `pnpm test` green

### Commit

`feat(food-cost): actual FC engine with shrinkage calculation and AI insight`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-7-actual-fc.md`.

Update **`/financial/food-cost` page** to show:

1. **Two FC numbers** (side by side):
   - "FC תיאורטי: 30.2%" (green)
   - "FC בפועל: 33.8%" (yellow/red)
   - "פער (Shrinkage): 3.6%" (alert if > 3%)

2. **Shrinkage drill-down**:
   - By category bar chart
   - By ingredient table: מרכיב, צפוי, בפועל, פער, עלות פער
   - Sort by cost impact descending

3. **AI insight card**:
   - "תובנת AI" section
   - Insight text + "רענן תובנה" button
   - Last generated timestamp

4. **Period selector**: between two inventory counts

After Lovable: wire all to actual FC engine.

### Commit

`feat(food-cost): actual FC UI with shrinkage drill-down`

---

# Step 7.3 — Statistical Forecast Provider

## Task 1 — StatisticalForecastProvider (Claude Code)

### Context to load

- `ARCHITECTURE.md` §11 (Forecast Engine)
- `src/lib/forecast/simple-average.ts`

### Prompt for Claude Code

Replace SimpleAverageProvider with StatisticalForecastProvider.

Requirements:

1. Create `src/lib/forecast/statistical-provider.ts`:

```typescript
export class StatisticalForecastProvider implements ForecastProvider {
  name = 'statistical' as const;

  async forecastDay(params: { tenantId: string; date: Date; menuItemId: string }) {
    // 1. Base: weighted average of last 8 same-day-of-week
    //    Recent weeks weighted heavier: [1, 1, 1.5, 1.5, 2, 2, 3, 3]
    // 2. σ (std dev) of the 8 samples
    // 3. Z-score coloring: < 1σ = green, 1-2σ = yellow, > 2σ = red
    // 4. Holiday adjustment: if Israeli holiday on date → apply multiplier
    // 5. Seasonality factor from tenant settings
    // 6. OnTopo events (if connected): expected covers / avg covers ratio
    // 7. Manual override (from prep_events table)

    return {
      quantity: Math.round(finalQty),
      confidence: stdDev < baseline * 0.1 ? 'high' : stdDev < baseline * 0.2 ? 'medium' : 'low',
      breakdown: {
        baseline,
        stdDev,
        zScore,
        holidayMultiplier,
        seasonality,
        eventAdjustment,
        manualOverride,
      },
    };
  }
}
```

2. Create `src/lib/forecast/israeli-holidays.ts`:
   - List of Israeli holidays (static, 2025–2027)
   - Each with default multiplier (Rosh Hashana: 0.7 prep day before, 1.2 holiday itself, etc.)
   - Tenant can override multipliers in settings

3. Outlier detection:
   - `detectOutliers(samples: number[])` → flag samples > 2σ from mean
   - Outliers excluded from baseline calculation

4. Update Inngest prep job to use `StatisticalForecastProvider` instead of `SimpleAverageProvider`.

5. A/B tracking: log both providers' prediction for each item → compare to actual after the day.

6. Tests `tests/forecast/statistical.test.ts`:
   - Weighted average correct with known samples
   - Outlier excluded from baseline
   - Holiday multiplier applied
   - Std dev calculation correct
   - At least 10 tests

### Validation

- [ ] `StatisticalForecastProvider` used in prep generation
- [ ] Holiday multipliers applied on correct dates
- [ ] Outliers excluded
- [ ] A/B tracking logs both predictions
- [ ] `pnpm test` green

### Commit

`feat(forecast): StatisticalForecastProvider with holidays, outlier detection, A/B tracking`

---

# Step 7.4 — Forecast UI + Integration with Prep

## Task 1 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-7-forecast.md`.

Build **`/[tenantSlug]/forecast` page**:

1. **7-day forecast table**:
   - Rows: menu items (grouped by category)
   - Columns: today + 6 days
   - Each cell: quantity + confidence color (green/yellow/red)
   - Tap cell → drawer with breakdown (baseline, σ, holiday, event)

2. **Forecast accuracy widget** (last 30 days):
   - MAPE % per item
   - Overall MAPE
   - "vs SimpleAverage" comparison

3. **Holiday calendar** (sidebar):
   - Upcoming Israeli holidays next 30 days
   - Override multiplier per holiday

4. **Σ threshold settings** (tenant settings):
   - "סף ירוק/כתום/אדום" sliders

After Lovable:

1. Wire 7-day forecast to `StatisticalForecastProvider`.
2. Wire accuracy to A/B tracking table.
3. Wire holiday overrides to `israeli-holidays.ts`.
4. Update prep page: show quantity source ("תחזית" badge vs "עקיפה ידנית").

### Commit

`feat(forecast): forecast UI, accuracy tracking, holiday overrides`

---

# Step 7.5 — Accuracy Validation + Polish

## Task 1 — Validation + E2E (Claude Code)

### Prompt for Claude Code

Validate forecast accuracy and complete Phase 7.

Requirements:

1. Create `src/lib/forecast/accuracy-report.ts`:
   - `computeMAPE(tenantId, from, to)` → Mean Absolute Percentage Error
   - Compare forecasted qty vs actual (from sale_items)
   - Target: MAPE < 20%

2. If MAPE > 30% after 30 days of data → alert owner with recommendation to check outliers.

3. E2E `tests/e2e/phase7.spec.ts`:
   - Marketman sync updates ingredient costs
   - Actual FC computed after inventory count
   - Shrinkage > 3% creates alert
   - Forecast 7-day table loads with colors
   - AI insight generated for FC report

4. Performance: forecast page with 50 items × 7 days < 3s.

### Commit

`test(phase7): accuracy validation, E2E tests`

---

## End of Phase 7

Phase 7 Definition of Done:

- [ ] Actual FC verified across 3 consecutive weekly counts
- [ ] Shrinkage actionable with ingredient drill-down
- [ ] Forecast MAPE < 20% on available data
- [ ] Prep quantities use statistical forecast
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green

Read `TIMELINE.md`. Next is Phase 8. Check if `PHASE-8-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
