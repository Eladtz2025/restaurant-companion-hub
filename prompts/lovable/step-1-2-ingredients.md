# Lovable Prompt — Ingredients UI (Step 1.2)

> Paste this entire file into Lovable. Build the Ingredients management screen exactly as described.

---

## Context

This is a multi-tenant restaurant operations app built with:

- **Next.js 15 App Router** — all pages are in `src/app/[tenantSlug]/`
- **React 19**, TypeScript strict mode
- **shadcn/ui** only — do not install or use any other component library
- **Tailwind CSS v4**
- **RTL Hebrew UI** — `dir="rtl"` is set on `<html>` globally; all text is Hebrew
- **Role system**: `owner > manager > chef > staff`. Only `owner` and `manager` can create/edit/delete ingredients.

The Server Actions already exist — **do not write any Server Actions, DB queries, or API calls yourself.**

---

## Server Actions to use (already implemented)

Import from the paths below. Use them exactly as typed — do not rename or wrap them.

```typescript
// src/lib/actions/ingredients.ts
import {
  getIngredients,
  getIngredient,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from '@/lib/actions/ingredients';

// src/lib/actions/ingredients-import.ts
import { importIngredientsAction } from '@/lib/actions/ingredients-import';
```

### Function signatures

```typescript
// Fetch list — returns { data: Ingredient[] } | { error: string }
getIngredients(tenantId: string, options?: { search?: string; category?: IngredientCategory })

// Create — returns { data: Ingredient } | { error: string }
createIngredient(tenantId: string, input: {
  nameHe: string;
  nameEn?: string | null;
  unit: IngredientUnit;
  category: IngredientCategory;
  costPerUnitCents?: number;
  pkgQty?: number | null;
})

// Update — returns { data: Ingredient } | { error: string }
updateIngredient(tenantId: string, id: string, input: Partial<{
  nameHe: string;
  nameEn: string | null;
  unit: IngredientUnit;
  category: IngredientCategory;
  costPerUnitCents: number;
  pkgQty: number | null;
  active: boolean;
}>)

// Delete — returns { data: undefined } | { error: string }
deleteIngredient(tenantId: string, id: string)

// CSV import — returns { imported: number; skipped: number; errors: string[] }
importIngredientsAction(tenantId: string, csvText: string)
```

### Types

```typescript
// src/lib/types/index.ts
type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';
type IngredientCategory = 'produce' | 'meat' | 'fish' | 'dairy' | 'dry' | 'alcohol' | 'other';

interface Ingredient {
  id: string;
  tenantId: string;
  nameHe: string;
  nameEn: string | null;
  unit: IngredientUnit;
  category: IngredientCategory;
  costPerUnitCents: number; // price in agorot (Israeli cents). Divide by 100 for ₪
  pkgQty: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Existing shared components to reuse

```typescript
// Page title bar with optional action buttons
import { PageHeader } from '@/components/shared/PageHeader';
// Props: { title: string; subtitle?: string; actions?: React.ReactNode }

