## Goal

Build the FC Report + AI Recipe Assistant page at `/[tenantSlug]/menu/cost-analysis` per the prompt: a sortable Food Cost table on the left (70%) and an AI BOM-generation panel on the right (30%), responsive on mobile via a Sheet FAB.

## Repo gaps

The prompt assumes two server actions exist; neither does:

1. `src/lib/actions/fc-report.ts` — missing entirely. Will create with `getFCReport` as a working stub: queries `menu_items` and returns rows with `theoreticalCostCents: 0`, `fcPercent: 0`, no missing costs. The orchestrator phase replaces it with the real BOM-walking + 5-min cache implementation. Also exports the `FCReport` and `MenuItemFCRow` types used by the prompt.
2. `src/lib/actions/ai-recipe.ts` — missing. Will create with `generateRecipeBOM` that throws `"generateRecipeBOM not yet implemented"` and exports the `GeneratedBOM`, `MatchResult`, `GenerateRecipeBOMResult` types. The UI handles this throw via the existing error state. Orchestrator phase wires the actual AI Gateway call + ingredient matching.

`createRecipe` and `addComponent` already exist in `src/lib/actions/recipes.ts` with matching signatures.

## Files to create

- `src/lib/actions/fc-report.ts` — stub action + types.
- `src/lib/actions/ai-recipe.ts` — stub action + types.
- `src/app/(app)/[tenantSlug]/menu/cost-analysis/page.tsx` — Server Component: tenant + role + initial report; renders `<FCReportClient>`.
- `src/app/(app)/[tenantSlug]/menu/cost-analysis/_components/FCReportClient.tsx` — two-pane layout (`md:grid-cols-10` → 7/3 split); mobile shows FAB that opens the AI panel in a bottom Sheet.
- `src/app/(app)/[tenantSlug]/menu/cost-analysis/_components/FCReportTable.tsx` — summary row (avg FC%, missing counts, רענן, הורד PDF), sortable table, color-coded FC% badge, missing-costs Tooltip, loading skeleton, empty state, error state with retry.
- `src/app/(app)/[tenantSlug]/menu/cost-analysis/_components/AIAssistantPanel.tsx` — textarea + generate button, loading card, BOM result preview (recipe name, yield, confidence badge, components table with match status icons, warnings, instructions), `הוסף למתכונים` (role-gated to `owner`/`manager`/`chef`), recipe link after success, error card with retry.

## Behavior notes

- Sorting default: `fcPercent` desc; clicking header toggles asc/desc; numeric vs string compare picked by value type.
- FC% badge: `<30` green, `30–35` yellow, `>35` red, `theoreticalCostCents===0` → gray "אין נתונים".
- "הורד PDF" → toast `"ייצוא PDF יהיה זמין בגרסה הבאה"`.
- "רענן" → calls `getFCReport(tenantId)` from the client and updates state.
- AI panel uses `useTransition` for generation and a manual `setAdding` flag for the create-recipe loop.
- Add flow: `createRecipe` → for each component with `matchedIngredientId !== null` call `addComponent`. Skip `confidence: 'none'`. Show progress text `"יוצר מתכון..."` then `"מוסיף N מרכיבים..."`. Final toast + recipe link to `/${tenantSlug}/recipes/${recipe.id}`.
- Mobile (<768px): right pane hidden; FAB at bottom-left (RTL-friendly) opens AI panel inside a bottom Sheet.
- Toasts: `sonner` (project standard, equivalent to "shadcn useToast" in this codebase).

## Risks

- `getFCReport` stub returns zeroed cost data, so the avg FC% / coloring will all show "אין נתונים" until the real implementation lands. Layout and sort still work.
- `generateRecipeBOM` throws by default; the AI panel will display the prompt's error card on every attempt until the orchestrator wires the real action.

Ready to implement on approval.
