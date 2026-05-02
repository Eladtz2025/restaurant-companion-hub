# Lovable Prompt — Recipes UI (Step 1.3)

> Paste this entire prompt into Lovable. Build the Recipes management screens exactly as described.

---

## Context

Multi-tenant restaurant operations app:

- **Next.js 15 App Router** — pages in `src/app/[tenantSlug]/`
- **React 19**, TypeScript strict mode
- **shadcn/ui only** — no other component library
- **Tailwind CSS v4**
- **RTL Hebrew UI** — `dir="rtl"` is set globally; all text is Hebrew
- **Roles**: `owner > manager > chef > staff`. Only `owner` and `manager` can create/edit recipes.

**Do not write Server Actions, DB queries, or API calls. They already exist.**

---

## Server Actions (already implemented)

```typescript
// src/lib/actions/recipes.ts
import {
  getRecipes,
  getRecipesWithCosts,
  getRecipeWithComponents,
  createRecipe,
  updateRecipe,
  addComponent,
  updateComponent,
  removeComponent,
} from '@/lib/actions/recipes';
```

### Signatures

```typescript
// Returns all active recipes with pre-computed cost
getRecipesWithCosts(tenantId: string, type?: 'menu' | 'prep')
  → Promise<(Recipe & { theoreticalCostCents: number })[]>

// Returns one recipe with its full component list
getRecipeWithComponents(tenantId: string, id: string)
  → Promise<RecipeWithComponents | null>

// Create new recipe → redirect to detail page
createRecipe(tenantId: string, data: {
  nameHe: string;
  nameEn?: string | null;
  type: 'menu' | 'prep';
  yieldQty?: number;
  yieldUnit?: 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';
}) → Promise<Recipe>

// Update recipe metadata
updateRecipe(tenantId: string, id: string, data: Partial<{
  nameHe: string; nameEn: string | null;
  type: 'menu' | 'prep';
  yieldQty: number; yieldUnit: IngredientUnit;
  active: boolean;
}>) → Promise<Recipe>

// Add ingredient or sub-recipe to BOM
addComponent(tenantId: string, recipeId: string, component: {
  ingredientId?: string | null;
  subRecipeId?: string | null;
  qty: number;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';
  sortOrder?: number;
}) → Promise<RecipeComponent>
// NOTE: throws Error('לא ניתן להוסיף — יוצר לולאה במתכון') if a cycle is detected

// Update quantity/unit of an existing component
updateComponent(tenantId: string, componentId: string, data: Partial<{
  qty: number; unit: IngredientUnit; sortOrder: number;
}>) → Promise<RecipeComponent>

// Remove component from BOM
removeComponent(tenantId: string, componentId: string) → Promise<void>
```

### Types

```typescript
// src/lib/types/index.ts
type RecipeType = 'menu' | 'prep';
type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';

interface Recipe {
  id: string;
  tenantId: string;
  nameHe: string;
  nameEn: string | null;
  type: RecipeType;
  yieldQty: number;
  yieldUnit: IngredientUnit;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RecipeComponent {
  id: string;
  tenantId: string;
  recipeId: string;
  ingredientId: string | null;
  subRecipeId: string | null;
  qty: number;
  unit: IngredientUnit;
  sortOrder: number;
  createdAt: string;
}

interface RecipeWithComponents extends Recipe {
  components: RecipeComponent[];
}
```

For the ingredient search combobox on the BOM editor, also import:

```typescript
import { getIngredients } from '@/lib/actions/ingredients';
// returns { data: Ingredient[] } | { error: string }
// Ingredient has: id, nameHe, unit, costPerUnitCents
```

For the sub-recipe search combobox, use `getRecipes(tenantId, 'prep')` which returns `Recipe[]`.

---

## Shared components to reuse

```typescript
import { PageHeader } from '@/components/shared/PageHeader';
// Props: { title: string; subtitle?: string; actions?: React.ReactNode }

import { IfRole } from '@/components/shared/IfRole';
// Props: { userRole: Role; roles: Role[]; children: ReactNode }
```

---

## Route context

```
src/app/[tenantSlug]/recipes/page.tsx          ← list page
src/app/[tenantSlug]/recipes/[id]/page.tsx     ← detail/editor page
```