// Role-based conditional render
import { IfRole } from '@/components/shared/IfRole';
// Props: { userRole: Role | null | undefined; roles: Role[]; children: ReactNode; fallback?: ReactNode }
```

---

## Route context

The page lives at:

```
src/app/[tenantSlug]/ingredients/page.tsx
```

The `tenantSlug` comes from `params`. Use it to call `requireTenant(tenantSlug)` (already used in other pages in this app) to get `{ id, name, slug }`. The `id` is the `tenantId` passed to all Server Actions.

For the user's role, call `getUserRole(tenantId, userId)` from `@/lib/tenant`.

The auth context (userId) is available from `getAuthContext()` from `@/lib/supabase/server`.

---

## What to build

### 1. Page — `/[tenantSlug]/ingredients`

File: `src/app/[tenantSlug]/ingredients/page.tsx`

This is a **Server Component** that:

- Calls `requireTenant(params.tenantSlug)` to get tenant
- Gets the user's role
- Passes `tenantId`, `tenantSlug`, and `userRole` down to a Client Component `<IngredientsClient>`

The Client Component `<IngredientsClient>` lives in:
`src/app/[tenantSlug]/ingredients/_components/IngredientsClient.tsx`

`IngredientsClient` owns all state and interaction.

---

### 2. IngredientsClient — full feature component

**Layout (RTL):**

```
┌─────────────────────────────────────────────────┐
│ PageHeader: "מרכיבים"          [הוסף מרכיב] [יבוא CSV]  │  ← buttons only for owner/manager
├─────────────────────────────────────────────────┤
│ 🔍 חיפוש מרכיב...                               │  ← search input, right-aligned placeholder
├─────────────────────────────────────────────────┤
│ [הכל] [ירקות ופירות] [בשר ודגים] [חלבי] [יבש] [אלכוהול] [אחר] │  ← filter tabs
├─────────────────────────────────────────────────┤
│ table / card list                               │
└─────────────────────────────────────────────────┘
```

**Filter tab → category mapping:**
| Tab label | category value passed to getIngredients |
|-----------|----------------------------------------|
| הכל | (no filter — omit category param) |
| ירקות ופירות | `produce` |
| בשר ודגים | `meat` and `fish` — fetch both and merge client-side, OR use no category filter and filter client-side |
| חלבי | `dairy` |
| יבש | `dry` |
| אלכוהול | `alcohol` |
| אחר | `other` |

> Simpler: fetch all and filter client-side by category. getIngredients with no options returns all for the tenant.

**Data table (desktop, ≥768px):**

Columns in RTL order (rightmost = first visually):
| שם | יחידה | קטגוריה | מחיר ליחידה | פעולות |
| Hebrew name | unit label | category label | price in ₪ | edit/delete icons |

- Unit display labels: `kg→ק"ג`, `g→גרם`, `l→ליטר`, `ml→מ"ל`, `unit→יחידה`, `pkg→אריזה`
- Category display labels: `produce→ירקות ופירות`, `meat→בשר`, `fish→דגים`, `dairy→חלבי`, `dry→יבש`, `alcohol→אלכוהול`, `other→אחר`
- Price: `(costPerUnitCents / 100).toFixed(2) + ' ₪'`
- Edit icon (Pencil) and Delete icon (Trash2) from lucide-react
- Delete icon only visible for owner/manager
- Table text alignment: `text-right` on all cells

**Mobile card list (<768px):**

Each ingredient as a card:

```
┌──────────────────────────────┐
│ עגבנייה          [✏] [🗑]   │
│ ירקות ופירות · ק"ג · 4.50 ₪ │
└──────────────────────────────┘
```

**Empty state:**

```
אין מרכיבים עדיין
[הוסף מרכיב ראשון]   ← button, owner/manager only
```

Different message when search returns nothing:

```
לא נמצאו מרכיבים התואמים לחיפוש
```

**Loading skeleton:**
8 rows of `<Skeleton className="h-10 w-full" />` while data loads.

**Error state:**

```
שגיאה בטעינת המרכיבים. נסה שוב.   [נסה שוב]
```

---

### 3. Create/Edit Drawer (Sheet)

Use shadcn `Sheet` component. Opens from the **right** side (`side="right"`).

Trigger: clicking "הוסף מרכיב" (new) or the Pencil icon (edit).

**Form fields:**

| Field           | Component                            | Notes                                                           |
| --------------- | ------------------------------------ | --------------------------------------------------------------- |
| שם מרכיב \*     | Input                                | Hebrew placeholder "שם המרכיב בעברית", max 100 chars            |
| שם באנגלית      | Input                                | Optional, English name                                          |
| יחידה \*        | Select                               | Options: ק"ג / גרם / ליטר / מ"ל / יחידה / אריזה                 |
| קטגוריה \*      | Select                               | Options: ירקות ופירות / בשר / דגים / חלבי / יבש / אלכוהול / אחר |
| מחיר ליחידה (₪) | Input[type=number, step=0.01, min=0] | Display in ₪, store as `Math.round(value * 100)`                |
| כמות לאריזה     | Input[type=number, step=1, min=1]    | Optional                                                        |

**Validation (client-side, Hebrew error messages):**

- שם מרכיב: required → "שם המרכיב הוא שדה חובה"
- יחידה: required → "יש לבחור יחידת מידה"
- קטגוריה: required → "יש לבחור קטגוריה"
- מחיר: must be ≥ 0 if provided → "המחיר חייב להיות 0 או יותר"

Show validation errors inline, below the relevant field.

**Buttons:**

- "שמור" (primary) — disabled + spinner while submitting
- "ביטול" (ghost) — closes drawer

**On submit:**

- New: call `createIngredient(tenantId, { nameHe, nameEn, unit, category, costPerUnitCents, pkgQty })`
- Edit: call `updateIngredient(tenantId, ingredient.id, patch)`
- On `{ error }` response: show error toast in Hebrew
- On `{ data }` response: close drawer, refresh list

**Sheet title:**

- New: "הוספת מרכיב חדש"
- Edit: "עריכת מרכיב"

---

### 4. Delete Confirmation (AlertDialog)

Use shadcn `AlertDialog`.

Trigger: clicking the Trash2 icon.

Content:

```
האם אתה בטוח?
מחיקת מרכיב תשפיע על מתכונים קיימים שמשתמשים בו.

