# Phase 1 · Step 1.1 — Schema + APIs: Menu, Ingredients, Recipes, Food Cost

> **Goal:** The core data model is in place. Server Actions for CRUD on all entities. Recipe cost calculator tested. Audit triggers on financial data. This is the foundation everything else is built on — get it right.

---

## Pre-flight check

Before starting, run:

```
git log --oneline -5
pnpm db:test
ls -la src/app/\(app\)/
cat src/lib/permissions.ts | head -10
```

Expected state:

- Phase 0 complete: auth works, app shell renders, RLS passing
- `pnpm db:test` all green
- `src/lib/permissions.ts` has 4 roles defined

If anything is missing, stop and report.

---

## Task 1 — Core Schema Migration

### Context to load

- `ARCHITECTURE.md` §5 (Data Model) — read the full section carefully
- `docs/adr/0001-postgres-rls-multi-tenant.md`

### Prompt for Claude Code

Create the migration for the core data model: menu items, ingredients, recipes, and the Bill of Materials (BOM).

Requirements:

1. Create `supabase/migrations/{timestamp}_core_schema.sql`. Include in this exact order:

   a. `menu_items` table:

   ```sql
   CREATE TABLE menu_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     pos_external_id TEXT,
     name_he TEXT NOT NULL,
     name_en TEXT,
     category TEXT NOT NULL,
     price_cents INT NOT NULL CHECK (price_cents >= 0),
     active BOOLEAN NOT NULL DEFAULT true,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id);
   CREATE INDEX idx_menu_items_pos_id ON menu_items(tenant_id, pos_external_id) WHERE pos_external_id IS NOT NULL;
   ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
   -- Apply standard RLS policies (SELECT/INSERT/UPDATE for members, DELETE for owner/manager only)
   ```

   b. `ingredients` table with full RLS.

   c. `recipes` table (supports both menu recipes and prep sub-recipes):

   ```sql
   type TEXT NOT NULL CHECK (type IN ('menu', 'prep'))
   ```

   Full RLS.

   d. `recipe_components` table (the BOM):
   - Must have CHECK: exactly one of `ingredient_id` OR `sub_recipe_id` is non-null
   - Full RLS
   - CASCADE delete when recipe deleted

   e. `set_updated_at()` trigger on `menu_items`, `ingredients`, `recipes`.

   f. Audit triggers on `menu_items.price_cents` and `recipe_components` (any change → `_audit_log` entry).

2. Create pgTAP tests `supabase/tests/core_schema_rls.sql`:
   - Chef from tenant A cannot read menu_items of tenant B
   - Staff cannot DELETE menu_items
   - Manager CAN DELETE menu_items
   - recipe_components CHECK constraint rejects row with both ingredient_id and sub_recipe_id set
   - recipe_components CHECK constraint rejects row with neither set
   - At least 8 test cases total

Do NOT:

- Use SERIAL or BIGSERIAL. UUIDs only.
- Use FLOAT for price_cents. INT only.
- Use TIMESTAMP without timezone. TIMESTAMPTZ only.
- Skip the CHECK constraint on recipe_components — it is critical for data integrity.

### Validation

- [ ] `pnpm db:reset` applies migration with no errors
- [ ] `pnpm db:test` all tests pass including new ones
- [ ] All 4 tables visible in Supabase Studio
- [ ] Audit trigger fires: change a price → check `_audit_log` has the entry
- [ ] CHECK constraint works: try inserting a recipe_component with both foreign keys set → error

### Commit

`feat(db): core schema — menu_items, ingredients, recipes, recipe_components with RLS`

### Branch

`feat/phase-1-step-1-task-1`

---

## Task 2 — TypeScript Types + Server Actions

### Context to load

- `ARCHITECTURE.md` §17.3 (Server Components vs Client)
- Existing `src/lib/permissions.ts`
- Existing `src/lib/tenant.ts`

### Prompt for Claude Code

Generate TypeScript types from the schema and create Server Actions for all CRUD operations.

Requirements:

1. Run `pnpm db:types` to regenerate `src/lib/supabase/database.types.ts`.

2. Create `src/lib/types/index.ts` — domain types (cleaner than raw DB types):

   ```typescript
   export type MenuCategory = 'appetizer' | 'main' | 'dessert' | 'drink' | 'side' | 'special';
   export type RecipeType = 'menu' | 'prep';
   export type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';

   export interface MenuItem { ... }      // from DB type, clean
   export interface Ingredient { ... }
   export interface Recipe { ... }
   export interface RecipeComponent { ... }
   export interface RecipeWithComponents extends Recipe { components: RecipeComponent[] }
   ```

3. Create `src/lib/actions/menu-items.ts` (Server Actions):
   - `getMenuItems(tenantId)` → `MenuItem[]`
   - `getMenuItem(tenantId, id)` → `MenuItem | null`
   - `createMenuItem(tenantId, data)` → `MenuItem`
   - `updateMenuItem(tenantId, id, data)` → `MenuItem`
   - `toggleMenuItemActive(tenantId, id)` → `MenuItem`
   - `deleteMenuItem(tenantId, id)` → void (owner/manager only — check with `assertRole`)

4. Create `src/lib/actions/ingredients.ts`:
   - Full CRUD: `getIngredients`, `getIngredient`, `createIngredient`, `updateIngredient`, `deleteIngredient`
   - `bulkImportIngredients(tenantId, rows)` — for CSV import in Step 1.2

