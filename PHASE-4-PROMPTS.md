# Phase 4 — Tabit + Floor Performance

> **Covers:** Steps 4.1–4.5. Real POS data from Tabit, daily sync, floor performance dashboard, AI daily brief, FC with real sales.

> ⚠️ **Before starting:** Confirm Tabit API access status. If API available → use `TabitApiAdapter`. If CSV only → use `TabitCsvAdapter`. If neither → use `MockPOSAdapter` with `ComingSoonBadge`. Update `tenant_integrations` accordingly.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
```

Expected: Phase 3 complete. Inventory, waste, receipts, daily FC all working.

---

# Step 4.1 — Tabit Adapter + Sales Schema

## Division of labor

**Claude Code:** adapter, schema, sync job, tests.
**Lovable:** integrations settings UI.

## Task 1 — Sales Schema (Claude Code)

### Context to load

- `ARCHITECTURE.md` §8 (Adapter Pattern), §9 (Scrapers)
- `src/adapters/types.ts`
- `docs/adr/0005-playwright-scraping.md`
- `docs/adr/0009-adapter-pattern.md`

### Prompt for Claude Code

Create sales schema and Tabit adapter.

Requirements:

1. Migration `{timestamp}_sales.sql`:

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_external_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  table_number TEXT,
  server_external_id TEXT,
  total_cents INT NOT NULL,
  raw_payload JSONB,
  UNIQUE (tenant_id, pos_external_id)
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  pos_item_name TEXT,
  qty INT NOT NULL,
  unit_price_cents INT NOT NULL,
  comp_reason TEXT
);

CREATE TABLE pos_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_external_id TEXT NOT NULL,
  name_he TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (tenant_id, pos_external_id)
);

CREATE INDEX idx_sales_tenant_date ON sales(tenant_id, occurred_at DESC);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sales_server ON sales(tenant_id, server_external_id, occurred_at);
-- RLS on all tables
```

2. Create `src/adapters/tabit/index.ts` — router:

```typescript
export function getTabitAdapter(config: TenantIntegration): POSAdapter {
  switch (config.mode) {
    case 'api':
      return new TabitApiAdapter(config);
    case 'csv':
      return new TabitCsvAdapter(config);
    case 'scrape':
      return new TabitScrapeAdapter(config);
    default:
      return new MockPOSAdapter();
  }
}
```

3. Create `src/adapters/tabit/csv.ts` — CSV import adapter:
   - `fetchSales({ from, to })` → parses uploaded CSV
   - `fetchMenuItems()` → from CSV export
   - `fetchServers()` → from CSV export
   - CSV columns per Tabit export format (research or hardcode common format)

4. Create `src/adapters/mock/mock-pos.ts` — MockPOSAdapter:
   - Returns realistic Hebrew demo data (10 sales, 5 servers, 30 menu items)
   - Used when no real integration configured
   - Logged to Axiom with `is_mock: true`

5. Create `src/lib/actions/sales.ts`:
   - `getSalesByDate(tenantId, date)` → sales with items
   - `getSalesSummary(tenantId, from, to)` → total revenue, covers, avg check
   - `getServerPerformance(tenantId, from, to)` → per-server stats
   - `upsertSales(tenantId, sales[])` → bulk upsert from adapter

6. Tests `tests/adapters/tabit-csv.test.ts`:
   - Parse valid CSV → correct sales array
   - Duplicate pos_external_id → upsert, no duplicate
   - At least 5 tests

### Validation

- [ ] Migration clean
- [ ] Mock adapter returns demo data
- [ ] `upsertSales` with 10 rows → 10 in DB, second run → still 10 (idempotent)
- [ ] `pnpm test` green

### Commit

`feat(tabit): sales schema, Tabit adapter (CSV + mock), sales Server Actions`

### Branch

`feat/phase-4-step-1-task-1`

---

## Task 2 — Daily Sync Job + Health Check (Claude Code)

### Prompt for Claude Code