[ביטול]  [מחק]   ← "מחק" is destructive (red variant)
```

On confirm:

- Optimistic: immediately remove ingredient from local list
- Call `deleteIngredient(tenantId, id)`
- On error: restore ingredient to list, show error toast

---

### 5. CSV Import Modal (Dialog)

Trigger: clicking "יבוא CSV" button (owner/manager only).

**Step 1 — Upload:**

```
┌─────────────────────────────────────────────┐
│           יבוא מרכיבים מקובץ CSV            │
├─────────────────────────────────────────────┤
│                                             │
│   📄  גרור קובץ CSV לכאן                   │
│       או לחץ לבחירת קובץ                   │
│                                             │
│   פורמט נתמך: שם, יחידה, קטגוריה,          │
│   מחיר ליחידה, כמות לאריזה                  │
│                                             │
└─────────────────────────────────────────────┘
```

- Accept `.csv` files only
- On file selected: read as text with `FileReader`, parse client-side using `parseIngredientCSV` from `@/lib/ingredients/csv-importer`
- Move to Step 2

**Step 2 — Preview:**

Show a preview table of parsed rows:

| שם       | יחידה | קטגוריה      | מחיר                           |
| -------- | ----- | ------------ | ------------------------------ |
| עגבנייה  | ק"ג   | ירקות ופירות | 4.50 ₪                         |
| ❌ שגיאה | —     | —            | שורה 3: יחידה לא מוכרת — "XXX" |

- Valid rows: normal styling
- Invalid rows: red background, show reason in the last column
- Summary above table: "נמצאו X מרכיבים תקינים, X שורות עם שגיאות"

Buttons:

- "יבוא X מרכיבים" (primary, X = valid count) — disabled if valid count is 0
- "ביטול" (ghost)

**Step 3 — Importing:**

Show spinner + "מייבא מרכיבים..."

On complete, show results:

```
✅ יובאו 8 מרכיבים בהצלחה
⚠️ 2 שורות דולגו עקב שגיאות:
   • שורה 3: יחידה לא מוכרת — "XXX"
   • שורה 7: מחיר לא תקין
```

Button: "סגור" — closes dialog, refreshes list

---

## Shared UI rules

1. **RTL everywhere**: text-right, flex-row-reverse where needed for icon+text buttons, Sheet opens from right
2. **Hebrew only**: every visible string must be in Hebrew. No English labels in the UI.
3. **shadcn/ui only**: Button, Input, Select, Sheet, Dialog, AlertDialog, Tabs, Skeleton, Badge, Table, TableHeader, TableRow, TableCell. No other libraries.
4. **No state management library**: useState + useTransition only
5. **Role guard**: wrap all create/edit/delete UI in `<IfRole userRole={userRole} roles={['owner', 'manager']}>...</IfRole>`
6. **Toasts**: use shadcn `useToast` hook for success/error messages
7. **Icons**: lucide-react only — `Search`, `Plus`, `Upload`, `Pencil`, `Trash2`, `FileText`, `CheckCircle`, `AlertCircle`

---

## File structure to produce

```
src/app/[tenantSlug]/ingredients/
  page.tsx                          ← Server Component
  _components/
    IngredientsClient.tsx           ← main Client Component
    IngredientDrawer.tsx            ← create/edit Sheet
    DeleteIngredientDialog.tsx      ← AlertDialog
    CsvImportDialog.tsx             ← Dialog (3 steps)
    IngredientTable.tsx             ← desktop table
    IngredientCards.tsx             ← mobile card list
    IngredientFilters.tsx           ← search + tabs
```

---

## DO NOT

- Write Server Actions (they already exist — import them)
- Write DB migrations
- Use `fetch` or `axios` — call Server Actions directly
- Install any new packages
- Use any component not in shadcn/ui
- Create a `useTenant` hook — use the `tenantId` prop passed from the Server Component
- Hardcode any mock data — all data comes from Server Actions

---

## Notes on RTL

- The global layout already sets `<html dir="rtl" lang="he">` — you do not need to set this
- `Sheet` with `side="right"` slides in from the right (which is the "start" side in RTL Hebrew)
- Table column order: in RTL the first column is on the right, so `שם` appears rightmost
- Button groups: in RTL, the primary action is on the left, secondary on the right — mirror English conventions
