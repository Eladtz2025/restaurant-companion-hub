# Checklists (Step 2.2)

Build the Checklists screen with daily completion + template management tabs. The action stub is missing and needs to be created. Three Radix primitives (Accordion, Checkbox, Progress) are not installed and not allowed by the "no new packages" rule, so I'll implement them with native HTML + Tailwind.

## Files

```
src/lib/actions/checklists.ts                                     (action stub, 'use server')
src/lib/types/index.ts                                            (add Checklist types)
src/app/(app)/[tenantSlug]/checklists/page.tsx                    (server component)
src/app/(app)/[tenantSlug]/checklists/_components/
  ChecklistsClient.tsx
  ChecklistCompletionSheet.tsx
  ChecklistTemplateDrawer.tsx
src/components/shared/Sidebar.tsx                                  (point to /checklists)
```

Spec routes to `/checklists` (plural) but the existing sidebar + placeholder use `/checklist` (singular). I'll add the new `/checklists` route per spec and update the sidebar link so the nav item works. The legacy `/checklist/page.tsx` placeholder stays untouched.

## 1. Types (append to `src/lib/types/index.ts`)

- `ShiftType = 'morning' | 'afternoon' | 'evening' | 'night'`
- `ChecklistStatus = 'pending' | 'partial' | 'completed'`
- `Checklist`, `ChecklistItem`, `ChecklistCompletion`, `ChecklistWithItems` per spec.

## 2. Action stub — `src/lib/actions/checklists.ts`

`'use server'` module with in-memory Map store keyed by tenant. Same pattern as `prep.ts`. Implements all 8 functions; seeds 2–3 sample checklists per tenant on first read. Validation: required fields throw with Hebrew messages. Will be wired to DB later.

## 3. Page — `checklists/page.tsx`

Server Component:
- `requireTenant`, `getAuthContext`, `getUserRole`
- Renders `<ChecklistsClient tenantId tenantSlug userRole userId />`

## 4. `ChecklistsClient.tsx`

State: `activeTab` ('daily' | 'templates'), `date`, `shift`, `checklists`, `completions: Record<checklistId, ChecklistCompletion | null>`, `loading`, `error`, sheet/drawer state.

Layout:
- `<PageHeader title="צ׳קליסטים" />`
- `<Tabs>` — "מילוי יומי" always; "ניהול תבניות" gated via `IfRole roles={['owner','manager']}`. If chef/staff, render only the daily tab.

### Daily tab
- Date nav (ChevronRight prev / date display / ChevronLeft next), same pattern as Prep page.
- Shift filter — secondary `<Tabs>` with 4 shifts (בוקר/צהריים/ערב/לילה).
- Effect on `[date, shift]`: fetch `getChecklists(tenantId, shift)`, then `Promise.all` of `getChecklistCompletion` per list.
- Render `<Card>` per checklist:
  - Icon (`ClipboardList`) + name
  - Progress text `X/Y` (color: green=all, yellow=partial, gray=none) + status `<Badge>` with same color mapping ("הושלם"/"חלקי"/"ממתין")
  - "פתח" button → opens `ChecklistCompletionSheet`
- States: 4 skeleton cards while loading; empty state "אין רשימות למשמרת זו" with `ClipboardList`; error retry.

### Templates tab (owner/manager)
- Header "+ הוסף רשימה" → opens `ChecklistTemplateDrawer` in create mode.
- For each checklist, render a custom expandable card (no Radix Accordion — uses local `expanded[id]` state with chevron):
  - Header row: chevron + name + shift badge + "ערוך" + "מחק" buttons.
  - Expanded body: items list (each with `GripVertical` icon — visual only, no DnD per "no new packages"; trash icon → `removeChecklistItem`).
  - Inline "+ הוסף סעיף" — `<Input>` + ✓ button; Enter or click calls `addChecklistItem`.
- "מחק" → `updateChecklist(..., { active: false })` then drop from list (toast "הרשימה הוסרה").
- Lazy-load items per checklist: when user expands for the first time, fetch via `getChecklistWithItems` and cache in `itemsById` state.

## 5. `ChecklistCompletionSheet.tsx`

`<Sheet side="right" className="sm:max-w-lg">`. Loads `getChecklistWithItems` + completion on open.

State: `completedItems: Set<string>`, `notes`, `saving`.

Content:
- Title: checklist name; subtitle: `formatDateHe(date)`.
- Custom progress bar (div + inner div with width %, semantic colors via `bg-primary`).
- Item list — native `<input type="checkbox">` styled with Tailwind (`accent-primary h-5 w-5`), label clickable. Checked rows get `bg-green-50` background.
- `<Textarea>` for notes (max 500).
- If completion exists, show "עודכן: <timestamp>" muted text.

Status auto-derived: 0=pending, all=completed, else=partial.

Footer:
- "סגור" outline.
- "שמור ✓" primary; spinner while saving. Calls `upsertChecklistCompletion(tenantId, checklistId, date, { completedBy: userId, completedItems: [...set], notes, signatureUrl: null })`. On success: toast, propagate updated completion to parent via `onSaved`, close.

## 6. `ChecklistTemplateDrawer.tsx`

`<Sheet side="right">`. Modes: create / edit (driven by `checklist?: Checklist | null` prop).

Fields:
- שם הרשימה — `<Input maxLength={100}>` (required).
- משמרת — `<Select>` with 4 Hebrew options (required).

Validation: trim name; if empty → toast "שם הרשימה הוא שדה חובה". If no shift → "יש לבחור משמרת".

Footer: "ביטול" / "שמור" (spinner while saving). Calls `createChecklist` or `updateChecklist`. On success: toast, `onSaved(updated)`, close. Title: "רשימה חדשה" / "עריכת רשימה".

## 7. Sidebar update

Change `'/checklist'` → `'/checklists'` in `NAV_ITEMS` so the nav reaches the new page.

## Constraints honored

- shadcn/ui only — Tabs, Sheet, Badge, Input, Textarea, Select, Skeleton, Button, Card, Label, Tooltip already present.
- Accordion / Checkbox / Progress: replaced by lightweight Tailwind primitives (no new packages).
- No fetch/axios — actions imported and called directly.
- `signatureUrl` always `null` per spec.
- Toasts via `sonner` (project standard).
- Status colors via Tailwind classes consistent with prep page (`bg-yellow-100`, `bg-blue-100`, `bg-green-100`, `bg-gray-100`).
- All UI text Hebrew, `text-right` and RTL-friendly flex.
