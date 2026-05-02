# Lovable Prompt — Dashboard KPIs & Alerts (Step 2.3)

> Paste this entire file into Lovable. Build the Dashboard screen exactly as described.

---

## Context

Multi-tenant restaurant operations app:

- **Next.js 15 App Router** — pages in `src/app/(app)/[tenantSlug]/`
- **React 19**, TypeScript strict mode
- **shadcn/ui** only
- **Tailwind CSS v4**
- **RTL Hebrew UI** — `dir="rtl"` on `<html>` globally
- **Role system**: `owner > manager > chef > staff`

**Do not write any Server Actions, DB queries, or API routes.**

---

## Server Actions to use (already implemented)

```typescript
// src/lib/actions/dashboard.ts
import {
  getKPISnapshot,
  getAlertRules,
  createAlertRule,
  acknowledgeAlert,
} from '@/lib/actions/dashboard';
```

### Function signatures

```typescript
type KPIMetric = 'prep_completion_rate' | 'checklist_completion_rate' | 'fc_percent' | 'active_recipes';
type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertOperator = 'lt' | 'gt' | 'lte' | 'gte';

interface KPISnapshot {
  date: string;
  prepCompletionRate: number;       // 0–100
  checklistCompletionRate: number;  // 0–100
  fcPercent: number | null;
  activeRecipes: number;
  alerts: Alert[];
}

interface Alert {
  id: string;
  metric: KPIMetric;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  firedAt: string;
  date: string;
}

interface AlertRule {
  id: string;
  metric: KPIMetric;
  threshold: number;
  operator: AlertOperator;
  severity: AlertSeverity;
  active: boolean;
}

// Get today's KPIs and active alerts
getKPISnapshot(tenantId: string, date: string): Promise<KPISnapshot>

// Get active alert rules
getAlertRules(tenantId: string): Promise<AlertRule[]>

// Create a new alert rule (owner/manager only)
createAlertRule(tenantId: string, data: {
  metric: KPIMetric;
  threshold: number;
  operator: AlertOperator;
  severity?: AlertSeverity;
}): Promise<AlertRule>

// Acknowledge an alert
acknowledgeAlert(tenantId: string, alertId: string, userId: string): Promise<Alert>
```

---

## Existing shared components

```typescript
import { PageHeader } from '@/components/shared/PageHeader';
// Props: { title: string; subtitle?: string; actions?: React.ReactNode }

import { IfRole } from '@/components/shared/IfRole';
// Props: { userRole: Role | null; roles: Role[]; children: ReactNode; fallback?: ReactNode }
```

---

## Route context

Page: `src/app/(app)/[tenantSlug]/dashboard/page.tsx`

- Call `requireTenant(params.tenantSlug)` to get `{ id, name, slug }`
- Call `getAuthContext()` from `@/lib/supabase/server` for userId
- Call `getUserRole(tenantId, userId)` from `@/lib/tenant` for userRole
- Pass `tenantId`, `tenantSlug`, `userRole`, `userId` to `<DashboardClient>`

---

## What to build

### 1. Page — `src/app/(app)/[tenantSlug]/dashboard/page.tsx`

Server Component.

### 2. `_components/DashboardClient.tsx`

Main client component. Default date = today.

Layout:

```
┌──────────────────────────────────────────────────────┐
│ PageHeader: "לוח בקרה"              [◀] 02/05 [▶]    │
├──────────────────────────────────────────────────────┤
│  KPI CARDS ROW                                       │
├──────────────────────────────────────────────────────┤
│  ALERTS PANEL                                        │
├──────────────────────────────────────────────────────┤
│  [ניהול חוקי התראות] (owner/manager only)            │
└──────────────────────────────────────────────────────┘
```

**KPI Cards (4 cards in a row, responsive 2×2 on mobile):**

| כרטיס           | ערך                                   | אייקון        |
| --------------- | ------------------------------------- | ------------- |
| השלמת הכנות     | `prepCompletionRate.toFixed(1)%`      | `ChefHat`     |
| השלמת צ'קליסטים | `checklistCompletionRate.toFixed(1)%` | `CheckSquare` |
| עלות מזון       | `fcPercent?.toFixed(1)% ?? '—'`       | `TrendingUp`  |
| מתכונים פעילים  | `activeRecipes`                       | `BookOpen`    |

Each card:

- Large number in center
- Color coding for rates:
  - ≥ 80% → green
  - 60–79% → yellow
  - < 60% → red
- FC% color coding (inverted — lower is better):
  - < 30% → green
  - 30–35% → yellow
  - > 35% → red
- Skeleton while loading

**Alerts Panel:**

- Title: "התראות פעילות" + count badge (red if critical, yellow if warning)
- If no alerts: "אין התראות פעילות" with green checkmark
- Each alert row:
  - Severity icon: 🔴 (critical) / 🟡 (warning) / 🔵 (info)
  - Alert message (from `alert.message`)
  - Time: `firedAt` relative (e.g., "לפני 2 שעות")
  - "אשר" button (only owner/manager) → calls `acknowledgeAlert`, removes from list optimistically
- Critical alerts sorted first

---

### 3. `_components/AlertRulesSheet.tsx` — Manage Alert Rules

Opens from right (`side="right"`).

Triggered by "ניהול חוקי התראות" button (owner/manager only).

**Content:**

List of existing rules:

```
מדד: אחוז השלמת הכנות   |  < 80%  |  אזהרה  [מחק]
מדד: עלות מזון          |  > 35%  |  קריטי  [מחק]
```

"+ הוסף חוק" form (inline at bottom):

| שדה       | רכיב          | ערכים                |
| --------- | ------------- | -------------------- |
| מדד       | Select        | 4 metrics in Hebrew  |
| אופרטור   | Select        | < / > / ≤ / ≥        |
| סף        | Input[number] |                      |
| רמת חומרה | Select        | מידע / אזהרה / קריטי |

On submit: `createAlertRule`, add to list optimistically.

**Metric labels:**
| value | Hebrew |
|-------|--------|
| `prep_completion_rate` | אחוז השלמת הכנות |
| `checklist_completion_rate` | אחוז השלמת צ'קליסטים |
| `fc_percent` | אחוז עלות מזון |
| `active_recipes` | מתכונים פעילים |

**Operator labels:**
| value | Hebrew |
|-------|--------|
| `lt` | פחות מ |
| `gt` | גדול מ |
| `lte` | פחות מ או שווה ל |
| `gte` | גדול מ או שווה ל |

---

## File structure

```
src/app/(app)/[tenantSlug]/dashboard/
  page.tsx
  _components/
    DashboardClient.tsx
    AlertRulesSheet.tsx
```

---

## Shared UI rules

1. **RTL**: `text-right`, `flex-row-reverse`
2. **Hebrew only**
3. **shadcn/ui only**: Card, Sheet, Badge, Button, Select, Input, Skeleton
4. **No state library**: `useState` + `useTransition`
5. **Role guard**: acknowledge alerts + manage rules only for owner/manager
6. **Toasts**: `useToast` on error
7. **Icons**: lucide-react — `ChefHat`, `CheckSquare`, `TrendingUp`, `BookOpen`, `Bell`, `BellOff`, `AlertTriangle`, `Info`, `ChevronRight`, `ChevronLeft`

---

## DO NOT

- Write Server Actions
- Install any packages
- Use fetch/axios
