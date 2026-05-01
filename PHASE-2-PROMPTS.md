# Phase 2 · Step 2.1 — Prep List: Schema + UI

> **Goal:** Chef opens the prep list every morning, sees what to prepare per station, marks tasks complete, opens recipe card on tap. No forecast yet — quantities are manager-set.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
```

Expected: Phase 1 complete. Menu, recipes, FC report all working.

---

## Division of labor

**Claude Code:** schema, Server Actions, daily prep generation logic, tests, Lovable prompt.
**Lovable:** prep list page, task cards, station toggle, recipe drawer.

---

## Task 1 — Prep Schema + Server Actions (Claude Code)

### Context to load

- `ARCHITECTURE.md` §5 (Data Model — prep_tasks)
- `src/lib/actions/recipes.ts`
- `src/lib/tenant.ts`

### Prompt for Claude Code

Create the prep_tasks schema and all Server Actions.

Requirements:

1. Create migration `{timestamp}_prep_tasks.sql`:

   ```sql
   CREATE TABLE prep_tasks (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     recipe_id UUID NOT NULL REFERENCES recipes(id),
     station TEXT NOT NULL CHECK (station IN ('kitchen', 'pastry', 'bar', 'cold', 'grill')),
     due_date DATE NOT NULL,
     qty_recommended NUMERIC NOT NULL DEFAULT 0,
     qty_actual NUMERIC,
     unit TEXT NOT NULL DEFAULT 'unit',
     status TEXT NOT NULL DEFAULT 'pending'
       CHECK (status IN ('pending', 'in_progress', 'done', 'skipped')),
     completed_by UUID REFERENCES auth.users(id),
     completed_at TIMESTAMPTZ,
     notes TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_prep_tasks_tenant_date ON prep_tasks(tenant_id, due_date);
   CREATE INDEX idx_prep_tasks_station ON prep_tasks(tenant_id, station, due_date);
   ALTER TABLE prep_tasks ENABLE ROW LEVEL SECURITY;
   -- SELECT: all roles
   -- INSERT/UPDATE: owner, manager, chef
   -- DELETE: owner, manager only
   ```

2. Create `src/lib/actions/prep.ts`:
   - `getPrepTasksForDate(tenantId, date, station?)` → tasks with recipe info
   - `createPrepTask(tenantId, data)` → new task
   - `updatePrepTaskStatus(tenantId, taskId, status, qtyActual?)` → mark done/skip
   - `bulkCreatePrepTasks(tenantId, tasks[])` → for daily generation
   - `getPrepSummary(tenantId, date)` → `{ total, done, pending, byStation }`

3. Create `src/lib/prep/daily-generator.ts`:

   ```typescript
   export async function generateDailyPrepTasks(
     tenantId: string,
     date: Date,
     forecastProvider: ForecastProvider, // SimpleAverageProvider for now
   ): Promise<PrepTask[]>;
   ```

   - Gets forecast quantities per menu item for `date`
   - Explodes through recipes to get prep tasks
   - Groups by station
   - Returns task list (does not insert — caller does that)

4. Create `src/lib/forecast/simple-average.ts` — `SimpleAverageProvider`:

   ```typescript
   export class SimpleAverageProvider implements ForecastProvider {
     async forecastDay(params: {
       tenantId: string;
       date: Date;
       menuItemId: string;
     }): Promise<{ quantity: number; confidence: 'low' | 'medium' | 'high' }> {
       // Average of last 4 same-day-of-week from sales table
       // If no sales history → return 0, confidence: 'low'
       // (No sales yet in Phase 2 — will be real in Phase 4 after Tabit)
     }
   }
   ```

5. Write tests `tests/prep/`:
   - `daily-generator.test.ts` — generates correct tasks from known recipe data
   - `prep-actions.test.ts` — CRUD operations
   - At least 8 tests

### Validation

- [ ] Migration applies cleanly with no errors
- [ ] `bulkCreatePrepTasks` inserts correctly
- [ ] `updatePrepTaskStatus('done')` sets `completed_at` and `completed_by`
- [ ] `generateDailyPrepTasks` returns tasks (may be empty if no history yet — that's OK)
- [ ] `pnpm test` green

### Commit

`feat(prep): prep_tasks schema, Server Actions, SimpleAverageProvider`

### Branch

`feat/phase-2-step-1-task-1`

---

## Task 2 — Inngest Daily Prep Job (Claude Code)

### Context to load

- `ARCHITECTURE.md` §10 (Background Jobs)
- `inngest/client.ts`
- `src/lib/prep/daily-generator.ts`

### Prompt for Claude Code

Create the Inngest job that generates prep tasks every morning.

Requirements:

1. Create `inngest/functions/prep-generate.ts`:

   ```typescript
   export const generatePrepTasks = inngest.createFunction(
     {
       id: 'prep-generate',
       retries: 3,
       concurrency: { limit: 5, key: 'event.data.tenantId' },
     },
     { cron: '30 2 * * *' }, // 05:30 IST = 02:30 UTC
     async ({ step }) => {
       const tenants = await step.run('list-tenants', getActiveTenants);
       for (const tenant of tenants) {
         await step.run(`generate-${tenant.id}`, async () => {
           const tomorrow = addDays(new Date(), 1);
           // Skip if tasks already exist for tomorrow
           const existing = await getPrepSummary(tenant.id, tomorrow);
           if (existing.total > 0) return { skipped: true };

           const provider = new SimpleAverageProvider();
           const tasks = await generateDailyPrepTasks(tenant.id, tomorrow, provider);
           await bulkCreatePrepTasks(tenant.id, tasks);
           return { generated: tasks.length };
         });
       }
     },
   );
   ```

2. Register the function in `src/app/api/inngest/route.ts`.

3. Add manual trigger endpoint `src/app/api/_prep-generate-test/route.ts` (dev-only):
   - POST with `{ tenantId, date }` → triggers generation for that tenant/date
   - Returns task count

### Validation

- [ ] Function appears in Inngest dev UI
- [ ] Manual trigger creates prep tasks in DB for tomorrow
- [ ] Second trigger for same date → skips (idempotent)
- [ ] Logs appear in Axiom

### Commit

`feat(prep): Inngest daily prep generation job`

### Branch

`feat/phase-2-step-1-task-2`

---

## Task 3 — Write Lovable Prompt (Claude Code)

Save to `prompts/lovable/step-2-1-prep.md`.

Instruct Lovable to build:

1. **`/[tenantSlug]/prep` page** — daily prep list:
   - Date selector at top (default: today)
   - Station filter tabs: "הכל" | "מטבח" | "קונדיטוריה" | "בר" | "קר" | "גריל"
   - Progress bar: "12/20 משימות הושלמו"
   - Task cards (not table — mobile-first):
     - Recipe name (large, Hebrew)
     - Station badge
     - Quantity: "להכין: 15 יח'"
     - Status toggle: pending → in_progress → done
     - "הושלם" large tap target (full width button on mobile)
     - Tap on recipe name → opens recipe drawer
   - Empty state: "אין משימות Prep להיום" with "צור משימה ידנית" button
   - Summary footer: completed/total per station

2. **Recipe quick-view drawer** (Sheet from right):
   - Recipe name and image
   - BOM table (read-only)
   - Instructions (markdown rendered)
   - Video embed if URL exists
   - "סגור" button

3. **Manual task creation modal** (manager/owner only):
   - Recipe selector (combobox)
   - Station selector
   - Quantity + unit
   - Date picker

All Hebrew, RTL, mobile-first (chef uses phone in kitchen).
Wake Lock: activate on this page (screen must not sleep).

### Validation

- [ ] `prompts/lovable/step-2-1-prep.md` exists and complete

### Commit

`docs(prompts): Lovable prompt for prep list UI`

### Branch

`feat/phase-2-step-1-task-3`

---

## ⏸ PAUSE — Elad pastes prompt into Lovable.

---

## Task 4 — Wire + Fix (Claude Code)

Requirements:

1. Wire prep list to `getPrepTasksForDate` — real data from DB.
2. Wire status toggle to `updatePrepTaskStatus`.
3. Wire manual task creation to `createPrepTask`.
4. Wire recipe drawer to `getRecipeWithComponents`.
5. Implement Wake Lock API on prep page mount/unmount.
6. Add Supabase Realtime subscription on `prep_tasks` for tenant:
   - When another user marks a task done → update without refresh
7. Fix RTL on task cards (station badge on left in RTL = visual right).
8. Add E2E test `tests/e2e/prep.spec.ts`:
   - Trigger prep generation for today (via test endpoint)
   - Navigate to prep page
   - Mark one task done
   - Verify progress bar updates

### Validation

- [ ] Prep list loads real data
- [ ] Status toggle works and persists
- [ ] Realtime update when second browser marks task done
- [ ] Wake Lock activates (screen stays on during E2E test on mobile)
- [ ] E2E test passes
- [ ] Mobile layout correct on 375px

### Commit

`feat(prep): wire prep list UI, realtime updates, wake lock`

### Branch

`feat/phase-2-step-1-task-4`

---

## End of Step 2.1

- [ ] `pnpm db:test` green
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean

Check if `PHASE-2-STEP-2-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

# Phase 2 · Steps 2.2–2.5 — Checklists, Dashboard, UAT

---

# Step 2.2 — Checklists + Digital Signatures

> **Goal:** Manager and chef can complete daily checklists with digital signatures. Templates managed by owner/manager.

---

## Pre-flight check

```
git log --oneline -5
pnpm test
pnpm typecheck
```

Expected: Step 2.1 complete. Prep list working with realtime.

---

## Division of labor

**Claude Code:** schema, Server Actions, signature storage, tests, Lovable prompt.
**Lovable:** checklist UI, signature canvas, template management.

---

## Task 1 — Schema + Server Actions (Claude Code)

### Context to load

- `ARCHITECTURE.md` §5 (checklists, checklist_items, checklist_completions)

### Prompt for Claude Code

Create checklist schema and Server Actions.

Requirements:

1. Create migration `{timestamp}_checklists.sql`:

   ```sql
   CREATE TABLE checklists (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     name_he TEXT NOT NULL,
     frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
     station TEXT CHECK (station IN ('kitchen', 'pastry', 'bar', 'cold', 'grill', 'floor', 'all')),
     active BOOLEAN NOT NULL DEFAULT true,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );

   CREATE TABLE checklist_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
     text_he TEXT NOT NULL,
     order_idx INT NOT NULL DEFAULT 0,
     requires_signature BOOLEAN NOT NULL DEFAULT false
   );

   CREATE TABLE checklist_completions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     checklist_item_id UUID NOT NULL REFERENCES checklist_items(id),
     completion_date DATE NOT NULL,
     completed_by UUID REFERENCES auth.users(id),
     signature_image_url TEXT,
     notes TEXT,
     completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (checklist_item_id, completion_date, completed_by)
   );
   -- Full RLS on all three tables
   ```

2. Create `src/lib/actions/checklists.ts`:
   - `getChecklists(tenantId, frequency?, station?)` → checklists with items
   - `getChecklistForToday(tenantId, checklistId)` → items with today's completions
   - `completeChecklistItem(tenantId, itemId, date, signatureDataUrl?)` → upsert completion
   - `createChecklist(tenantId, data)` → new checklist template
   - `addChecklistItem(tenantId, checklistId, item)` → add item
   - `reorderChecklistItems(tenantId, checklistId, orderedIds[])` → drag-drop reorder

3. Create `src/lib/storage/signatures.ts`:

   ```typescript
   export async function uploadSignature(
     tenantId: string,
     userId: string,
     dataUrl: string, // base64 canvas PNG
   ): Promise<string>; // returns Storage URL
   ```

   - Bucket: `signatures` (private, signed URLs only)
   - Path: `{tenantId}/{userId}/{date}-{timestamp}.png`

4. Seed default checklists in `supabase/seed.sql`:
   - "פתיחת משמרת בוקר" — daily, all stations, 5 items
   - "סגירת משמרת ערב" — daily, all stations, 5 items

5. Write tests `tests/checklists/`:
   - Completing same item twice on same date → upsert, not duplicate
   - Signature uploaded to Storage
   - Reorder preserves all items

### Validation

- [ ] Migration clean
- [ ] Default checklists in seed
- [ ] `completeChecklistItem` with signature URL → stored in DB
- [ ] `pnpm test` green

### Commit

`feat(checklists): schema, Server Actions, signature storage`

### Branch

`feat/phase-2-step-2-task-1`

---

## Task 2 — Write Lovable Prompt (Claude Code)

Save to `prompts/lovable/step-2-2-checklists.md`.

Build:

1. **`/[tenantSlug]/checklist` page** — today's checklists:
   - Tab per checklist: "פתיחת משמרת" | "סגירת משמרת"
   - Progress: "3/8 פריטים"
   - Item rows with large checkbox
   - Items requiring signature: checkbox + "חתום" button
   - Signature canvas modal (full screen on mobile):
     - Draw area
     - "נקה" and "שמור חתימה" buttons
   - Completed item: green checkmark + signer name + time

2. **`/[tenantSlug]/settings/checklists` page** (manager/owner):
   - List of checklist templates
   - Edit: drag-drop reorder items
   - Add/remove items
   - Toggle "דורש חתימה" per item
   - "הוסף צ'קליסט" button

### Commit after Lovable:

`docs(prompts): Lovable prompt for checklists`

---

## ⏸ PAUSE — Lovable builds checklist UI.

---

## Task 3 — Wire + Fix (Claude Code)

1. Wire checklist items to `getChecklistForToday`.
2. Wire completion to `completeChecklistItem`.
3. Wire signature canvas → `uploadSignature` → store URL in completion.
4. Wire settings to CRUD actions.
5. Add push notification trigger on shift end (when all items completed):
   - Web push via browser Notification API
   - "משמרת הסתיימה ✓" notification

### Validation

- [ ] Complete item without signature → works
- [ ] Complete item with signature → PNG in Storage, URL in DB
- [ ] Settings page: add item → appears in checklist
- [ ] Push notification fires when last item completed

### Commit

`feat(checklists): wire UI, signatures, push notifications`

### Branch

`feat/phase-2-step-2-task-3`

---

## End of Step 2.2

Check if `PHASE-2-STEP-3-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

# Step 2.3 — Home Dashboard (Real Data + Realtime)

> **Goal:** The home dashboard shows real data for every role. KPI cards pull from DB. Realtime updates when teammates complete tasks.

---

## Pre-flight check

```
git log --oneline -5
pnpm test
pnpm typecheck
```

Expected: Steps 2.1 and 2.2 complete.

---

## Division of labor

**Claude Code:** KPI queries, realtime subscriptions, Server Actions, Lovable prompt.
**Lovable:** dashboard layout updates, real KPI cards.

---

## Task 1 — KPI Queries (Claude Code)

### Prompt for Claude Code

Build the data layer for the home dashboard.

Requirements:

1. Create `src/lib/actions/dashboard.ts`:

   ```typescript
   export interface OwnerDashboardData {
     prepSummary: { total: number; done: number; percent: number };
     checklistSummary: { total: number; done: number };
     wasteToday: { items: number; estimatedCostCents: number }; // Phase 3 will fill this
     openAlerts: Alert[];
     recentActivity: ActivityItem[];
   }

   export interface ChefDashboardData {
     prepForToday: { total: number; done: number; myDone: number };
     checklistsToSign: number;
     station: string;
   }

   export async function getOwnerDashboard(tenantId: string): Promise<OwnerDashboardData>;
   export async function getChefDashboard(
     tenantId: string,
     userId: string,
   ): Promise<ChefDashboardData>;
   ```

2. `getOwnerDashboard`:
   - Prep summary: query `prep_tasks` for today
   - Checklist summary: query `checklist_completions` for today
   - Waste: return zeros (Phase 3 will add this)
   - Open alerts: check for any failing integrations, missing costs, overdue tasks
   - Recent activity: last 10 audit log entries for tenant

3. `getChefDashboard`:
   - Today's prep tasks, filtered to chef's station preference
   - Unsigned checklists count

4. Create `src/lib/actions/alerts.ts`:
   - `getOpenAlerts(tenantId)` → checks:
     - Integration failing > 1 day → alert
     - Menu items with missing recipe → alert
     - Ingredients with no cost set but used in recipes → alert
   - Returns list of typed alerts with severity

### Validation

- [ ] `getOwnerDashboard` returns correct prep and checklist summaries
- [ ] `getOpenAlerts` detects missing ingredient costs
- [ ] `pnpm typecheck` clean

### Commit

`feat(dashboard): KPI queries and alerts system`

### Branch

`feat/phase-2-step-3-task-1`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/step-2-3-dashboard.md`.

Update the existing dashboard skeleton (from Phase 0) to show real data:

1. **Owner/Manager dashboard:**
   - KPI cards now pull from `getOwnerDashboard` (replace hardcoded values)
   - Alerts section: color-coded by severity (red/yellow/blue)
   - Activity feed: real audit log entries with Hebrew descriptions
   - Quick actions: "ראה Prep" | "ראה צ'קליסט" | "דווח Waste"

2. **Chef dashboard:**
   - My prep: real count from `getChefDashboard`
   - Checklists to sign badge

3. **Realtime updates (CC implements after Lovable):**
   - Subscribe to `prep_tasks` channel for tenant
   - Subscribe to `checklist_completions` channel
   - On update → refresh relevant KPI card (not full page reload)

### ⏸ PAUSE — Lovable updates dashboard UI.

Wire after Lovable:

- Connect all KPI cards to real Server Actions
- Add Supabase Realtime subscriptions
- Realtime: when prep task completed → prep KPI card updates

### Validation

- [ ] Owner sees real prep summary
- [ ] Chef sees real prep count
- [ ] Alerts appear if missing ingredient costs
- [ ] Realtime: mark prep task done in one tab → KPI updates in other tab

### Commit

`feat(dashboard): real data KPIs and realtime subscriptions`

### Branch

`feat/phase-2-step-3-task-2`

---

## End of Step 2.3

Check if `PHASE-2-STEP-4-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

# Step 2.4 — Manager Override + Forecast Tuning

> **Goal:** Manager can manually adjust tomorrow's prep quantities before they're sent to the kitchen. Simple override UI, manual event flag.

---

## Pre-flight check

```
git log --oneline -5
pnpm test
```

Expected: Steps 2.1–2.3 complete.

---

## Task 1 — Override Schema + Logic (Claude Code)

### Prompt for Claude Code

Add manager override capability to prep task generation.

Requirements:

1. Add to `prep_tasks` table:

   ```sql
   -- migration: {timestamp}_prep_override.sql
   ALTER TABLE prep_tasks ADD COLUMN qty_override NUMERIC;
   ALTER TABLE prep_tasks ADD COLUMN override_by UUID REFERENCES auth.users(id);
   ALTER TABLE prep_tasks ADD COLUMN override_note TEXT;
   ALTER TABLE prep_tasks ADD COLUMN is_special_event BOOLEAN NOT NULL DEFAULT false;
   ```

   Effective quantity = `COALESCE(qty_override, qty_recommended)`

2. Create `src/lib/actions/prep-override.ts`:
   - `overridePrepQty(tenantId, taskId, qty, note)` → updates override fields (manager/owner only)
   - `setSpecialEvent(tenantId, date, isSpecial, multiplier?)` → stores in a new `prep_events` table
   - `getPrepOverrides(tenantId, date)` → tasks with override info

3. Create migration for `prep_events`:

   ```sql
   CREATE TABLE prep_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     event_date DATE NOT NULL,
     label_he TEXT,
     expected_multiplier NUMERIC NOT NULL DEFAULT 1.0,
     created_by UUID REFERENCES auth.users(id),
     UNIQUE (tenant_id, event_date)
   );
   ```

4. Update `SimpleAverageProvider` to apply event multiplier if `prep_events` has entry for that date.

### Validation

- [ ] `overridePrepQty` updates the task, original `qty_recommended` preserved
- [ ] Event multiplier applied in forecast (e.g. 1.5 for special event → 50% more)
- [ ] `pnpm test` green

### Commit

`feat(prep): manager override and special event multiplier`

### Branch

`feat/phase-2-step-4-task-1`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/step-2-4-prep-override.md`.