5. Create `src/lib/actions/recipes.ts`:
   - `getRecipes(tenantId, type?)` — optional filter by type
   - `getRecipeWithComponents(tenantId, id)` → `RecipeWithComponents`
   - `createRecipe(tenantId, data)` → `Recipe`
   - `updateRecipe(tenantId, id, data)` → `Recipe`
   - `addComponent(tenantId, recipeId, component)` → `RecipeComponent`
   - `updateComponent(tenantId, componentId, data)` → `RecipeComponent`
   - `removeComponent(tenantId, componentId)` → void
   - `detectCycle(tenantId, recipeId, subRecipeId)` → boolean — prevent infinite loops

6. Create `src/lib/food-cost/calculator.ts`:

   ```typescript
   // Pure functions, no DB calls — testable
   export function computeComponentCost(
     component: RecipeComponent,
     ingredientCosts: Map<string, number>,
   ): number;
   export function computeRecipeCost(
     recipe: RecipeWithComponents,
     ingredientCosts: Map<string, number>,
     subRecipeCosts: Map<string, number>,
   ): number;
   export function computeMenuItemFC(
     menuItem: MenuItem,
     recipe: RecipeWithComponents,
     ingredientCosts: Map<string, number>,
   ): { costCents: number; fcPercent: number; marginCents: number };
   ```

7. Write unit tests `tests/food-cost/calculator.test.ts`:
   - Test with known values: recipe with 3 ingredients, verify cost
   - Test with sub-recipe: recipe uses another recipe, verify nested cost
   - Test FC %: price 5000 cents, cost 1500 cents → 30%
   - Test edge cases: 0 price (avoid division by zero), missing ingredient cost
   - At least 10 test cases

Do NOT:

- Put business logic inside Server Actions — actions call lib functions.
- Return raw DB types from actions — map to domain types.
- Skip the cycle detection — infinite loops in sub-recipes crash the calculator.

### Validation

- [ ] `pnpm db:types` runs cleanly
- [ ] `pnpm test` (Vitest) — all calculator tests pass
- [ ] `createMenuItem` works end-to-end: creates record, visible in Studio
- [ ] `computeRecipeCost` returns correct value for a manually verified test case
- [ ] Cycle detection returns `true` when recipe A → recipe B → recipe A

### Commit

`feat(core): TypeScript types, Server Actions, food cost calculator with tests`

### Branch

`feat/phase-1-step-1-task-2`

---

## Task 3 — Unit Conversion System

### Context to load

- `src/lib/types/index.ts` (IngredientUnit)
- `src/lib/food-cost/calculator.ts`

### Prompt for Claude Code

Build a unit conversion system that handles the common restaurant measurement mess (kg vs g vs unit vs pkg).

Requirements:

1. Create `src/lib/units/conversions.ts`:

   ```typescript
   // Base units: grams for weight, ml for volume, unit for countable
   const CONVERSION_TABLE = {
     kg: { base: 'g', factor: 1000 },
     g: { base: 'g', factor: 1 },
     l: { base: 'ml', factor: 1000 },
     ml: { base: 'ml', factor: 1 },
     unit: { base: 'unit', factor: 1 },
     pkg: { base: 'unit', factor: 1 }, // pkg = 1 unit unless overridden
   };

   export function canConvert(fromUnit: IngredientUnit, toUnit: IngredientUnit): boolean;
   export function convert(qty: number, fromUnit: IngredientUnit, toUnit: IngredientUnit): number;
   export function normalizeToBase(
     qty: number,
     unit: IngredientUnit,
   ): { qty: number; baseUnit: string };
   ```

2. Update `calculator.ts` to use unit conversion:
   - Recipe component may be in `g`, ingredient cost may be per `kg` → convert before calculating

3. Add `pkg_qty` field to `ingredients` table (how many units per package):
   - New migration: `supabase/migrations/{timestamp}_ingredient_pkg.sql`
   - `pkg_qty NUMERIC` — e.g., eggs: pkg_qty = 12 (12 per package)

4. Write unit tests `tests/units/conversions.test.ts`:
   - 1 kg → 1000 g ✓
   - 500 ml → 0.5 l ✓
   - Cannot convert g to ml → error
   - Recipe uses 200g of ingredient priced per kg → correct cost
   - At least 8 test cases

Do NOT:

- Add exotic units (oz, lb, fl oz) — not relevant for Israeli market.
- Make conversions lossy — use exact arithmetic where possible.

### Validation

- [ ] `pnpm test` — conversion tests all pass
- [ ] Calculator correctly handles kg/g mismatch in a real test case
- [ ] New migration applies cleanly

### Commit

`feat(core): unit conversion system with pkg support`

### Branch

`feat/phase-1-step-1-task-3`

---

## Task 4 — Audit Log Middleware

### Context to load

- `ARCHITECTURE.md` §5.1 (`_audit_log` table)
- `src/lib/actions/` (existing actions)

### Prompt for Claude Code

Create a reusable audit logging middleware that wraps any write operation.

Requirements:

1. Create `src/lib/audit/logger.ts`:

   ```typescript
   export interface AuditEvent {
     tenantId: string;
     userId: string;
     action: string; // 'menu_item.price_changed' | 'recipe.updated' | ...
     entityType: string;
     entityId: string;
     beforeData?: Record<string, unknown>;
     afterData?: Record<string, unknown>;
   }

   export async function logAuditEvent(event: AuditEvent): Promise<void>;

   // Higher-order function to wrap any action with audit logging
   export function withAudit<T>(
     action: string,
     entityType: string,
     fn: () => Promise<{ id: string; before?: unknown; after?: unknown }>,
   ): Promise<T>;
   ```

