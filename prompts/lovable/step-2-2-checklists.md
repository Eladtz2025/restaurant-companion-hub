# Lovable Prompt — Checklists (Step 2.2)

> Paste this entire file into Lovable. Build the Checklists screen exactly as described.

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
// src/lib/actions/checklists.ts
import {
  getChecklists,
  getChecklistWithItems,
  createChecklist,
  updateChecklist,
  addChecklistItem,
  removeChecklistItem,
  getChecklistCompletion,
  upsertChecklistCompletion,
} from '@/lib/actions/checklists';
```

### Function signatures

```typescript
type ShiftType = 'morning' | 'afternoon' | 'evening' | 'night';
type ChecklistStatus = 'pending' | 'partial' | 'completed';

// List all active checklists (optionally filter by shift)
getChecklists(tenantId: string, shift?: ShiftType): Promise<Checklist[]>

// Get checklist with all its items
getChecklistWithItems(tenantId: string, id: string): Promise<ChecklistWithItems | null>

// Create checklist template
createChecklist(tenantId: string, data: { name: string; shift: ShiftType; active?: boolean }): Promise<Checklist>

// Update template (owner/manager)
updateChecklist(tenantId: string, id: string, data: Partial<{ name: string; shift: ShiftType; active: boolean }>): Promise<Checklist>

// Add item to template
addChecklistItem(tenantId: string, checklistId: string, item: { text: string; sortOrder?: number }): Promise<ChecklistItem>

// Remove item from template
removeChecklistItem(tenantId: string, itemId: string): Promise<void>

// Get today's completion record
getChecklistCompletion(tenantId: string, checklistId: string, date: string): Promise<ChecklistCompletion | null>