Get tenant: `requireTenant(params.tenantSlug)` → `{ id, name, slug }`
Get user role: `getUserRole(tenantId, userId)` from `@/lib/tenant`
Get userId: `getAuthContext()` from `@/lib/supabase/server`

---

## What to build

### 1. Recipes list page — `/[tenantSlug]/recipes`

**Server Component** (`page.tsx`):

- Calls `requireTenant`, gets role, passes `tenantId` + `userRole` to `<RecipesClient>`

**Client Component** `_components/RecipesClient.tsx`:

Layout:

```
┌─────────────────────────────────────────────┐
│ PageHeader: "מתכונים"        [+ מתכון חדש]  │  ← button for manager/owner only
├─────────────────────────────────────────────┤
│ 🔍 חיפוש מתכון...                           │
├─────────────────────────────────────────────┤
│ [הכל]  [מנות תפריט]  [הכנות]               │  ← filter tabs
├─────────────────────────────────────────────┤
│  cards grid (3 cols desktop, 2 tablet, 1 mobile) │
└─────────────────────────────────────────────┘
```

**Recipe card:**

```
┌──────────────────────────────────┐
│ [badge: מנה / הכנה]              │
│                                  │
│  שם המתכון בעברית                │  ← large, bold
│                                  │
│  עלות: ₪12.50    5 מרכיבים       │
│                                  │
│  [עריכה]                         │  ← button → navigate to /recipes/[id]
└──────────────────────────────────┘
```

- Type badge: `type === 'menu'` → badge text "מנה", color blue; `type === 'prep'` → badge text "הכנה", color amber
- Cost: `(theoreticalCostCents / 100).toFixed(2) + ' ₪'`. If 0 → show "עלות לא ידועה" in gray
- Clicking "עריכה" navigates to `/[tenantSlug]/recipes/[id]`
- Search filters cards client-side by `nameHe`

**Empty state:**

```
אין מתכונים עדיין
[צור מתכון ראשון]   ← manager/owner only
```

**Loading:** 6 skeleton cards

**Error:**

```
שגיאה בטעינת המתכונים. [נסה שוב]
```

---

### 2. New recipe modal (Dialog)

Triggered by "+ מתכון חדש" button.

Fields:
| Field | Component | Notes |
|-------|-----------|-------|
| שם המתכון _ | Input | Hebrew, required, max 100 |
| סוג _ | Select | "מנה תפריט" → `menu`, "הכנה" → `prep` |
| כמות תפוקה | Input[number] | default 1 |
| יחידת תפוקה | Select | ק"ג / גרם / ליטר / מ"ל / יחידה / אריזה, default יחידה |

On submit:

- Call `createRecipe(tenantId, { nameHe, type, yieldQty, yieldUnit })`
- On success: navigate to `/[tenantSlug]/recipes/[recipe.id]`
- On error: show Hebrew error toast

Buttons: "צור מתכון" (primary, with spinner) + "ביטול" (ghost)

---

### 3. Recipe detail / BOM editor — `/[tenantSlug]/recipes/[id]`

**Server Component** (`page.tsx`):

- Calls `requireTenant`, gets role and userId
- Passes to `<RecipeEditorClient>`

**Client Component** `_components/RecipeEditorClient.tsx`:

Full layout:

```
┌──────────────────────────────────────────────────┐
│ ← חזרה למתכונים          [שמור שינויים]          │
├──────────────────────────────────────────────────┤
│  [badge סוג]  שם המתכון           [עריכה מוטבעת] │
│  תפוקה: 1 יחידה                                  │
├──────────────────────────────────────────────────┤
│  רכיבי המתכון                                    │
│  ┌─────────────────────────────────────────────┐ │
│  │ שם מרכיב     כמות    יחידה    עלות    [הסר] │ │
│  │ ...                                         │ │
│  └─────────────────────────────────────────────┘ │
│  [+ הוסף מרכיב]   [+ הוסף תת-מתכון]             │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────┐                    │
│  │  עלות תיאורטית              │  ← live cost panel │
│  │  ₪ 24.50                    │                    │
│  │  ⚠ 2 מרכיבים חסרי מחיר     │                    │
│  └──────────────────────────┘                    │
└──────────────────────────────────────────────────┘
```