2. Apply `withAudit` to sensitive operations:
   - `updateMenuItem` when price changes
   - `deleteMenuItem`
   - `deleteIngredient`
   - `deleteRecipe`
   - All membership changes

3. Create `src/lib/audit/queries.ts`:
   - `getAuditLog(tenantId, filters?)` — query audit log with filters
   - `getEntityHistory(tenantId, entityType, entityId)` — history for one record

4. Write tests `tests/audit/logger.test.ts`:
   - Updating price creates audit entry with before/after
   - Delete creates audit entry
   - At least 5 test cases

Do NOT:

- Log read operations — only writes.
- Include PII in audit log beyond user_id.
- Make audit logging async in a way that could be missed (must be synchronous with the write).

### Validation

- [ ] `pnpm test` — audit tests pass
- [ ] Change a menu item price → `_audit_log` has entry with before/after values
- [ ] `getEntityHistory` returns correct history for the changed item

### Commit

`feat(core): audit log middleware for sensitive write operations`

### Branch

`feat/phase-1-step-1-task-4`

---

## End of Step 1.1

When Task 4 is committed, Step 1.1 is complete.

Run validation:

- [ ] `pnpm db:test` all green
- [ ] `pnpm test` all green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean

Read `TIMELINE.md`. Next step is 1.2. Check if `PHASE-1-STEP-2-PROMPTS.md` exists. If yes, load and begin. If no, stop and wait for Elad.

---

# Phase 1 · Step 1.2 — Ingredients UI

> **Goal:** A fully working Ingredients management screen. Chef and manager can view, search, filter, create, edit, and import ingredients via CSV. This is the first screen built with Lovable + Claude Code together.

---

## Pre-flight check

Before starting, run:

```
git log --oneline -5
pnpm db:test
pnpm typecheck
ls -la src/lib/actions/ingredients.ts
```

Expected state:

- Step 1.1 complete: schema, Server Actions, calculator, unit conversions, audit log all done
- `src/lib/actions/ingredients.ts` exists with full CRUD
- `pnpm db:test` all green
- `pnpm typecheck` clean

If anything is missing, stop and report.

---

## Division of labor — READ FIRST

This step uses both Claude Code (CC) and Lovable (LV).

**Claude Code handles:**

- CSV parser and bulk import logic
- Server-side validation
- Any bug fixes in existing Server Actions
- Tests

**Lovable handles:**

- All UI components: table, search, filter, forms, modals
- RTL Hebrew styling
- Mobile responsiveness

**Workflow:**

1. CC does Task 1 (CSV parser + validation hardening)
2. CC writes a detailed Lovable prompt (Task 2) and saves it to `prompts/lovable/step-1-2-ingredients.md`
3. Elad pastes that prompt into Lovable
4. Lovable builds the UI
5. CC does Task 3 (wiring Lovable output to real Server Actions + fixing RTL issues)

---

## Task 1 — CSV Parser + Validation Hardening (Claude Code)

### Context to load

- `src/lib/actions/ingredients.ts`
- `src/lib/types/index.ts`
- `src/lib/units/conversions.ts`
- `ARCHITECTURE.md` §5.2 (Schema rules)

### Prompt for Claude Code

Harden the ingredients Server Actions and build the CSV bulk import pipeline.

Requirements:

1. Update `src/lib/actions/ingredients.ts`:
   - Add Zod schema for ingredient validation:
     ```typescript
     const IngredientSchema = z.object({
       name_he: z.string().min(1).max(100),
       unit: z.enum(['kg', 'g', 'l', 'ml', 'unit', 'pkg']),
       category: z.enum(['produce', 'meat', 'fish', 'dairy', 'dry', 'alcohol', 'other']),
       current_cost_per_unit_cents: z.number().int().min(0).optional(),
       pkg_qty: z.number().positive().optional(),
     });
     ```
   - All Server Actions validate input through Zod before DB write
   - Return typed results: `{ data: T } | { error: string }`

2. Create `src/lib/ingredients/csv-importer.ts`:
   - `parseIngredientCSV(csvText: string)` → `{ valid: IngredientRow[]; invalid: { row: number; reason: string }[] }`
   - Expected CSV columns (Hebrew headers supported): `שם,יחידה,קטגוריה,מחיר ליחידה,כמות לאריזה`
   - Also support English headers: `name,unit,category,cost,pkg_qty`
   - Fuzzy match unit strings: "ק"ג" → "kg", "גרם" → "g", "ליטר" → "l", "יח" → "unit"
   - Skip empty rows silently
   - Collect all errors, don't fail on first error

3. Create `src/lib/actions/ingredients-import.ts`:
   - `importIngredientsAction(tenantId, csvText)` Server Action
   - Parse → validate → deduplicate (by name_he, case-insensitive) → bulk upsert
   - Return: `{ imported: number; skipped: number; errors: string[] }`
   - Wrap in a DB transaction — all or nothing per valid batch

4. Write tests `tests/ingredients/csv-importer.test.ts`:
   - Valid CSV with Hebrew headers → correct parse
   - Valid CSV with English headers → correct parse
   - Row with invalid unit → collected in errors, others proceed
   - Duplicate names → deduplicated
   - Empty rows → skipped
   - At least 8 test cases

5. Add fuzzy ingredient name search to `getIngredients`:
   - Accept optional `search` param
   - Use Postgres `ILIKE '%term%'` (simple, fast enough for < 500 ingredients)

Do NOT:

- Use any CSV parsing library. Pure string parsing only.
- Fail the entire import on one bad row.
- Allow SQL injection through CSV content (Supabase parameterized queries handle this — just verify).

### Validation