Create Inngest sync job for Tabit data.

Requirements:

1. Create `inngest/functions/sync-tabit.ts`:

```typescript
export const syncTabit = inngest.createFunction(
  { id: 'sync-tabit', retries: 3 },
  [
    { cron: '0 1 * * *' }, // 04:00 IST daily
    { event: 'sync/tabit.requested' },
  ],
  async ({ event, step }) => {
    const tenants = await step.run('get-tenants', () => getTenantsWithIntegration('tabit'));
    for (const tenant of tenants) {
      await step.run(`sync-${tenant.id}`, async () => {
        const adapter = getTabitAdapter(tenant.tabItConfig);
        const yesterday = subDays(new Date(), 1);
        const sales = await adapter.fetchSales({
          from: startOfDay(yesterday),
          to: endOfDay(yesterday),
        });
        await upsertSales(tenant.id, sales);
        await updateIntegrationLastSync(tenant.id, 'tabit');
      });
    }
  },
);
```

2. Create `inngest/functions/integration-health.ts`:
   - Cron: every hour
   - For each active integration: call `adapter.healthCheck()`
   - If 3 consecutive failures → mark as `failing`, send alert to owner

3. Create `src/lib/actions/integrations.ts`:
   - `getIntegrationStatus(tenantId)` → list with status, last_sync, error
   - `triggerManualSync(tenantId, provider)` → sends Inngest event
   - `updateIntegrationCredentials(tenantId, provider, credentials)` → saves to Vault

### Validation

- [ ] Sync job runs manually and upserts sales
- [ ] Health check marks failing after 3 errors
- [ ] Manual sync trigger works from `/settings/integrations`

### Commit

`feat(tabit): daily sync job with health monitoring`

### Branch

`feat/phase-4-step-1-task-2`

---

## Task 3 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-4-integrations.md`.

Build **`/[tenantSlug]/settings/integrations` page**:

- Card per integration: Tabit, OnTopo, Sumit, Marketman
- Status badge: active (green) / failing (red) / inactive (gray) / coming-soon (yellow)
- Last sync timestamp
- "סנכרן עכשיו" button (manual trigger)
- "הגדרות" → credentials form per integration
- ComingSoonBadge on OnTopo if not connected

After Lovable: wire status, manual sync, credential save.

### Commit

`feat(integrations): integrations settings page with sync controls`

---

# Step 4.2 — Floor Performance Dashboard

## Task 1 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-4-floor.md`.

Build **`/[tenantSlug]/floor-performance` page**:

1. **Summary row** (KPI cards):
   - סה"כ מכירות אתמול: ₪X,XXX
   - ממוצע לשולחן: ₪XXX
   - מספר כיסויים: XXX
   - % המרה (קינוחים/יין): XX%

2. **Server leaderboard table**:
   - Columns: מלצר, מכירות, ממוצע לשולחן, כיסויים, % יין, % קינוחים
   - Sorted by sales desc
   - Color bar per row (% of top performer)
   - Date range picker: "אתמול" | "שבוע" | "חודש"

3. **30-day trend** (recharts line chart):
   - Revenue per day
   - Covers per day (secondary axis)

4. **ComingSoonBadge** if Tabit not connected (mock data shown with badge).

After Lovable:

1. Wire KPIs to `getSalesSummary`.
2. Wire leaderboard to `getServerPerformance`.
3. Wire chart to 30-day sales data.
4. When Tabit not active → MockPOSAdapter + ComingSoonBadge overlay.

### Commit

`feat(floor): floor performance dashboard with server leaderboard`

---

# Step 4.3 — AI Daily Brief

## Task 1 — Brief Generator + Approval UI (Claude Code)

### Prompt for Claude Code

Build the AI daily brief that managers approve every morning.

Requirements:

1. Create prompt `prompts/daily-brief/v1.md`:

