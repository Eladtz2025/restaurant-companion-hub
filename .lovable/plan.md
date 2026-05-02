## Dashboard KPIs & Alerts (Step 2.3)

Build a Hebrew RTL dashboard at `/[tenantSlug]/dashboard` showing today's KPIs, active alerts, and (for owner/manager) alert rule management.

### 1. Types — append to `src/lib/types/index.ts`

```ts
export type KPIMetric =
  | 'prep_completion_rate'
  | 'checklist_completion_rate'
  | 'fc_percent'
  | 'active_recipes';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertOperator = 'lt' | 'gt' | 'lte' | 'gte';

export interface Alert { id; metric; value; threshold; severity; message; acknowledged; firedAt; date }
export interface KPISnapshot { date; prepCompletionRate; checklistCompletionRate; fcPercent: number|null; activeRecipes; alerts: Alert[] }
export interface AlertRule { id; metric; threshold; operator; severity; active }
```

### 2. Server action stubs — `src/lib/actions/dashboard.ts`

`'use server'` module with in-memory store (matching `prep.ts` pattern). Exports:

- `getKPISnapshot(tenantId, date)` — returns seeded snapshot for today (e.g. prep 75%, checklist 92%, fc 32.5%, active 18) and 2 sample alerts (1 critical FC, 1 warning prep). For non-today dates returns zeros / empty alerts.
- `getAlertRules(tenantId)` — returns 2 seeded rules.
- `createAlertRule(tenantId, data)` — pushes new rule with generated id, defaults severity to `'warning'`.
- `acknowledgeAlert(tenantId, alertId, userId)` — flips `acknowledged: true` and returns the alert.

### 3. Page — `src/app/(app)/[tenantSlug]/dashboard/page.tsx`

Server Component mirroring `checklists/page.tsx`:

```tsx
const { tenantSlug } = await params;
const tenant = await requireTenant(tenantSlug);
const ctx = await getAuthContext();
const role = ctx ? await getUserRole(tenant.id, ctx.userId) : null;
return <DashboardClient tenantId={tenant.id} tenantSlug={tenantSlug} userRole={role} userId={ctx?.userId ?? null} />;
```

### 4. `_components/DashboardClient.tsx` (`'use client'`)

State: `date` (default today ISO), `snapshot`, `rules`, `loading`, `error`, `rulesOpen`. Use `useState` + `useTransition`.

On mount and on date change: `Promise.all([getKPISnapshot, getAlertRules])`.

Layout (top to bottom):

1. **PageHeader** `title="לוח בקרה"` with `actions` = date nav (◀ today ▶ buttons + formatted date badge using `Intl.DateTimeFormat('he-IL')`, mirrored chevrons like PrepListClient).
2. **KPI cards row** — `grid gap-4 grid-cols-2 lg:grid-cols-4`. Inline KPI card component (not reusing `KPICard.tsx` since spec wants color-coded background + custom icon). Each card:
   - Icon top-end, label, large centered number, color class from helper.
   - Helpers: `rateColor(n)` → green ≥80, yellow ≥60, red <60. `fcColor(n|null)` → green <30, yellow ≤35, red >35, gray for null.
   - Skeleton (h-24) while `loading`.
   - Cards: השלמת הכנות (ChefHat), השלמת צ'קליסטים (CheckSquare), עלות מזון (TrendingUp), מתכונים פעילים (BookOpen, no color coding).
3. **Alerts panel** — Card with header "התראות פעילות" + count Badge (red if any critical, yellow if only warnings, hidden if 0). Body:
   - If empty: centered green CheckSquare + "אין התראות פעילות".
   - Else: list rows sorted critical→warning→info. Each row: severity icon (AlertTriangle red/yellow, Info blue), message, relative time (small helper `relativeTimeHe(iso)` → "לפני X דקות/שעות/ימים"), and `IfRole` owner/manager → "אשר" Button. Acknowledge: optimistic remove from list + call `acknowledgeAlert`; on error toast + restore.
4. **Manage rules button** (bottom) — `IfRole` owner/manager → Button "ניהול חוקי התראות" opens `AlertRulesSheet`.

Toasts via `sonner` (matching existing pattern in PrepListClient).

### 5. `_components/AlertRulesSheet.tsx` (`'use client'`)

Props: `tenantId`, `open`, `onOpenChange`, `rules`, `onRulesChange(next)`.

`Sheet side="right"` with header "ניהול חוקי התראות". Body:

- **Rules list**: each row shows `METRIC_LABEL[rule.metric]` | `OPERATOR_LABEL[rule.operator] threshold` | severity badge (color-coded) | Trash2 button (local-only delete since no `deleteAlertRule` action exists — filters from prop list and calls `onRulesChange`). Empty state "אין חוקים פעילים".
- **Inline add form** at bottom (state: metric, operator, threshold, severity):
  - Selects for metric / operator / severity (Hebrew labels per spec).
  - Numeric Input for threshold.
  - "הוסף חוק" Button — validates threshold is a number, calls `createAlertRule`, on success appends to list via `onRulesChange`, resets form. Uses `useTransition` for pending state. Error → toast.

### 6. Sidebar — `src/components/shared/Sidebar.tsx`

Add nav item between "בית" and "Prep List":

```ts
{ label: 'לוח בקרה', href: '/dashboard', icon: LayoutDashboard, minRole: 'manager' }
```

(Replace existing "ביצועי פלור" LayoutDashboard import usage — both can share the icon import.)

### File structure

```
src/app/(app)/[tenantSlug]/dashboard/
  page.tsx
  _components/
    DashboardClient.tsx
    AlertRulesSheet.tsx
src/lib/actions/dashboard.ts        (new)
src/lib/types/index.ts              (append KPI/Alert types)
src/components/shared/Sidebar.tsx   (add nav item)
```

### Constraints respected

- No new packages, no fetch/axios, no real DB queries.
- shadcn-only primitives: Card, Sheet, Badge, Button, Select, Input, Skeleton.
- RTL: `flex-row-reverse` where needed; mirrored ChevronLeft/Right; `text-right`.
- All UI strings Hebrew.
- Acknowledge + rule mgmt gated via `IfRole` to owner/manager.
- Optimistic updates for acknowledge + rule create; rollback on error.