- [ ] `pnpm test` — all CSV importer tests pass
- [ ] Import a CSV with 10 ingredients → all appear in DB
- [ ] Import a CSV with 2 bad rows + 8 good rows → 8 imported, 2 errors reported
- [ ] `pnpm typecheck` clean

### Commit

`feat(ingredients): CSV bulk importer with validation and fuzzy search`

### Branch

`feat/phase-1-step-2-task-1`

---

## Task 2 — Write Lovable Prompt (Claude Code)

### Context to load

- `ARCHITECTURE.md` §17 (Frontend)
- `docs/adr/0010-lovable-claude-code-workflow.md`
- `src/lib/actions/ingredients.ts`
- `src/lib/types/index.ts`
- `src/components/shared/` (existing shell components)

### Prompt for Claude Code

Write a detailed, paste-ready prompt for Lovable to build the Ingredients UI. Save it to `prompts/lovable/step-1-2-ingredients.md`.

The Lovable prompt must instruct Lovable to build:

1. **`/[tenantSlug]/ingredients` page** — main list view:
   - PageHeader with title "מרכיבים" and "הוסף מרכיב" + "יבוא CSV" buttons (owner/manager only)
   - Search input (Hebrew placeholder: "חיפוש מרכיב...")
   - Filter tabs: "הכל" | "ירקות ופירות" | "בשר ודגים" | "חלבי" | "יבש" | "אלכוהול" | "אחר"
   - Data table with columns: שם, יחידה, קטגוריה, מחיר ליחידה, עריכה
   - Empty state: "לא נמצאו מרכיבים" with "הוסף מרכיב ראשון" button
   - Loading skeleton: 8 rows

2. **Create/Edit ingredient drawer** (Sheet component, opens from right in RTL):
   - Fields: שם (required), יחידה (Select), קטגוריה (Select), מחיר ליחידה (number, ₪), כמות לאריזה (number, optional)
   - "שמור" and "ביטול" buttons
   - Validation errors in Hebrew inline
   - Loading state on submit

3. **CSV import modal** (Dialog):
   - Drag-and-drop zone OR file picker
   - Preview table of parsed rows before import
   - Error rows highlighted in red with reason
   - "יבוא X מרכיבים" confirm button
   - Import results: "יובאו X מרכיבים, X שגיאות"

4. **Delete confirmation** (AlertDialog):
   - "האם אתה בטוח? מחיקת מרכיב תשפיע על מתכונים קיימים."
   - "מחק" (destructive) and "ביטול" buttons

The Lovable prompt must also include:

- All text in Hebrew
- RTL layout (Sheet opens from right, table text right-aligned)
- Use `useTenant()` hook for tenantId
- Call Server Actions directly (not fetch/axios)
- Use shadcn/ui components only
- Mobile responsive (table becomes card list on mobile)
- Role guard: hide add/edit/delete from `chef` and `staff`

Do NOT instruct Lovable to:

- Write Server Actions (CC owns those)
- Write DB migrations
- Use any state management library
- Create new shadcn components not already installed

### Validation

- [ ] File `prompts/lovable/step-1-2-ingredients.md` exists
- [ ] Prompt is complete, paste-ready, and covers all 4 UI sections
- [ ] Prompt references correct Server Action names from `src/lib/actions/ingredients.ts`

### Commit

`docs(prompts): Lovable prompt for ingredients UI`

### Branch

`feat/phase-1-step-2-task-2`

---

## ⏸ PAUSE HERE — Elad pastes Task 2 output into Lovable

After Task 2 is committed:

1. Open `prompts/lovable/step-1-2-ingredients.md` from the repo
2. Copy the contents
3. Paste into Lovable
4. Let Lovable build the UI
5. Lovable will push to a branch (e.g. `lovable/ingredients-ui`)
6. Tell Claude Code: "Lovable is done. Branch is `lovable/ingredients-ui`. Proceed to Task 3."

Claude Code waits. Do not proceed to Task 3 until Elad confirms Lovable is done.

---

## Task 3 — Wire + Fix (Claude Code)

### Context to load

- The Lovable branch output (read all new files)
- `src/lib/actions/ingredients.ts`
- `src/lib/ingredients/csv-importer.ts`

### Prompt for Claude Code

Review Lovable's output, wire it to real Server Actions, fix RTL issues, and harden the component.

Requirements:

1. **Audit Lovable's output:**
   - Check every Server Action call — are they using the correct function names and signatures?
   - Check every import path — are they correct?
   - Check for any hardcoded data or mock responses — replace with real calls
   - Check TypeScript errors — fix all

2. **Wire CSV import:**
   - Lovable likely created a file upload handler
   - Connect it to `importIngredientsAction` from `src/lib/actions/ingredients-import.ts`
   - Show real import results (imported count, errors)

3. **Fix common Lovable RTL issues:**
   - Table column order (should read right-to-left)
   - Sheet/Drawer opening direction (should open from right)
   - Form field labels alignment
   - Button group order in mobile

4. **Add loading + error states that Lovable may have missed:**
   - Network error: "שגיאה בטעינת המרכיבים. נסה שוב."
   - Empty search results vs empty list (different states)
   - Optimistic updates on delete (remove from list immediately, restore on error)

5. **Add one E2E test** `tests/e2e/ingredients.spec.ts`:
   - Navigate to ingredients page
   - Create a new ingredient
   - Verify it appears in the list
   - Delete it
   - Verify it's gone

Do NOT:

- Rewrite Lovable's UI components. Fix only what's broken.
- Change the visual design Lovable produced.
- Add features not in the original requirements.

### Validation

