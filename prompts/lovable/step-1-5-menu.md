# Lovable Prompt — Menu Management Page (Step 1.5)

> Paste this entire file into Lovable. Build the Menu Items management screen exactly as described.

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
// src/lib/actions/menu-items.ts
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleMenuItemActive,
  deleteMenuItem,
  linkRecipe,
} from '@/lib/actions/menu-items';

// src/lib/actions/recipes.ts
import { getRecipes } from '@/lib/actions/recipes';
```

### Function signatures

```typescript
// Returns MenuItem[]
getMenuItems(tenantId: string): Promise<MenuItem[]>

// Create — returns MenuItem
createMenuItem(tenantId: string, data: {
  nameHe: string;
  nameEn?: string | null;
  category: string;       // MenuCategory value
  priceCents: number;     // price in agorot
  posExternalId?: string | null;
  active?: boolean;
})

// Update — returns MenuItem
updateMenuItem(tenantId: string, id: string, data: Partial<{
  nameHe: string;
  nameEn: string | null;
  category: string;
  priceCents: number;
  posExternalId: string | null;
  active: boolean;
  recipeId: string | null;
}>)

// Toggle active/inactive — returns MenuItem
toggleMenuItemActive(tenantId: string, id: string)

// Link/unlink recipe — returns MenuItem
linkRecipe(tenantId: string, menuItemId: string, recipeId: string | null)

// Delete
deleteMenuItem(tenantId: string, id: string)

// For recipe search combobox
getRecipes(tenantId: string, type?: 'menu' | 'prep'): Promise<Recipe[]>
```

### Types

```typescript
type MenuCategory = 'appetizer' | 'main' | 'dessert' | 'drink' | 'side' | 'special';

