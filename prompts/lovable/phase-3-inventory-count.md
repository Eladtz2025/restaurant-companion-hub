# Lovable Prompt — Phase 3 Inventory Count UI

## Context

Stack: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, RTL Hebrew (dir="rtl").
Routing: `src/app/(app)/[tenantSlug]/inventory/count/page.tsx` and `src/app/(app)/[tenantSlug]/inventory/snapshot/page.tsx`.

Server Actions already exist:

- `src/lib/actions/inventory.ts`:
  - `getIngredientsForCount(tenantId, category?)` → `IngredientForCount[]`
  - `saveCountRow(tenantId, ingredientId, date, qtyCounted, notes?)` → `InventorySnapshot`
  - `getCountForDate(tenantId, date)` → `InventorySnapshot[]`
  - `getVarianceReport(tenantId, date, thresholdPct?)` → `InventorySnapshot[]`

Types:

```ts
type IngredientForCount = {
  id: string;
  nameHe: string;
  unit: string;
  category: string; // 'produce' | 'meat' | 'fish' | 'dairy' | 'dry' | 'alcohol' | 'other'
  lastCounted: number | null;
  lastCountDate: string | null;
  qtyExpected: number | null;
};

type InventorySnapshot = {
  id: string;
  tenantId: string;
  ingredientId: string;
  ingredientNameHe: string;
  unit: string;
  qtyExpected: number | null;
  qtyCounted: number | null;
  variance: number | null;
  countDate: string;
  countedBy: string | null;
  notes: string | null;
  createdAt: string;
};
```

---

## Page 1 — `/[tenantSlug]/inventory/count`

### Purpose

Mobile-first screen for counting physical stock. Staff member walks the storeroom and enters counted quantities.

### Layout

```
┌──────────────────────────────────────────┐
│  ← ספירת מלאי          [תאריך: 03/05/26] │
├──────────────────────────────────────────┤
│  [הכל] [ירקות] [בשר/דגים] [חלבי] [יבש] [אלכוהול] │
├──────────────────────────────────────────┤
│  32/80 מרכיבים נספרו ████████░░░░ 40%   │
├──────────────────────────────────────────┤
│  🟡 עגבנייה                             │
│     צפוי: 8.5 ק"ג                       │
│  [        9.2       ] ק"ג  ✓           │
│  ─────────────────────────────────────  │
│  🟢 בצל                                 │
│     צפוי: 12.0 ק"ג                      │
│  [               ] ק"ג  ○              │
│  ─────────────────────────────────────  │
│  ...                                    │
├──────────────────────────────────────────┤
│        [ סיים ספירה → ]                 │
└──────────────────────────────────────────┘
```

### Requirements

1. **Header**: Page title "ספירת מלאי", date selector defaulting to today (YYYY-MM-DD format for API calls, displayed DD/MM/YY).

2. **Category tabs** (horizontal scroll on mobile):
   - הכל | ירקות (produce) | בשר/דגים (meat+fish) | חלבי (dairy) | יבש (dry) | אלכוהול (alcohol) | אחר (other)
   - Active tab has primary color underline

3. **Progress bar**: "X/Y מרכיבים נספרו" with filled bar showing percentage.

4. **Ingredient rows** (one per ingredient, sorted by name_he):
   - Ingredient name (font-semibold, large)
   - Expected qty line: "צפוי: {qtyExpected} {unit}" in muted gray. If no expected qty, show "צפוי: —"
   - Large number input (type="number", inputMode="decimal", step="0.01") with unit label to the right
   - Save indicator: gray dot (○) when unsaved, spinning when saving, green checkmark (✓) when saved
   - Last count badge: if lastCountDate is yesterday or earlier, show "נספר לאחרונה: {date}" in xs muted text
   - **Auto-save on blur** (when user leaves the input field): call `saveCountRow`

5. **Notes field** (optional): below each row, a collapsed "הוסף הערה" link. When clicked, expands a small textarea. Auto-saves with the count.

