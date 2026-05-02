# Lovable Prompt — Food Cost Report + AI Recipe Assistant (Step 1.5)

> Paste this entire file into Lovable. Build the FC Report page and AI BOM assistant exactly as described.

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
// src/lib/actions/fc-report.ts
import { getFCReport } from '@/lib/actions/fc-report';

// src/lib/actions/ai-recipe.ts
import { generateRecipeBOM } from '@/lib/actions/ai-recipe';

// src/lib/actions/recipes.ts
import { createRecipe, addComponent } from '@/lib/actions/recipes';
```

### Function signatures

```typescript
// Returns full FC report (cached 5 min)
getFCReport(tenantId: string): Promise<FCReport>

// AI generates a recipe BOM from a Hebrew description
generateRecipeBOM(tenantId: string, description: string): Promise<GenerateRecipeBOMResult>

// Create a new recipe
createRecipe(tenantId: string, data: {
  nameHe: string;
  type: 'menu' | 'prep';
  yieldQty?: number;
  yieldUnit?: IngredientUnit;
}): Promise<Recipe>

// Add component to recipe
addComponent(tenantId: string, recipeId: string, component: {
  ingredientId?: string | null;
  qty: number;
  unit: IngredientUnit;
}): Promise<RecipeComponent>
```

### Types

```typescript
interface FCReport {
  rows: MenuItemFCRow[];
  averageFcPercent: number;
  itemsWithMissingCosts: number;
  generatedAt: Date;
}

interface MenuItemFCRow {
  menuItemId: string;
  nameHe: string;
  category: string;
  priceCents: number;
  theoreticalCostCents: number;
  fcPercent: number;
  marginCents: number;
  missingCosts: string[]; // ingredient names with no price set
}

interface GenerateRecipeBOMResult {
  bom: GeneratedBOM;
  matchedIngredients: MatchResult[];
}