Add to prep list page (manager/owner only):

1. **"ניהול מחר" section** (collapsible, manager/owner):
   - Shows tomorrow's auto-generated tasks
   - Each row: recipe name, recommended qty, override input
   - Override input: number field, save on blur
   - "אירוע מיוחד מחר" toggle → multiplier input (e.g. ×1.5)
   - "פרסם לצוות" button → marks tasks as finalized

2. **Override badge** on task cards in daily view:
   - If qty was overridden: small "✎" icon with tooltip showing original qty

### ⏸ PAUSE — Lovable builds override UI.

Wire after Lovable:

- Override input → `overridePrepQty`
- Special event toggle → `setSpecialEvent`
- Override badge shows when `qty_override` is set

### Validation

- [ ] Manager sets override → chef sees new quantity
- [ ] Original quantity visible in tooltip
- [ ] Special event multiplier applied to tomorrow's auto-generation

### Commit

`feat(prep): wire manager override UI`

### Branch

`feat/phase-2-step-4-task-2`

---

## End of Step 2.4

Check if `PHASE-2-STEP-5-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

# Step 2.5 — UAT, Performance, Mobile Polish, E2E

> **Goal:** Phase 2 is production-ready. Real chef uses the system daily without issues. Performance validated. All E2E tests pass.

---

## Pre-flight check

```
git log --oneline -5
pnpm test
pnpm typecheck
pnpm lint
```

Expected: Steps 2.1–2.4 complete.

---

## Task 1 — Performance Audit (Claude Code)

### Prompt for Claude Code

Audit and fix performance bottlenecks across Phase 2 features.

Requirements:

1. Run Lighthouse audit on these pages (in production build):
   - `/prep`
   - `/checklist`
   - `/` (dashboard)

   Target: Performance ≥ 85, Accessibility ≥ 90.

2. Add DB indexes if missing:

   ```sql
   -- migration: {timestamp}_phase2_indexes.sql
   CREATE INDEX IF NOT EXISTS idx_prep_tasks_date_status
     ON prep_tasks(tenant_id, due_date, status);
   CREATE INDEX IF NOT EXISTS idx_checklist_completions_date
     ON checklist_completions(tenant_id, completion_date);
   CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_recent
     ON _audit_log(tenant_id, created_at DESC);
   ```

3. Add `React.memo` to heavy components:
   - PrepTask card
   - ChecklistItem row
   - KPICard

4. Add `loading.tsx` files for each route segment (Next.js streaming):
   - `src/app/(app)/[tenantSlug]/prep/loading.tsx`
   - `src/app/(app)/[tenantSlug]/checklist/loading.tsx`

5. Verify Realtime doesn't cause unnecessary re-renders:
   - Each subscription should only update the specific component that needs it
   - Use `useCallback` and `useMemo` where appropriate

### Validation

- [ ] Lighthouse Performance ≥ 85 on all 3 pages
- [ ] New indexes applied
- [ ] No unnecessary full-page re-renders on Realtime update

### Commit

`perf: Phase 2 performance audit, indexes, React.memo`

### Branch

`feat/phase-2-step-5-task-1`

---

## Task 2 — Mobile Polish (Claude Code + Lovable)

### Prompt for Claude Code

Fix all mobile UX issues found during Phase 2 build.

Requirements:

1. Audit on 375px (iPhone SE size) and 390px (iPhone 14):
   - Prep task cards: tap targets ≥ 44px
   - Signature canvas: full-screen on mobile
   - Checklist items: enough spacing for gloved fingers
   - Bottom navigation: fixed, doesn't overlap content

2. Fix iOS Safari specific issues:
   - Wake Lock API: confirm it works on iOS (may need fallback)
   - Signature canvas: touch events work (not just mouse)
   - Bottom safe area: add `env(safe-area-inset-bottom)` padding

3. Write Lovable prompt `prompts/lovable/step-2-5-mobile-polish.md` for any remaining UI fixes Lovable should implement.

4. After Lovable — wire any new components.

### Validation

- [ ] Prep list usable on iPhone SE (375px)
- [ ] Signature canvas works with finger on iOS
- [ ] No content hidden behind bottom nav or iOS home indicator

### Commit

`fix(mobile): iOS Safari fixes, touch events, safe area`

### Branch

`feat/phase-2-step-5-task-2`

---

## Task 3 — Full E2E Test Suite (Claude Code)

### Prompt for Claude Code

Write complete E2E tests for Phase 2 critical flows.

Requirements:

Create `tests/e2e/phase2.spec.ts` with these scenarios:

1. **Prep flow:**

   ```
   Given: prep tasks generated for today
   When: chef marks 3 tasks as done
   Then: progress bar shows correct count
   And: dashboard KPI reflects new count
   ```

2. **Checklist + signature flow:**

   ```
   Given: checklist with 5 items, 2 requiring signature
   When: user completes all items, signs 2
   Then: completion_date entries in DB for all items
   And: signature URLs stored in Storage
   And: push notification sent
   ```

3. **Manager override flow:**

   ```
   Given: auto-generated prep task with qty 10
   When: manager sets override to 15
   Then: chef sees qty 15 on prep card
   And: original 10 visible in tooltip
   ```

4. **Realtime sync:**

   ```
   Given: two browser tabs open on prep page
   When: tab A marks task done
   Then: tab B's progress bar updates within 3 seconds
   ```

5. **Alert system:**
   ```
   Given: ingredient with no cost used in recipe
   When: owner opens dashboard
   Then: alert "מרכיב ללא מחיר" appears with ingredient name
   ```

### Validation

- [ ] All 5 E2E scenarios pass
- [ ] Tests run in CI (add to GitHub Actions workflow)

### Commit

`test(e2e): Phase 2 complete E2E test suite`

### Branch

`feat/phase-2-step-5-task-3`

---

## End of Phase 2

Run Phase 2 Definition of Done:

- [ ] Chef uses system every morning unaided after 10-min walkthrough
- [ ] Manager closes shift with digital signature
- [ ] Realtime dashboard updates work
- [ ] Lighthouse Performance ≥ 85 on all Phase 2 pages
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean

Read `TIMELINE.md`. Next is Phase 3, Step 3.1. Check if `PHASE-3-STEP-1-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
