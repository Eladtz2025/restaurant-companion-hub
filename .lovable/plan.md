# Daily Prep List (Step 2.1)

Build the prep list screen for daily kitchen tasks, with date navigation, status summary, an editable table, and a side drawer for editing notes/quantities.

## Files to create

```
src/lib/actions/prep.ts                                  (action stub)
src/app/(app)/[tenantSlug]/prep/page.tsx                 (replace placeholder)
src/app/(app)/[tenantSlug]/prep/_components/
  PrepListClient.tsx
  PrepTaskDrawer.tsx
src/lib/types/index.ts                                   (add PrepTask types)
```

## 1. Types (append to `src/lib/types/index.ts`)

- `PrepTaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped'`
- `PrepTask` and `PrepSummary` interfaces per spec.

## 2. Action stub — `src/lib/actions/prep.ts`

Server-side stub (matches pattern used in `fc-report.ts` / `ai-recipe.ts`) exporting:
- `getPrepTasksForDate(tenantId, date)` — returns a small mock `PrepTask[]` for today, empty for other dates.
- `updatePrepTaskStatus(tenantId, taskId, update)` — echoes back the merged task.
- `getPrepSummary(tenantId, date)` — derived counts.

Marked `'use server'` so client components can import directly. Will be wired to real DB later.

## 3. Page — `src/app/(app)/[tenantSlug]/prep/page.tsx`

Server Component:
- `requireTenant(tenantSlug)`
- `getAuthContext()` → userId
- `getUserRole(tenant.id, userId)` → role
- Render `<PrepListClient tenantId tenantSlug userRole />`

No initial data fetch — client fetches on mount based on selected date.

## 4. `PrepListClient.tsx`

State:
- `date: string` (default `new Date().toISOString().slice(0,10)`)
- `tasks: PrepTask[]`
- `summary: PrepSummary | null`
- `loading`, `error`
- `editingTask: PrepTask | null`
- `useTransition` for status/qty updates

Layout:
- `<PageHeader title="רשימת הכנות" />`
- Date navigation row: `ChevronRight` (אתמול — RTL: prev day visually on right), date display `dd/MM/yyyy` with `Calendar` icon, `ChevronLeft` (מחר). Buttons shift `date` by ±1 day.
- Summary bar: colored `Badge`s — סה״כ (neutral/outline), ממתינות (yellow), בביצוע (blue), הושלמו (green), דולגו (gray, only if > 0).
- Table columns (RTL): מתכון | כמות נדרשת | כמות בפועל | סטטוס | הערות | פעולות
  - **כמות בפועל**: inline `<Input type="number">` (small, w-24), updates on blur if value changed → optimistic + `updatePrepTaskStatus`.
  - **סטטוס**: `<Select>` with 4 Hebrew options, color-coded trigger via Badge wrapper or class. Change → optimistic + action call.
  - **הערות**: truncated text in `Tooltip` (full text on hover); `—` if null.
  - **פעולות**: `Pencil` icon button → opens `PrepTaskDrawer` for that task.

States:
- Loading: 6 `Skeleton` rows.
- Empty: centered `Calendar` icon + "אין משימות הכנה לתאריך זה".
- Error: message + "נסה שוב" button calling refetch.

Data effect: `useEffect` on `date` → `Promise.all([getPrepTasksForDate, getPrepSummary])`, sets state, handles errors via `toast.error`.

Helper `recomputeSummary(tasks, date)` runs locally after optimistic updates so badges stay in sync without refetch.

## 5. `PrepTaskDrawer.tsx`

`<Sheet side="right">` with title "עדכון משימה". Local form state seeded from task prop.

Fields:
- סטטוס — `<Select>` (4 statuses)
- כמות בפועל — `<Input type="number" min="0">` (optional)
- הערות — `<Textarea maxLength={500}>`

Footer: "ביטול" (outline, closes) and "שמור" (primary, disabled+spinner during save). On save: call `updatePrepTaskStatus`, on success invoke `onSaved(updatedTask)` from parent for optimistic state update + toast, then close. On error: toast and stay open.

## Status / color mapping

Single `STATUS_META` map used by both table and drawer:
```
pending     → { label: 'ממתין',  badge: 'bg-yellow-100 text-yellow-800' }
in_progress → { label: 'בביצוע', badge: 'bg-blue-100  text-blue-800'  }
done        → { label: 'הושלם',  badge: 'bg-green-100 text-green-800' }
skipped     → { label: 'דולג',   badge: 'bg-gray-100  text-gray-700'  }
```

## Constraints honored

- shadcn/ui only (Table, Sheet, Select, Badge, Input, Textarea, Skeleton, Button, Tooltip).
- No fetch/axios — server actions imported directly.
- No new packages.
- Date formatted with `Intl.DateTimeFormat('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' })`; ISO yyyy-mm-dd kept in state for action calls.
- RTL: `text-right`, icons placed via standard flex (RTL flips automatically).
- Toasts via `sonner` (project already uses it).
- `recipeId` displayed as-is (no recipe name join) per spec.
- `IfRole` not strictly required — all roles can update prep tasks; if needed later we can gate the drawer/actions to chef+ but spec doesn't restrict.