```
אתה מנהל מסעדה ישראלי מנוסה. קבל את נתוני אתמול ועליך לכתוב בריף בוקר קצר ומעורר השראה לצוות.

נתוני קלט:
{sales_summary}
{top_servers}
{prep_completion}
{waste_summary}
{fc_yesterday}

כתוב בריף בעברית (100-150 מילה) הכולל:
1. סיכום קצר של אתמול (גאווה/עידוד)
2. דגש אחד לשיפור
3. יעד ספציפי להיום
4. משפט מסיים מעורר

אל תשתמש בסיסמאות ריקות. היה ספציפי עם המספרים.
```

2. Create `src/lib/actions/daily-brief.ts`:
   - `generateDailyBrief(tenantId, date)` → calls AI Gateway (Sonnet)
   - `saveBriefDraft(tenantId, date, content)` → saves draft
   - `publishBrief(tenantId, briefId)` → marks as published, visible to staff
   - `getTodaysBrief(tenantId)` → published brief for today

3. Create Inngest job: `inngest/functions/daily-brief.ts`:
   - Cron: `30 5 * * *` (08:30 IST)
   - Generate brief for each tenant with sales data
   - Save as draft (not auto-published)

4. Write Lovable prompt `prompts/lovable/phase-4-brief.md`:
   - Manager sees draft brief on dashboard at 08:30
   - Edit textarea (can modify AI draft)
   - "פרסם לצוות" button
   - Staff home page shows published brief prominently

After Lovable: wire generate, save, publish, display.

### Validation

- [ ] Brief generated with real data (or mock)
- [ ] Manager edits and publishes
- [ ] Staff sees published brief on their home page
- [ ] Brief not published without manager approval

### Commit

`feat(brief): AI daily brief with manager approval flow`

---

# Step 4.4 — FC with Real Sales + Reconciliation

## Task 1 — Update FC Engine (Claude Code)

### Prompt for Claude Code

Update the daily FC snapshot job to use real Tabit sales data.

Requirements:

1. Update `computeDailyFC(tenantId, date)`:
   - Revenue: sum from `sales` table (not 0 anymore)
   - Map `sale_items.menu_item_id` → recipe → BOM cost
   - Theoretical cost: sum(qty × recipe_cost) across all sale_items

2. Add reconciliation check:
   - Compare `sum(sales.total_cents)` vs Tabit reported total
   - If discrepancy > 1% → log warning, show in integrations health

3. Update FC dashboard to show:
   - "FC בפועל מבוסס מכירות אמיתיות" (when Tabit connected)
   - "FC מבוסס נתוני Demo" + ComingSoonBadge (when mock)

4. Tests: verify FC with real sales data (use seeded sales).

### Validation

- [ ] FC% computed from real sale_items
- [ ] Reconciliation check runs after sync
- [ ] Discrepancy alert appears if > 1%

### Commit

`feat(food-cost): FC engine uses real Tabit sales data`

---

# Step 4.5 — UAT + Polish

## Task 1 — E2E + Polish (Claude Code)

### Prompt for Claude Code

Complete Phase 4 E2E tests and final polish.

Requirements:

1. E2E tests `tests/e2e/phase4.spec.ts`:
   - Tabit sync runs → sales appear in DB
   - Floor performance shows correct server ranking
   - Daily brief generated and published
   - FC% shows correct value after real sales

2. Manual sync button: confirm idempotent (run twice → no duplicates).

3. Verify ComingSoonBadge appears correctly on all screens when Tabit not connected.

4. Performance: floor performance page loads in < 2s with 30 days of data.

### Commit

`test(phase4): E2E tests, Polish, performance`

---

## End of Phase 4

Phase 4 Definition of Done:

- [ ] Yesterday's sales in system by 09:00 (or mock data visible)
- [ ] Manager approves AI brief in < 5 min
- [ ] Floor performance shows server rankings
- [ ] FC% based on real sales (or clearly marked as demo)
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green

Read `TIMELINE.md`. Next is Phase 5. Check if `PHASE-5-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