interface GeneratedBOM {
  recipeNameHe: string;
  yieldQty: number;
  yieldUnit: IngredientUnit;
  components: GeneratedBOMComponent[];
  instructionsSummary: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

interface GeneratedBOMComponent {
  ingredientNameHe: string;
  qty: number;
  unit: IngredientUnit;
  notes: string | null;
}

interface MatchResult {
  ingredientNameHe: string;
  matchedIngredientId: string | null;
  matchedIngredientNameHe: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
}

type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';
```

---

## Existing shared components

```typescript
import { PageHeader } from '@/components/shared/PageHeader';
import { IfRole } from '@/components/shared/IfRole';
```

---

## Route context

Page: `src/app/(app)/[tenantSlug]/menu/cost-analysis/page.tsx`

- Server Component: call `requireTenant`, `getAuthContext`, `getUserRole`
- Pass `tenantId`, `tenantSlug`, `userRole` to `<FCReportClient>`

---

## What to build

### 1. Page — `src/app/(app)/[tenantSlug]/menu/cost-analysis/page.tsx`

Server Component.

### 2. `_components/FCReportClient.tsx`

Main client component. Two-panel layout on desktop, stacked on mobile:

```
┌─────────────────────────────┬───────────────────────────────────┐
│   FC REPORT TABLE (70%)     │   AI ASSISTANT PANEL (30%)        │
│                             │                                   │
│   [Summary row]             │   [AI panel — see below]          │
│   [Table]                   │                                   │
└─────────────────────────────┴───────────────────────────────────┘
```

On mobile (< 768px): stack vertically — table first, AI panel below (or in a Sheet drawer triggered by a FAB button).

---

### 3. `_components/FCReportTable.tsx` — Report Table

**Summary row at top:**

```
┌──────────────────────────────────────────────────────┐
│  FC ממוצע: 28.5%  │  פריטים ללא עלות: 3  │  [🔄 רענן] │
└──────────────────────────────────────────────────────┘
```

- "רענן" calls `getFCReport` again and updates state

**Table (sorted by fcPercent descending by default, click header to sort):**

Columns (RTL):

| מנה | קטגוריה | מחיר | עלות | FC% | מרווח | סטטוס |
| --- | ------- | ---- | ---- | --- | ----- | ----- |

- **מנה**: Hebrew name
- **קטגוריה**: Hebrew category label
- **מחיר**: `(priceCents / 100).toFixed(2) + ' ₪'`
- **עלות**: `(theoreticalCostCents / 100).toFixed(2) + ' ₪'` — show "—" if 0 and no recipe linked
- **FC%**: `fcPercent.toFixed(1) + '%'` — color-coded Badge:
  - `< 30%` → green (`bg-green-100 text-green-800`)
  - `30–35%` → yellow (`bg-yellow-100 text-yellow-800`)
  - `> 35%` → red (`bg-red-100 text-red-800`)
  - No cost data → gray "אין נתונים"
- **מרווח**: `(marginCents / 100).toFixed(2) + ' ₪'`
- **סטטוס**: warning icon (⚠️) if `missingCosts.length > 0` with tooltip listing missing ingredient names. Show nothing if no missing costs.

**Tooltip for missing costs:**
Use shadcn `Tooltip`. Content: "חסרות עלויות:\n• עגבניות\n• שמן זית"

**Sort:** clicking a column header toggles asc/desc. Default: FC% descending.

**Loading skeleton:** 8 rows while data loads.

**Empty state:** "לא נמצאו פריטי תפריט מקושרים למתכונים."

**"הורד PDF" button** (placeholder):

- Show the button but on click show toast: "ייצוא PDF יהיה זמין בגרסה הבאה"

---

### 4. `_components/AIAssistantPanel.tsx` — AI Recipe BOM Assistant

Panel on the right side (desktop) or Sheet (mobile).

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  🤖 עוזר יצירת מתכונים                            │
├──────────────────────────────────────────────────┤
│                                                  │
│  תאר מנה חדשה בעברית חופשית:                     │
│  ┌────────────────────────────────────────────┐  │
│  │ לדוגמה: פסטה ברוטב עגבניות עם בשר טחון... │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [✨ צור BOM]                                    │
│                                                  │
├──────────────────────────────────────────────────┤
│  [BOM PREVIEW — appears after generation]        │
└──────────────────────────────────────────────────┘
```

**States:**

**Idle:** textarea + "צור BOM" button

**Loading (3–10 seconds):**

```
┌──────────────────────────────────────┐
│    ✨ יוצר מתכון...                   │
│    [spinner]                         │
│    זה יכול לקחת עד 10 שניות          │
└──────────────────────────────────────┘
```

**Result preview:**

```
┌──────────────────────────────────────┐
│  פסטה ארביאטה          [confidence]  │
│  תשואה: 4 מנות                       │
├──────────────────────────────────────┤
│  מרכיב          כמות   יחידה  מצב   │
│  עגבניות        400    g      ✓     │  ← ✓ = matched
│  שמן זית        50     ml     ✓     │
│  שום            3      unit   ~     │  ← ~ = fuzzy match
│  פלפל חריף      2      unit   ?     │  ← ? = not found in DB
├──────────────────────────────────────┤
│  ⚠️ אזהרות: [only if bom.warnings]   │
│  • כמות הפלפל החריף אינה ודאית       │
├──────────────────────────────────────┤
│  הוראות: מחממים שמן זית בסיר...      │
├──────────────────────────────────────┤
│  [הוסף למתכונים]    [נסה שוב]        │
└──────────────────────────────────────┘
```

**confidence badge:**

- `high` → "ביטחון גבוה" green
- `medium` → "ביטחון בינוני" yellow
- `low` → "ביטחון נמוך" red

**Match status icons:**

- ✓ (Check, green) = `confidence: 'exact'`
- ~ (tilde as text or AlertCircle, yellow) = `confidence: 'fuzzy'`
- ? (HelpCircle, gray) = `confidence: 'none'`

**"הוסף למתכונים" button:**

On click:

1. Call `createRecipe(tenantId, { nameHe: bom.recipeNameHe, type: 'menu', yieldQty: bom.yieldQty, yieldUnit: bom.yieldUnit })`
2. For each component where `matchedIngredientId !== null`:
   - Call `addComponent(tenantId, recipe.id, { ingredientId: match.matchedIngredientId, qty: comp.qty, unit: comp.unit })`
3. Show progress: "יוצר מתכון..." then "מוסיף X מרכיבים..."
4. On success: toast "המתכון נוצר בהצלחה — X מרכיבים נוספו" + link to recipe page
5. On error: toast in Hebrew

Components with `confidence: 'none'` are skipped (not added) — show note: "X מרכיבים לא נמצאו בבסיס הנתונים ולא נוספו"

**Link to recipe after creation:**

```tsx
<a href={`/${tenantSlug}/recipes/${recipe.id}`}>צפה במתכון</a>
```

**Error state:**
If `generateRecipeBOM` throws → show error card:

```
⚠️ לא הצלחנו ליצור את ה-BOM
[error message]
[נסה שוב]
```

---

## File structure to produce

```
src/app/(app)/[tenantSlug]/menu/cost-analysis/
  page.tsx
  _components/
    FCReportClient.tsx
    FCReportTable.tsx
    AIAssistantPanel.tsx
```

---

## Shared UI rules

1. **RTL everywhere**
2. **Hebrew only**
3. **shadcn/ui only**: Table, Badge, Tooltip, Skeleton, Textarea, Sheet, Button
4. **No state library**
5. **Role guard**: "הוסף למתכונים" available to chef and above (not staff)
6. **Toasts**: shadcn `useToast`
7. **Icons**: lucide-react — `Sparkles`, `RefreshCw`, `Download`, `Check`, `AlertCircle`, `HelpCircle`, `Plus`, `ExternalLink`

---

## DO NOT

- Write Server Actions
- Write DB migrations
- Install packages
- Implement FC% calculation — use `getFCReport` which already computes it
- Add pagination — the report is small (< 200 items)