6. **"סיים ספירה" button**: fixed at bottom of screen. Navigates to `/[tenantSlug]/inventory/snapshot?date={date}`. Disabled if 0 items counted.

7. **Empty state**: If no ingredients exist, show "אין מרכיבים — הוסף מרכיבים בדף המלאי".

### Technical notes

- This is a Client Component (`'use client'`) — uses `useState` and `useCallback`
- Load initial data from parent Server Component: `getIngredientsForCount(tenantId)`
- Pass data as prop to `CountForm` client component
- Save state per-ingredient in a `Map<ingredientId, 'idle' | 'saving' | 'saved' | 'error'>`
- On auto-save: set status to 'saving', call `saveCountRow`, set to 'saved' or 'error'
- Show toast on error
- Number input placeholder: "0.0"

---

## Page 2 — `/[tenantSlug]/inventory/snapshot`

### Purpose

Variance report — compare expected vs. counted quantities and flag anomalies.

### Layout

```
┌──────────────────────────────────────────┐
│  ← סקירת מלאי — 03/05/26               │
├──────────────────────────────────────────┤
│  [הכל] [חריגות בלבד]                    │
├──────────────────────────────────────────┤
│  מרכיב    | צפוי  | נספר | פער   | %פער  │
│  ─────────────────────────────────────  │
│  🔴 עגבנייה| 8.5  | 6.0  | -2.5 | -29% │
│  🟡 בצל   | 12.0  | 11.0 | -1.0 | -8%  │
│  🟢 תפוח  | 5.0   | 5.1  | +0.1 | +2%  │
│  ...                                    │
└──────────────────────────────────────────┘
```

### Requirements

1. **Header**: "סקירת מלאי — {date}" with back button.

2. **Filter toggle**: "הכל" / "חריגות בלבד" (variance > 5%).

3. **Table**:
   - Columns (RTL): מרכיב, יחידה, צפוי, נספר, פער, %פער
   - Color coding per row based on |variance%|:
     - 🟢 Green: |variance%| < 5%
     - 🟡 Yellow: 5% ≤ |variance%| < 15%
     - 🔴 Red: |variance%| ≥ 15%
   - Rows with no count (qtyCounted is null): shown in muted gray, no color
   - Sort: uncounted first, then by |variance%| descending

4. **Row action**: "סמן כפסולת" button (small, ghost variant) on rows with negative variance > 15%. Opens a modal/sheet to quickly report waste for that ingredient.

5. **Summary cards** at top:
   - "נספרו X מתוך Y מרכיבים"
   - "X חריגות מעל 15%"

6. **Loading state**: skeleton rows while fetching.

### Technical notes

- Server Component — fetches `getCountForDate(tenantId, date)` at render time
- Filter toggle is a Client Component wrapper
- `?date=` query param (default: today)

---

## Routing

Add these to the sidebar under "מלאי" section:

- `/[tenantSlug]/inventory/count` — "ספירת מלאי"
- `/[tenantSlug]/inventory/snapshot` — "סקירת מלאי"

Sidebar file: `src/components/layout/Sidebar.tsx`

---

## Navigation from existing pages

In `src/app/(app)/[tenantSlug]/page.tsx`, the Chef dashboard has a "Prep List" card.
Add a second card below it:

```
Link to /inventory/count:
  Icon: Package
  Title: "ספירת מלאי"
  Subtitle: "ספור את המלאי הפיזי"
```

---

## File structure to create

```
src/app/(app)/[tenantSlug]/inventory/
  count/
    page.tsx          ← Server Component (loads data, renders CountPage)
    _components/
      CountForm.tsx   ← Client Component (form logic, auto-save)
  snapshot/
    page.tsx          ← Server Component (loads data)
    _components/
      SnapshotTable.tsx ← Client Component (filter toggle)
      WasteModal.tsx    ← Client Component (quick waste report sheet)
```