#### Recipe header (editable inline)

- Recipe name: click to edit inline (Input that appears on click, saves on blur/Enter via `updateRecipe`)
- Type badge: "מנה" (blue) or "הכנה" (amber)
- Yield: "תפוקה: {yieldQty} {yieldUnit label}"
- "שמור שינויים" button: calls `updateRecipe` with changed fields, disabled if no changes

#### BOM table — "רכיבי המתכון"

Columns (RTL — rightmost first):
| שם | כמות | יחידה | עלות | הסר |

- **שם**: if `ingredientId` — ingredient name; if `subRecipeId` — recipe name + "(הכנה)"
- **כמות**: editable inline Input[number]; on blur → `updateComponent(tenantId, component.id, { qty })`
- **יחידה**: Select; on change → `updateComponent(tenantId, component.id, { unit })`
- **עלות**: computed client-side: `(ingredientCostPerUnit / 100 * qty).toFixed(2) + ' ₪'`. Show "—" if cost unknown or sub-recipe.
- **הסר**: Trash2 icon → `removeComponent(tenantId, component.id)`, remove row optimistically

#### "הוסף מרכיב" flow

Button opens a Dialog with searchable combobox (shadcn Command):

- Load ingredients from `getIngredients(tenantId)` (load once on mount, reuse)
- Search by Hebrew name
- Select → show qty + unit inputs inline
- "הוסף" → `addComponent(tenantId, recipeId, { ingredientId, qty, unit })`
- On error "לא ניתן להוסיף — יוצר לולאה במתכון": show that exact text in error toast
- On success: component appears in BOM table, cost panel updates

#### "הוסף תת-מתכון" flow

Same pattern:

- Load prep recipes via `getRecipes(tenantId, 'prep')`
- Calls `addComponent(tenantId, recipeId, { subRecipeId, qty, unit })`

#### Live cost panel

```
┌─────────────────────────────┐
│  עלות תיאורטית              │
│  ₪ 24.50                    │  ← large
│                             │
│  ⚠ 2 מרכיבים חסרי מחיר     │  ← amber, only if > 0
└─────────────────────────────┘
```

Client-side cost computation on every change:

```typescript
let totalAgorot = 0;
let missingCount = 0;
for (const comp of components) {
  if (comp.ingredientId) {
    const ing = ingredientsMap.get(comp.ingredientId);
    if (ing) totalAgorot += ing.costPerUnitCents * comp.qty;
    else missingCount++;
  }
  // sub-recipe: skip (show "—" per row, not in total)
}
const totalShekel = (totalAgorot / 100).toFixed(2);
```

---

## File structure to produce

```
src/app/[tenantSlug]/recipes/
  page.tsx
  _components/
    RecipesClient.tsx
    RecipeCard.tsx
    NewRecipeDialog.tsx
  [id]/
    page.tsx
    _components/
      RecipeEditorClient.tsx
      BomTable.tsx
      AddComponentPopover.tsx
      LiveCostPanel.tsx
```

---

## Shared UI rules

1. **RTL everywhere**: `text-right`, `flex-row-reverse` for icon+text buttons
2. **Hebrew only** — no English labels visible
3. **shadcn/ui only**: Button, Input, Select, Dialog, Command, Table, Badge, Skeleton, Tabs, Popover
4. **No state management library** — `useState` + `useTransition` only
5. **Role guard**: `<IfRole userRole={userRole} roles={['owner', 'manager']}>` around create/edit/delete
6. **Toasts**: `useToast` for all feedback
7. **Icons**: lucide-react — `ArrowRight`, `Plus`, `Trash2`, `Pencil`, `ChefHat`, `AlertTriangle`
8. **Optimistic updates**: remove component immediately, restore on error

## DO NOT

- Write Server Actions or DB queries
- Use `fetch` or `axios`
- Install new packages
- Use mock/hardcoded data
- Recompute sub-recipe costs recursively client-side (show "—")
- Create a `useTenant` hook — use `tenantId` prop from Server Component