// Save/update completion (upsert)
upsertChecklistCompletion(tenantId: string, checklistId: string, date: string, update: {
  completedBy?: string | null;
  completedItems: string[];   // array of ChecklistItem IDs
  notes?: string | null;
  signatureUrl?: string | null;
}): Promise<ChecklistCompletion>
```

### Types

```typescript
interface Checklist {
  id: string;
  tenantId: string;
  name: string;
  shift: ShiftType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistItem {
  id: string;
  tenantId: string;
  checklistId: string;
  text: string;
  sortOrder: number;
  createdAt: string;
}

interface ChecklistCompletion {
  id: string;
  tenantId: string;
  checklistId: string;
  completionDate: string; // YYYY-MM-DD
  completedBy: string | null;
  signatureUrl: string | null;
  completedItems: string[]; // IDs of completed items
  notes: string | null;
  status: ChecklistStatus;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[];
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

Page: `src/app/(app)/[tenantSlug]/checklists/page.tsx`

- Call `requireTenant(params.tenantSlug)` to get `{ id, name, slug }`
- Call `getAuthContext()` from `@/lib/supabase/server` for userId
- Call `getUserRole(tenantId, userId)` from `@/lib/tenant` for userRole
- Pass `tenantId`, `tenantSlug`, `userRole`, `userId` to client component `<ChecklistsClient>`

---

## What to build

### 1. Page — `src/app/(app)/[tenantSlug]/checklists/page.tsx`

Server Component.

### 2. `_components/ChecklistsClient.tsx`

Main client component. Two tabs at top:

- **"מילוי יומי"** — daily completion view (default)
- **"ניהול תבניות"** — template management (owner/manager only, hidden for chef/staff)

**Default date** = today in `YYYY-MM-DD`.

#### Tab 1 — מילוי יומי (Daily Completion)

Layout:

```
┌─────────────────────────────────────────────────┐
│ [◀]  02/05/2026  [▶]                             │
├─────────────────────────────────────────────────┤
│ [בוקר] [צהריים] [ערב] [לילה]  ← shift filter    │
├─────────────────────────────────────────────────┤
│  📋 ציוד בוקר                  ✅ 5/5  [פתח]     │
│  📋 בטיחות                     ⏳ 2/4  [פתח]     │
│  📋 ניקיון כללי                 ○ 0/3  [פתח]     │
└─────────────────────────────────────────────────┘
```

**Shift tabs:** בוקר / צהריים / ערב / לילה (maps to morning/afternoon/evening/night)

**Checklist card** (each row):

- Checklist name
- Progress: `X/Y` items completed — color coded: green if all done, yellow if partial, gray if none
- Status badge: "הושלם" (green) / "חלקי" (yellow) / "ממתין" (gray)
- "פתח" button → opens `ChecklistCompletionSheet`

On date/shift change: re-load checklists for that shift, load completion for each.

#### Tab 2 — ניהול תבניות (Template Management, owner/manager only)

Layout:

```
┌─────────────────────────────────────────────────┐
│  [+ הוסף רשימה]                                  │
├─────────────────────────────────────────────────┤
│  ▼ ציוד בוקר  (בוקר)           [ערוך] [מחק]    │
│    ✓ לבדוק ציוד קירור                            │
│    ✓ לנקות משטחי עבודה                           │
│    [+ הוסף סעיף]                                  │
│                                                  │
│  ▼ בטיחות  (צהריים)            [ערוך] [מחק]    │
│    ...                                           │
└─────────────────────────────────────────────────┘
```

- Expandable accordion per checklist
- Each item has drag handle icon + text + trash icon (remove item)
- "הוסף סעיף" inline input (press Enter or click ✓ to save)
- "ערוך" → opens `ChecklistTemplateDrawer`
- "מחק" → calls `updateChecklist(..., { active: false })` (soft delete)

---

### 3. `_components/ChecklistCompletionSheet.tsx` — Daily Fill Sheet

Opens from right (`side="right"`, wide — `sm:max-w-lg`).

**Header:** Checklist name + date

**Content:** List of items as checkboxes:

```
☐ לבדוק ציוד קירור
☑ לנקות משטחי עבודה   ← checked = green bg
☐ לאמת מלאי
```

- Checking/unchecking item → updates `completedItems` array locally
- "שמור" button → calls `upsertChecklistCompletion` with current `completedItems`
- **הערות** Textarea (optional) below items
- **Progress bar** at top of sheet showing X/Y completed

Status auto-calculated:

- 0 checked → 'pending'
- All checked → 'completed'
- Some checked → 'partial'

Show completion timestamp if already completed (`completedAt` from status record).

**Buttons:** "שמור ✓" (primary, spinner while saving) / "סגור"

---

### 4. `_components/ChecklistTemplateDrawer.tsx` — Create/Edit Template

Opens from right.

**Fields:**

| שדה          | רכיב   | הערות              |
| ------------ | ------ | ------------------ |
| שם הרשימה \* | Input  | Required, max 100  |
| משמרת \*     | Select | 4 shifts in Hebrew |

**Validation (Hebrew):**

- שם: "שם הרשימה הוא שדה חובה"
- משמרת: "יש לבחור משמרת"

**Buttons:** "שמור" / "ביטול"

**Title:** "רשימה חדשה" / "עריכת רשימה"

On save: call `createChecklist` or `updateChecklist`, update local state.

---

## File structure

```
src/app/(app)/[tenantSlug]/checklists/
  page.tsx
  _components/
    ChecklistsClient.tsx
    ChecklistCompletionSheet.tsx
    ChecklistTemplateDrawer.tsx
```

---

## Shared UI rules

1. **RTL**: `text-right`, `flex-row-reverse` for icon+text
2. **Hebrew only** in UI
3. **shadcn/ui only**: Tabs, Sheet, Accordion, Checkbox, Progress, Badge, Input, Textarea, Select, Skeleton, Button
4. **No state library**: `useState` + `useTransition`
5. **Role guard**: template management tab only for owner/manager
6. **Toasts**: `useToast` on error
7. **Icons**: lucide-react — `Plus`, `Trash2`, `Pencil`, `CheckCircle2`, `Clock`, `ChevronRight`, `ChevronLeft`, `ClipboardList`, `GripVertical`

---

## Shift label mapping

| value     | Hebrew |
| --------- | ------ |
| morning   | בוקר   |
| afternoon | צהריים |
| evening   | ערב    |
| night     | לילה   |

---

## DO NOT

- Write Server Actions
- Install any packages
- Use fetch/axios
- Implement signature upload (leave signatureUrl as null for now)
