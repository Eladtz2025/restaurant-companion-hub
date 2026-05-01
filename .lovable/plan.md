# Plan: Ingredients UI (Step 1.2)

Task 1 verified merged. All Server Actions, types, and the CSV parser are in place with the contracts the prompt requires. I'll build the UI on top.

## Verified prerequisites (already in repo)
- `getIngredients(tenantId, {search, category})` → `{data}|{error}`
- `createIngredient`, `updateIngredient`, `deleteIngredient` → `{data}|{error}`
- `importIngredientsAction(tenantId, csvText)` → `{imported, skipped, errors}`
- `parseIngredientCSV` (pure, Hebrew + English headers)
- `Ingredient` type with `category` + `pkgQty`

## What I'll build

### 1. Install missing shadcn primitives
- `sheet` (drawer for create/edit form, RTL `side="right"`)
- `alert-dialog` (delete confirmation)
- `sonner` Toaster — wire `<Toaster />` once into `src/app/(app)/[tenantSlug]/layout.tsx`

No other libraries. shadcn only.

### 2. Route page — `src/app/(app)/[tenantSlug]/inventory/ingredients/page.tsx`
Server Component. Reads `tenantId` from context, calls `getIngredients` with `{search, category}` from `searchParams`, renders the client shell with initial data + error state.

### 3. Client shell — `IngredientsPageClient.tsx`
- `PageHeader` with title "מרכיבים" + two actions (left side per RTL): "ייבוא CSV" (secondary), "הוסף מרכיב" (primary)
- Search input (debounced, syncs to URL `?search=`)
- Category `Tabs`: הכל / ירקות / בשר / דגים / חלב / יבש / אלכוהול / אחר (syncs to URL `?category=`)
- Table (rightmost column = שם in RTL): שם · קטגוריה (Badge) · יחידה · מחיר ליחידה (₪, cents→shekels) · כמות באריזה · פעולות (ערוך/מחק)
- Empty state when no results
- Skeleton rows while navigating

### 4. Create/Edit drawer — `IngredientFormSheet.tsx`
- `Sheet side="right"` (RTL start)
- Fields: שם (required), יחידה (Select: kg/g/l/ml/unit/pkg), קטגוריה (Select: 7 options), מחיר ליחידה בשקלים (number, converted to cents on submit), כמות באריזה (optional, only when unit=pkg)
- Zod validation client-side mirroring server schema
- Calls `createIngredient` / `updateIngredient`, toasts success/error, closes on success, `router.refresh()`

### 5. Delete confirmation — `DeleteIngredientDialog.tsx`
- `AlertDialog` "האם אתה בטוח? מחיקת מרכיב תשפיע על מתכונים קיימים."
- Optimistic remove from local list + restore on error
- Calls `deleteIngredient`, toasts result

### 6. CSV import dialog — `ImportCSVDialog.tsx`
- `Dialog` with file input (`.csv`) + textarea fallback
- On submit: read file → call `importIngredientsAction(tenantId, csvText)`
- Shows result summary: ייובאו N · דולגו M · K שגיאות (collapsible error list in Hebrew)
- `router.refresh()` on success

## Technical details

- **No mock data** — every read goes through Server Actions
- **RTL**: rely on existing `<html dir="rtl">` in root layout; use `start-/end-` Tailwind logical properties (already the convention in `dialog.tsx`)
- **Cost display helper**: `formatShekels(cents)` → `₪12.50` (small util in `src/lib/ui-utils.ts` if not already there; I'll check before adding)
- **Tenant ID**: from `TenantContext` on the client, from server context (`getAuthContext`/`tenant.ts`) on the server page
- **URL state for search/category** so back-button works and pages are shareable
- **Toasts**: `sonner` only (modern stack convention from the docs)

## Out of scope (CC's follow-up tasks)
- RLS audit, E2E tests, fine-tuning
- Any Server Action edits (the contracts are correct as-is)
- DB migrations

## Files to create
```
src/app/(app)/[tenantSlug]/inventory/ingredients/page.tsx
src/app/(app)/[tenantSlug]/inventory/ingredients/IngredientsPageClient.tsx
src/app/(app)/[tenantSlug]/inventory/ingredients/IngredientFormSheet.tsx
src/app/(app)/[tenantSlug]/inventory/ingredients/DeleteIngredientDialog.tsx
src/app/(app)/[tenantSlug]/inventory/ingredients/ImportCSVDialog.tsx
src/components/ui/sheet.tsx              (shadcn add)
src/components/ui/alert-dialog.tsx       (shadcn add)
src/components/ui/sonner.tsx             (shadcn add, if missing)
```

## Files to edit
```
src/app/(app)/[tenantSlug]/layout.tsx    (mount <Toaster /> once)
src/app/(app)/[tenantSlug]/inventory/page.tsx  (link to /inventory/ingredients)
```

Approve and I'll implement in one pass.