- [ ] `/ingredients` page loads with real data from DB
- [ ] Create ingredient → appears in list
- [ ] Edit ingredient → changes reflected
- [ ] Delete ingredient → removed from list
- [ ] CSV import with test file → correct results shown
- [ ] Search for ingredient by Hebrew name → works
- [ ] Filter by category → works
- [ ] Chef cannot see add/edit/delete buttons
- [ ] Mobile view (375px) → cards, not table
- [ ] E2E test passes

### Commit

`feat(ingredients): wire Lovable UI to Server Actions, fix RTL, add E2E test`

### Branch

`feat/phase-1-step-2-task-3`

---

## End of Step 1.2

When Task 3 is committed and validated, Step 1.2 is complete.

Run:

- [ ] `pnpm db:test` green
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean

Read `TIMELINE.md`. Next step is 1.3 (Recipes UI part 1). Check if `PHASE-1-STEP-3-PROMPTS.md` exists. If yes, load and begin Task 1 only (CC parts). If no, stop and wait for Elad.

---

# Phase 1 · Step 1.3 — Recipes UI Part 1: List + BOM Editor

> **Goal:** Chef and manager can browse recipes, open a recipe, and edit its Bill of Materials (ingredients + sub-recipes) with live cost calculation.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
ls -la src/lib/actions/recipes.ts
```

Expected: Step 1.2 complete, ingredients page working, all tests green.

---

## Division of labor

**Claude Code:** cycle detection, sub-recipe cost recursion, Server Action hardening, tests, Lovable prompt.
**Lovable:** recipes list page, BOM editor UI, live cost display.

---

## Task 1 — Harden Recipe Server Actions (Claude Code)

### Context to load

- `src/lib/actions/recipes.ts`
- `src/lib/food-cost/calculator.ts`
- `src/lib/units/conversions.ts`
- `ARCHITECTURE.md` §12 (Food Cost Engine)

### Prompt for Claude Code

Harden recipe Server Actions and ensure the cost calculator handles all edge cases.

Requirements:

1. Add Zod validation to all recipe Server Actions:

   ```typescript
   const RecipeSchema = z.object({
     name_he: z.string().min(1).max(100),
     type: z.enum(['menu', 'prep']),
     yield_qty: z.number().positive(),
     yield_unit: z.enum(['kg', 'g', 'l', 'ml', 'unit', 'pkg']),
     instructions_md: z.string().optional(),
     video_url: z.string().url().optional().or(z.literal('')),
   });

   const RecipeComponentSchema = z
     .object({
       ingredient_id: z.string().uuid().optional(),
       sub_recipe_id: z.string().uuid().optional(),
       qty: z.number().positive(),
       unit: z.enum(['kg', 'g', 'l', 'ml', 'unit', 'pkg']),
       notes: z.string().optional(),
     })
     .refine((d) => !!(d.ingredient_id ?? d.sub_recipe_id), {
       message: 'Must have either ingredient_id or sub_recipe_id',
     });
   ```

2. Implement `detectCycle` properly:

   ```typescript
   export async function detectCycle(
     tenantId: string,
     recipeId: string,
     candidateSubRecipeId: string,
   ): Promise<boolean> {
     // BFS: start from candidateSubRecipeId, walk its components
     // If we ever encounter recipeId → cycle detected
   }
   ```

3. Update `addComponent` to call `detectCycle` before inserting. Throw if cycle detected.

4. Update `computeRecipeCost` in calculator to handle:
   - Missing ingredient cost → treat as 0, add warning to result
   - Sub-recipe with 0 yield → skip, add warning
   - Max depth 5 (sub-recipe inside sub-recipe inside...) → throw after 5 levels

5. Add `getRecipesWithCosts(tenantId)` — returns all recipes with their current theoretical cost pre-computed. Used for the recipes list page to show cost column without N+1 queries.

6. Write tests `tests/recipes/`:
   - `cycle-detection.test.ts` — at least 5 cases
   - `calculator-edge-cases.test.ts` — missing costs, zero yield, max depth
   - At least 10 tests total

Do NOT skip cycle detection. A recipe that references itself will crash the calculator.

### Validation

- [ ] `pnpm test` all green including new recipe tests
- [ ] `addComponent` with a circular reference throws with clear error message
- [ ] `computeRecipeCost` returns warnings array when ingredient cost is missing
- [ ] `pnpm typecheck` clean

### Commit

`feat(recipes): harden Server Actions, cycle detection, calculator edge cases`

### Branch

`feat/phase-1-step-3-task-1`

---

## Task 2 — Write Lovable Prompt (Claude Code)

### Context to load

- `src/lib/actions/recipes.ts`
- `src/lib/types/index.ts`
- `src/components/shared/`
- `prompts/lovable/step-1-2-ingredients.md` (reference for style consistency)

### Prompt for Claude Code

Write a Lovable prompt and save to `prompts/lovable/step-1-3-recipes.md`.

The prompt must instruct Lovable to build:

1. **`/[tenantSlug]/recipes` page** — list view:
   - PageHeader: "מתכונים" with "מתכון חדש" button (manager/owner only)
   - Filter tabs: "הכל" | "מנות תפריט" | "הכנות"
   - Cards grid (not table — recipes are visual):
     - Recipe name (Hebrew)
     - Type badge: "מנה" or "הכנה"
     - Theoretical cost: "₪12.50"
     - Number of components: "5 מרכיבים"
     - Edit button
   - Empty state: "אין מתכונים עדיין"
   - Search by recipe name

2. **`/[tenantSlug]/recipes/[id]` page** — BOM editor:
   - Recipe name (editable inline)
   - Type, yield qty, yield unit fields
   - "רכיבי המתכון" section:
     - Table: מרכיב/תת-מתכון | כמות | יחידה | עלות | הסר
     - "הוסף מרכיב" button → opens combobox to search ingredients
     - "הוסף תת-מתכון" button → opens combobox to search prep recipes
     - Quantities editable inline
   - Live cost panel (sticky at bottom on mobile):
     - "עלות תיאורטית: ₪XX.XX"
     - "מחיר מכירה: ₪XX.XX" (if linked to menu item)
     - "Food Cost: XX.X%"
     - Warning badges if missing ingredient costs
   - "הוראות הכנה" section: markdown textarea
   - "סרטון הדרכה" field: URL input with YouTube embed preview
   - Save button (sticky)

3. **New recipe modal** (Dialog):
   - Name, type (menu/prep), yield qty + unit
   - On create → redirect to recipe detail page

### Validation

- [ ] `prompts/lovable/step-1-3-recipes.md` exists and is complete

### Commit

`docs(prompts): Lovable prompt for recipes UI`

### Branch

`feat/phase-1-step-3-task-2`

---

## ⏸ PAUSE — Elad pastes prompt into Lovable, then signals CC to continue with Task 3.

---

## Task 3 — Wire + Fix (Claude Code)

### Prompt for Claude Code

Review Lovable's recipe UI output, wire to Server Actions, fix issues.

Requirements:

1. Wire recipes list to `getRecipesWithCosts(tenantId)` — real data, no mocks.
2. Wire BOM editor:
   - Load recipe via `getRecipeWithComponents`
   - Add component → `addComponent` (with cycle detection error handling)
   - Remove component → `removeComponent`
   - Update qty → `updateComponent`
   - Live cost recalculates client-side on every change (using calculator logic ported to client)
3. Wire new recipe modal to `createRecipe`.
4. Handle cycle detection error gracefully: show Hebrew toast "לא ניתן להוסיף — יוצר לולאה במתכון".
5. Fix RTL issues in BOM table.
6. Add E2E test `tests/e2e/recipes.spec.ts`:
   - Create recipe
   - Add 2 ingredients
   - Verify cost updates
   - Remove one ingredient
   - Verify cost updates again

### Validation

- [ ] Recipes list shows real data with correct costs
- [ ] Adding an ingredient updates cost live
- [ ] Cycle detection error shown in Hebrew
- [ ] E2E test passes
- [ ] Mobile layout correct

### Commit

`feat(recipes): wire Lovable UI to Server Actions, live cost, E2E test`

### Branch

`feat/phase-1-step-3-task-3`

---

## End of Step 1.3

- [ ] `pnpm db:test` green
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean

Check if `PHASE-1-STEP-4-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

