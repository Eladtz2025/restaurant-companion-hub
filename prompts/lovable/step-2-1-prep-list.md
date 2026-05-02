# Lovable Prompt — Daily Prep List (Step 2.1)

> Paste this entire file into Lovable. Build the Prep List screen exactly as described.

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
// src/lib/actions/prep.ts
import { getPrepTasksForDate, updatePrepTaskStatus, getPrepSummary } from '@/lib/actions/prep';
```

### Function signatures

```typescript
// Returns PrepTask[] for a given date (YYYY-MM-DD)
getPrepTasksForDate(tenantId: string, date: string): Promise<PrepTask[]>

// Update task status (and optional actual qty / notes)
updatePrepTaskStatus(tenantId: string, taskId: string, update: {
  status: PrepTaskStatus;
  qtyActual?: number | null;
  notes?: string | null;
}): Promise<PrepTask>

// Summary counts for a date
getPrepSummary(tenantId: string, date: string): Promise<PrepSummary>
```

### Types

```typescript
type PrepTaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

interface PrepTask {
  id: string;
  tenantId: string;
  recipeId: string;
  prepDate: string; // YYYY-MM-DD
  qtyRequired: number;
  qtyActual: number | null;
  unit: string;
  status: PrepTaskStatus;
  notes: string | null;
  assignedTo: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PrepSummary {
  date: string;
  total: number;
  pending: number;
  inProgress: number;
  done: number;
  skipped: number;
}
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

Page: `src/app/(app)/[tenantSlug]/prep/page.tsx`

- Call `requireTenant(params.tenantSlug)` to get `{ id, name, slug }`
- Call `getAuthContext()` from `@/lib/supabase/server` for userId
- Call `getUserRole(tenantId, userId)` from `@/lib/tenant` for userRole
- Pass `tenantId`, `tenantSlug`, `userRole` to client component `<PrepListClient>`

---

## What to build

### 1. Page — `src/app/(app)/[tenantSlug]/prep/page.tsx`

Server Component. Fetches tenant + role and passes to `<PrepListClient>`.

### 2. `_components/PrepListClient.tsx`

Main client component. Default date = today in `YYYY-MM-DD` format.

Layout:

```
┌──────────────────────────────────────────────────────┐
│ PageHeader: "רשימת הכנות"                             │
├──────────────────────────────────────────────────────┤
│ [◀ אתמול]  📅 02/05/2026  [מחר ▶]                    │
├──────────────────────────────────────────────────────┤
│ סיכום: ●12 סה״כ  ●5 ממתינות  ●3 בביצוע  ●4 הושלמו   │
├──────────────────────────────────────────────────────┤
│ TABLE                                                │
└──────────────────────────────────────────────────────┘
```

**Date navigation:**

- Two arrow buttons (prev/next day) + current date display in Hebrew format (`dd/MM/yyyy`)
- Changing date re-fetches tasks via `getPrepTasksForDate`

**Summary bar** (colored badges):

- סה״כ — neutral
- ממתינות — yellow/orange Badge
- בביצוע — blue Badge
- הושלמו — green Badge
- דולגו — gray Badge (only show if > 0)

**Data table columns (RTL order):**

| מתכון | כמות נדרשת | כמות בפועל | סטטוס | הערות | פעולות |
| ----- | ---------- | ---------- | ----- | ----- | ------ |

- **מתכון**: `recipeId` (display as-is for now — no recipe name join; manager can see the ID)
- **כמות נדרשת**: `qtyRequired + ' ' + unit`
- **כמות בפועל**: Editable input (number, inline) — updates on blur via `updatePrepTaskStatus`. Show `—` if null.
- **סטטוס**: Dropdown/Select with Hebrew labels:
  - `pending` → "ממתין"
  - `in_progress` → "בביצוע"
  - `done` → "הושלם"
  - `skipped` → "דולג"
  - Color-coded: pending=yellow, in_progress=blue, done=green, skipped=gray
  - Changing triggers `updatePrepTaskStatus` with optimistic update
- **הערות**: Truncated text, click to expand (tooltip or inline expand)
- **פעולות**: Pencil icon → opens `PrepTaskDrawer` for editing notes + actual qty

**Status badge colors:**

- `pending` → yellow
- `in_progress` → blue
- `done` → green
- `skipped` → gray/muted

**Loading state:** 6 skeleton rows
**Empty state:** "אין משימות הכנה לתאריך זה" with calendar icon
**Error state:** "שגיאה בטעינה. נסה שוב." + retry

---

### 3. `_components/PrepTaskDrawer.tsx` — Edit Sheet

Opens from right (`side="right"`).

**Fields:**

| שדה        | רכיב          | הערות                   |
| ---------- | ------------- | ----------------------- |
| סטטוס      | Select        | 4 statuses in Hebrew    |
| כמות בפועל | Input[number] | Optional, ≥ 0           |
| הערות      | Textarea      | Optional, max 500 chars |

**Buttons:** "שמור" (primary, disabled+spinner while saving) / "ביטול"

**Title:** "עדכון משימה"

On save: call `updatePrepTaskStatus`, close drawer, update local state optimistically.

---

## File structure

```
src/app/(app)/[tenantSlug]/prep/
  page.tsx
  _components/
    PrepListClient.tsx
    PrepTaskDrawer.tsx
```

---

## Shared UI rules

1. **RTL**: `text-right`, `flex-row-reverse` for icon+text buttons
2. **Hebrew only** in UI
3. **shadcn/ui only**: Table, Sheet, Select, Badge, Input, Textarea, Skeleton, Button
4. **No state library**: `useState` + `useTransition`
5. **Toasts**: shadcn `useToast` on error
6. **Icons**: lucide-react — `ChevronRight`, `ChevronLeft`, `Calendar`, `Pencil`, `CheckCircle2`, `Clock`, `SkipForward`

---

## DO NOT

- Write Server Actions
- Install any packages
- Use fetch/axios
- Show recipe names — just display recipeId for now
