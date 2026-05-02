# Lovable Prompt — Manager Overrides (Step 2.4)

> Paste this entire file into Lovable. Build the Manager Override UI exactly as described.

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

## Context of use

This is NOT a standalone page. The override UI is embedded **inside the Prep List page** (`/prep`). When a manager views a prep task, they can override the AI-generated `qty_required` with a manual value.

Add to `src/app/(app)/[tenantSlug]/prep/_components/PrepTaskDrawer.tsx` (already exists from step 2.1).

---

## Server Actions to use (already implemented)

```typescript
// src/lib/actions/overrides.ts
import { createOverride, revertOverride, getOverrides } from '@/lib/actions/overrides';
```

### Function signatures

```typescript
interface ManagerOverride {
  id: string;
  tenantId: string;
  entityType: 'prep_task';
  entityId: string;
  field: string;
  originalValue: unknown;
  overrideValue: unknown;
  reason: string | null;
  overriddenBy: string;
  reverted: boolean;
  revertedBy: string | null;
  revertedAt: string | null;
  createdAt: string;
}

// Create override (applies immediately to prep_task qty_required)
createOverride(tenantId: string, data: {
  entityType: 'prep_task';
  entityId: string;
  field: 'qty_required';
  originalValue: number;
  overrideValue: number;
  reason?: string | null;
}): Promise<ManagerOverride>

// Revert a previous override (restores original value)
revertOverride(tenantId: string, overrideId: string): Promise<ManagerOverride>

// List overrides for a specific prep task
getOverrides(tenantId: string, options?: {
  entityType?: 'prep_task';
  entityId?: string;
  includeReverted?: boolean;
}): Promise<ManagerOverride[]>
```

---

## What to modify

### Update `src/app/(app)/[tenantSlug]/prep/_components/PrepTaskDrawer.tsx`

The drawer already has: status, qty_actual, notes fields.

**Add an "Override" section** at the bottom (visible only to owner/manager):

```
┌─────────────────────────────────────────────────┐
│ עדכון משימה                                       │
│                                                  │
│  סטטוס: [select]                                 │
│  כמות בפועל: [input]                             │
│  הערות: [textarea]                               │
│                                                  │
│  ──────────────────────────────────────────────  │
│  🔧 עקיפת תחזית (מנהל בלבד)                      │
│                                                  │
│  כמות נדרשת נוכחית: 45 יחידות  [← מוגדר ע"י מנהל]│
│  כמות חדשה: [input number]                       │
│  סיבה: [textarea, optional]                      │
│  [החל עקיפה]                                     │
│                                                  │
│  היסטוריית עקיפות:                               │
│  • 45 (היה: 30) — יוסי מ. לפני 2 שעות [בטל]    │
└─────────────────────────────────────────────────┘
```

**Override section behavior:**

1. On drawer open: call `getOverrides(tenantId, { entityType: 'prep_task', entityId: task.id })` to load history
2. Show current `task.qtyRequired` with label "כמות נדרשת נוכחית"
3. If an active (non-reverted) override exists → show badge "מוגדר ע\"י מנהל" next to the value
4. "החל עקיפה" button:
   - Validates new qty > 0
   - Calls `createOverride({ entityType: 'prep_task', entityId: task.id, field: 'qty_required', originalValue: task.qtyRequired, overrideValue: newQty, reason })`
   - Updates `task.qtyRequired` optimistically in the parent list
   - Clears the input
5. Override history list (max 5 entries):
   - Shows `overrideValue` (was: `originalValue`) + relative time + "בטל" button
   - "בטל" → calls `revertOverride`, marks item as reverted in UI

---

## Also update `PrepListClient.tsx`

Pass `tenantId` and `userRole` down to `PrepTaskDrawer` so it can show/hide the override section.

Props to add to `PrepTaskDrawer`:

```typescript
tenantId: string;
userRole: Role | null;
```

---

## File structure

Only modify existing files — do not create new pages:

```
src/app/(app)/[tenantSlug]/prep/_components/
  PrepTaskDrawer.tsx    ← modify to add override section
  PrepListClient.tsx    ← modify to pass tenantId + userRole to drawer
```

---

## Shared UI rules

1. **RTL**: `text-right`
2. **Hebrew only**
3. **shadcn/ui only**: Separator, Badge, Button, Input, Textarea, Skeleton
4. **Role guard**: override section only for `['owner', 'manager']`
5. **Toasts**: `useToast` on error
6. **Icons**: lucide-react — `Wrench`, `History`, `RotateCcw`, `AlertCircle`

---

## DO NOT

- Create new pages or routes
- Write Server Actions
- Install any packages