# Phase 1 · Step 1.4 — Recipes UI Part 2: Versions, Media, Image Upload

> **Goal:** Recipes have version history, markdown instructions, video embed, and image upload to Supabase Storage.

---

## Pre-flight check

```
git log --oneline -5
pnpm test
pnpm typecheck
```

Expected: Step 1.3 complete, BOM editor working with live cost.

---

## Division of labor

**Claude Code:** versioning logic, Storage upload, migration, tests, Lovable prompt.
**Lovable:** version history UI, markdown editor, video embed, image upload dropzone.

---

## Task 1 — Recipe Versioning + Storage (Claude Code)

### Context to load

- `ARCHITECTURE.md` §5 (Data Model), §13 (Storage)
- `src/lib/actions/recipes.ts`

### Prompt for Claude Code

Add recipe versioning and media support.

Requirements:

1. Create migration `{timestamp}_recipe_versions.sql`:

   ```sql
   CREATE TABLE recipe_versions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
     version INT NOT NULL,
     snapshot_data JSONB NOT NULL, -- full recipe + components at time of save
     changed_by UUID REFERENCES auth.users(id),
     change_note TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (recipe_id, version)
   );
   ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;
   -- Standard tenant RLS policies

   -- Add image_url to recipes
   ALTER TABLE recipes ADD COLUMN image_url TEXT;
   ALTER TABLE recipes ADD COLUMN current_version INT NOT NULL DEFAULT 1;
   ```

2. Update `saveRecipe` Server Action to create a version snapshot:
   - On every meaningful save (component change, name change, instructions change)
   - Bump `current_version`
   - Store full snapshot in `recipe_versions`

3. Add `getRecipeVersions(tenantId, recipeId)` → version list with timestamp and changed_by.

4. Add `restoreRecipeVersion(tenantId, recipeId, version)` → restore components from snapshot.

5. Create `src/lib/storage/recipe-images.ts`:

   ```typescript
   export async function uploadRecipeImage(
     tenantId: string,
     recipeId: string,
     file: File,
   ): Promise<string>; // returns public URL

   export async function deleteRecipeImage(tenantId: string, recipeId: string): Promise<void>;
   ```

   - Storage bucket: `recipe-images` (create in migration or Supabase dashboard)
   - Path: `{tenantId}/{recipeId}/{timestamp}.{ext}`
   - Max size: 5MB
   - Allowed types: image/jpeg, image/png, image/webp
   - Returns signed URL (not public bucket)

6. Write tests:
   - `tests/recipes/versioning.test.ts` — save creates version, restore works
   - At least 5 tests

### Validation

- [ ] Migration applies cleanly
- [ ] Saving recipe creates version entry in DB
- [ ] `getRecipeVersions` returns correct history
- [ ] `uploadRecipeImage` uploads to Storage, returns URL
- [ ] `pnpm test` green