interface MenuItem {
  id: string;
  tenantId: string;
  posExternalId: string | null;
  nameHe: string;
  nameEn: string | null;
  category: string;
  priceCents: number;
  active: boolean;
  recipeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Recipe {
  id: string;
  nameHe: string;
  type: 'menu' | 'prep';
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

Page: `src/app/(app)/[tenantSlug]/menu/page.tsx`

- Call `requireTenant(params.tenantSlug)` to get `{ id, name, slug }`
- Call `getAuthContext()` from `@/lib/supabase/server` for userId
- Call `getUserRole(tenantId, userId)` from `@/lib/tenant` for userRole
- Pass `tenantId`, `tenantSlug`, `userRole` to client component `<MenuClient>`

---

## What to build

### 1. Page — `src/app/(app)/[tenantSlug]/menu/page.tsx`

Server Component. Fetches tenant + role and passes to `<MenuClient>`.

### 2. `_components/MenuClient.tsx`

Main client component. Layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader: "תפריט"              [הוסף פריט]  [ייצא CSV]         │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 חיפוש פריט...                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [הכל] [מנות ראשונות] [עיקריות] [קינוחים] [שתייה] [תוספות] [מיוחד] │
├─────────────────────────────────────────────────────────────────┤
│ TABLE                                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Category tab → value mapping:**
| Tab | value |
|-----|-------|
| הכל | (all) |
| מנות ראשונות | `appetizer` |
| עיקריות | `main` |
| קינוחים | `dessert` |
| שתייה | `drink` |
| תוספות | `side` |
| מיוחד | `special` |

**Data table columns (RTL order — rightmost first):**

| שם מנה | קטגוריה | מחיר | מתכון מקושר | FC% | פעיל | פעולות |
| ------ | ------- | ---- | ----------- | --- | ---- | ------ |

- **שם מנה**: Hebrew name, optional English below in gray
- **קטגוריה**: Hebrew label (מנה ראשונה / עיקרית / קינוח / שתייה / תוסף / מיוחד)
- **מחיר**: `(priceCents / 100).toFixed(2) + ' ₪'`
- **מתכון מקושר**: recipe name if recipeId is set, otherwise "—" + "קשר מתכון" button
- **FC%**: shown only if recipe is linked AND theoreticalCostCents > 0, color-coded:
  - `< 30%` → green Badge
  - `30–35%` → yellow Badge
  - `> 35%` → red Badge
  - No recipe linked → "—"
- **פעיל**: Toggle switch — call `toggleMenuItemActive`; optimistic update
- **פעולות**: Pencil icon (edit) + Trash2 icon (delete, owner/manager only)

**FC% calculation (client-side, approximate):**
For display purposes only. This page does NOT call `getFCReport` — that's the separate cost analysis page. Here, show FC% only for items where we already know `theoreticalCostCents`. Pass it from the server or skip it here.

Actually: **do NOT show FC% on this page** — leave that column out entirely. It's on the cost analysis page. Keep this table simple: שם מנה, קטגוריה, מחיר, מתכון מקושר, פעיל, פעולות.

**Export CSV:**

- "ייצא CSV" button (owner/manager only)
- Client-side export of current filtered list
- Columns: שם,קטגוריה,מחיר,מזהה-POS
- Use `Blob` + `URL.createObjectURL` — no library

**Loading state:** 8 skeleton rows  
**Empty state:** "אין פריטי תפריט עדיין" + "הוסף פריט ראשון" button  
**Error state:** "שגיאה בטעינת התפריט. נסה שוב." + retry button

---

### 3. `_components/MenuItemDrawer.tsx` — Create/Edit Sheet

Opens from right (`side="right"`).

**Form fields:**

| שדה         | רכיב               | הערות                                       |
| ----------- | ------------------ | ------------------------------------------- |
| שם מנה \*   | Input              | Hebrew, required, max 100                   |
| שם באנגלית  | Input              | Optional                                    |
| קטגוריה \*  | Select             | 6 categories                                |
| מחיר (₪) \* | Input[type=number] | Display ₪, store as `Math.round(val * 100)` |
| מזהה POS    | Input              | Optional, external system ID                |

**Validation (Hebrew):**

- שם מנה: "שם המנה הוא שדה חובה"
- קטגוריה: "יש לבחור קטגוריה"
- מחיר: "המחיר חייב להיות 0 או יותר"

**Buttons:** "שמור" (primary, disabled+spinner while saving) / "ביטול"

**Title:** "הוספת פריט חדש" / "עריכת פריט"

---

### 4. `_components/LinkRecipePopover.tsx` — Link Recipe

Trigger: "קשר מתכון" button in the table.

**Popover content:**

```
┌──────────────────────────┐
│ 🔍 חפש מתכון...          │
├──────────────────────────┤
│ פסטה בולונז   (מנה)  [✓] │
│ ריזוטו פטריות (מנה)      │
│ ...                      │
├──────────────────────────┤
│ [הסר קישור]              │  ← only shown if already linked
└──────────────────────────┘
```

- Load recipes with `getRecipes(tenantId, 'menu')` on open
- Filter client-side by search input
- Click recipe → call `linkRecipe(tenantId, menuItemId, recipe.id)`
- "הסר קישור" → call `linkRecipe(tenantId, menuItemId, null)`
- Optimistic update: update local state immediately

---

### 5. `_components/DeleteMenuItemDialog.tsx` — AlertDialog

```
האם אתה בטוח?
מחיקת הפריט תסיר אותו מהתפריט לצמיתות.

[ביטול]  [מחק]
```

- Optimistic: remove from list immediately
- On error: restore + toast

---

## File structure

```
src/app/(app)/[tenantSlug]/menu/
  page.tsx
  _components/
    MenuClient.tsx
    MenuItemDrawer.tsx
    LinkRecipePopover.tsx
    DeleteMenuItemDialog.tsx
```

---

## Shared UI rules

1. **RTL**: text-right, flex-row-reverse for icon+text buttons
2. **Hebrew only** in UI
3. **shadcn/ui only**: Table, Sheet, Popover, AlertDialog, Switch, Badge, Input, Select, Skeleton
4. **No state library**: useState + useTransition
5. **Role guard**: wrap add/edit/delete in `<IfRole roles={['owner', 'manager']}>`
6. **Toasts**: shadcn `useToast`
7. **Icons**: lucide-react — `Plus`, `Download`, `Search`, `Pencil`, `Trash2`, `Link`, `Unlink`, `Check`

---

## DO NOT

- Write Server Actions
- Install any packages
- Use fetch/axios
- Implement FC% calculation — that's the cost analysis page
