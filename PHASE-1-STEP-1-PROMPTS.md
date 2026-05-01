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