### Commit

`feat(recipes): versioning and image upload to Storage`

### Branch

`feat/phase-1-step-4-task-1`

---

## Task 2 — Write Lovable Prompt (Claude Code)

Save to `prompts/lovable/step-1-4-recipes-media.md`.

Instruct Lovable to add to the existing recipe detail page:

1. **Image upload section** (top of page):
   - Current image (or placeholder with camera icon)
   - Click to upload → file picker (or drag-drop)
   - Shows upload progress
   - Shows current image after upload
   - "הסר תמונה" button

2. **Markdown instructions editor**:
   - Simple textarea with markdown support (bold, lists, headers)
   - Live preview toggle: "עריכה" / "תצוגה מקדימה"
   - Hebrew placeholder: "כתוב את הוראות ההכנה..."

3. **Video tutorial field**:
   - URL input: "קישור לסרטון הדרכה (YouTube / Vimeo)"
   - If valid YouTube/Vimeo URL → show embed preview below
   - If invalid URL → red border with "קישור לא תקין"

4. **Version history panel** (collapsible section at bottom):
   - List of versions: "גרסה 3 — 30 באפריל 2026 — אלעד"
   - "שחזר" button per version (owner/manager only)
   - Confirmation dialog before restore: "שחזור יחליף את המתכון הנוכחי. להמשיך?"

### Validation

- [ ] `prompts/lovable/step-1-4-recipes-media.md` exists

### Commit

`docs(prompts): Lovable prompt for recipe media and versions`

### Branch

`feat/phase-1-step-4-task-2`

---

## ⏸ PAUSE — Elad pastes prompt into Lovable.

---

## Task 3 — Wire + Fix (Claude Code)

Requirements:

1. Wire image upload to `uploadRecipeImage` Storage action.
2. Wire version history list to `getRecipeVersions`.
3. Wire restore to `restoreRecipeVersion` with Hebrew confirmation.
4. Fix any RTL issues in the markdown editor.
5. Ensure image URL is saved to `recipes.image_url` after upload.

### Validation

- [ ] Upload image → appears on recipe page
- [ ] Save recipe → version created
- [ ] Restore version → components revert to that snapshot
- [ ] Video URL shows embed preview
- [ ] `pnpm typecheck` clean

### Commit

`feat(recipes): wire media upload and version history UI`

### Branch

`feat/phase-1-step-4-task-3`

---

## End of Step 1.4

