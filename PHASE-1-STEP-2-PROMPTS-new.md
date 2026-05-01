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