Check if `PHASE-1-STEP-5-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

# Phase 1 · Step 1.5 — Menu Management, FC Report, AI Recipe Assistant

> **Goal:** Complete Phase 1. Menu items managed, Food Cost report per menu item, AI assistant helps build recipe BOMs from free Hebrew text.

---

## Pre-flight check

```
git log --oneline -5
pnpm test
pnpm typecheck
```

Expected: Steps 1.3 and 1.4 complete. Recipe versioning and media working.

---

## Division of labor

**Claude Code:** FC report engine, AI Gateway integration, menu↔recipe linking, tests, Lovable prompts.
**Lovable:** menu management page, FC report page, AI assistant chat panel.

---

## Task 1 — Menu↔Recipe Linking + FC Engine (Claude Code)

### Context to load

- `ARCHITECTURE.md` §12 (Food Cost Engine Stage A)
- `src/lib/food-cost/calculator.ts`
- `src/lib/actions/menu-items.ts`
- `src/lib/actions/recipes.ts`

### Prompt for Claude Code

Link menu items to recipes and build the theoretical Food Cost report.

Requirements:

1. Add `recipe_id` to `menu_items`:

   ```sql
   -- migration: {timestamp}_menu_recipe_link.sql
   ALTER TABLE menu_items ADD COLUMN recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
   CREATE INDEX idx_menu_items_recipe ON menu_items(recipe_id) WHERE recipe_id IS NOT NULL;
   ```

2. Update `getMenuItems` to join recipe and include `theoretical_cost_cents`.

3. Create `src/lib/food-cost/report.ts`:

   ```typescript
   export interface MenuItemFCRow {
     menuItemId: string;
     nameHe: string;
     category: string;
     priceCents: number;
     theoreticalCostCents: number;
     fcPercent: number;
     marginCents: number;
     missingCosts: string[]; // ingredient names with no cost set
   }

   export async function buildFCReport(tenantId: string): Promise<{
     rows: MenuItemFCRow[];
     averageFcPercent: number;
     itemsWithMissingCosts: number;
     generatedAt: Date;
   }>;
   ```

4. Create `src/lib/actions/fc-report.ts`:
   - `getFCReport(tenantId)` Server Action → calls `buildFCReport`
   - Cache result for 5 minutes (use `unstable_cache` from Next.js)
   - Invalidate cache on any menu item price change or ingredient cost change

5. Write tests `tests/food-cost/report.test.ts`:
   - Report with 3 menu items, known costs → correct FC%
   - Report with missing ingredient cost → item appears in `itemsWithMissingCosts`
   - Average FC calculated correctly
   - At least 6 tests

### Validation

- [ ] Migration applies cleanly
- [ ] `buildFCReport` returns correct values for seeded test data
- [ ] Cache invalidates when price changes
- [ ] `pnpm test` green

### Commit

`feat(menu): menu-recipe link and theoretical FC report engine`

### Branch

`feat/phase-1-step-5-task-1`

---

## Task 2 — AI Recipe Assistant (Claude Code)

### Context to load

- `ARCHITECTURE.md` §7 (AI Gateway)
- `prompts/` directory structure
- `src/lib/ai/` existing gateway

### Prompt for Claude Code

Build the AI assistant that helps create recipe BOMs from free Hebrew text input.

Requirements:

1. Create prompt file `prompts/recipe-bom-assistant/v1.md`:

   ```
   אתה עוזר שף ישראלי מנוסה. המשתמש יתאר מנה בעברית חופשית.
   החזר JSON בלבד — ללא מלל נוסף — בסכמה הבאה:
   {
     "recipe_name_he": string,
     "yield_qty": number,
     "yield_unit": "kg"|"g"|"l"|"ml"|"unit",
     "components": [
       {
         "ingredient_name_he": string,
         "qty": number,
         "unit": "kg"|"g"|"l"|"ml"|"unit"|"pkg",
         "notes": string | null
       }
     ],
     "instructions_summary": string,
     "confidence": "high"|"medium"|"low",
     "warnings": string[]
   }

   כללים:
   - השתמש בכמויות סבירות למסעדה (לא לבית).
   - אם לא בטוח בכמות — סמן confidence: "low" והוסף אזהרה.
   - אל תמציא מרכיבים שלא הוזכרו — רק מרכיבים הגיוניים מהתיאור.
   - כל הפלט חייב להיות בעברית חוץ מ-unit values.
   ```

2. Add task type to AI Gateway routing:

   ```typescript
   'recipe.bom_from_description': {
     model: 'claude-sonnet-4-6',
     maxTokens: 1500,
     temp: 0.2
   }
   ```

3. Create `src/lib/actions/ai-recipe.ts`:
   - `generateRecipeBOM(tenantId, userId, description: string)` Server Action
   - Calls AI Gateway with `recipe.bom_from_description` task
   - Parses JSON response
   - Fuzzy-matches returned ingredient names to existing ingredients in tenant DB
   - Returns: `{ bom: GeneratedBOM; matchedIngredients: MatchResult[] }`

4. Write tests `tests/ai/recipe-bom.test.ts`:
   - Mock AI Gateway response
   - Test fuzzy ingredient matching
   - Test JSON parse error handling
   - At least 4 tests

### Validation

- [ ] `generateRecipeBOM` returns valid BOM for a test description
- [ ] Fuzzy matching finds "עגבניה" when DB has "עגבניות"
- [ ] AI Gateway logs the call to `ai_calls` table
- [ ] Cost ceiling check fires if tenant over budget
- [ ] `pnpm test` green

### Commit

`feat(ai): recipe BOM assistant with fuzzy ingredient matching`

### Branch

`feat/phase-1-step-5-task-2`

---

## Task 3 — Write Lovable Prompts (Claude Code)

Save two prompts:

**`prompts/lovable/step-1-5-menu.md`** — Menu management page:

1. `/[tenantSlug]/menu` page:
   - Table: שם מנה, קטגוריה, מחיר, עלות תיאורטית, FC%, מתכון מקושר, פעיל/לא
   - Toggle active/inactive per item
   - "ערוך" opens edit drawer
   - FC% color coded: green < 30%, yellow 30-35%, red > 35%
   - "קשר מתכון" button → combobox to link recipe to menu item
   - Export to CSV button

**`prompts/lovable/step-1-5-fc-report.md`** — FC Report page:

1. `/[tenantSlug]/menu/cost-analysis` page:
   - Summary row: average FC%, items with missing costs
   - Table sorted by FC% descending
   - Each row: מנה, קטגוריה, מחיר, עלות, FC%, מרווח, סטטוס
   - Warning icon on items with missing ingredient costs
   - "הורד PDF" button (placeholder — will implement in Phase 6)
   - AI assistant panel (drawer on mobile, sidebar on desktop):
     - Text area: "תאר מנה חדשה..."
     - "צור BOM" button
     - Shows generated BOM in a preview table
     - "הוסף למתכונים" saves as new recipe draft

### Validation

- [ ] Both prompt files exist and are complete

### Commit

`docs(prompts): Lovable prompts for menu and FC report`

### Branch

`feat/phase-1-step-5-task-3`

---

## ⏸ PAUSE — Elad pastes both prompts into Lovable (two separate sessions or one combined).

---

## Task 4 — Wire + Fix (Claude Code)

Requirements:

1. Wire menu table to real `getMenuItems` with FC data.
2. Wire "link recipe" to `updateMenuItem({ recipeId })`.
3. Wire FC report to `getFCReport`.
4. Wire AI assistant:
   - Text input → `generateRecipeBOM`
   - Show generated BOM table
   - "הוסף למתכונים" → `createRecipe` + `addComponent` for each row
   - Show loading state during AI call (can take 3-8 seconds)
5. Fix RTL on FC% color badges.
6. E2E test `tests/e2e/fc-report.spec.ts`:
   - Link recipe to menu item
   - Navigate to cost analysis
   - Verify FC% shown correctly

### Validation

- [ ] Menu table shows real FC% per item
- [ ] FC report loads and color codes correctly
- [ ] AI assistant generates BOM and allows saving as recipe
- [ ] E2E test passes
- [ ] `pnpm typecheck` clean

### Commit

`feat(menu): wire menu management, FC report, and AI assistant`

### Branch

`feat/phase-1-step-5-task-4`

---

## End of Phase 1

Run Phase 1 Definition of Done:

- [ ] 50 menu items + 200 ingredients enterable in one workday
- [ ] Each menu item shows accurate theoretical FC with drill-down
- [ ] AI suggests BOM ≥ 70% accurate by chef judgment
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean

Read `TIMELINE.md`. Next is Phase 2, Step 2.1. Check if `PHASE-2-STEP-1-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
