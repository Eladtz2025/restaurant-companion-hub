## Goal

Build the Menu Items management screen at `/[tenantSlug]/menu` per the prompt: searchable + category-filterable table with create/edit drawer, recipe-link popover, delete confirm, active toggle, and CSV export. shadcn/ui only, RTL Hebrew.

## Repo gaps to fill

The prompt assumes some pieces exist; they don't:

1. **`linkRecipe` server action** — not in `src/lib/actions/menu-items.ts`. I already appended a stub during exploration that updates `recipe_id` on `menu_items` (cast to `never` since the generated type doesn't list the column yet). Backend phase will add the column, RLS, and proper audit logging.
2. **`MenuItem.recipeId`** — missing from `src/lib/types/index.ts`. Will add as optional `recipeId?: string | null`.
3. **shadcn `Switch`** — missing. `@radix-ui/react-switch` is not installed and we may not install packages. Will implement a small accessible button-based toggle (`role="switch"`, `aria-checked`) — same API surface (`checked` / `onCheckedChange`).
4. **shadcn `Popover`** — missing wrapper, but `@radix-ui/react-popover` IS installed. Will add the standard shadcn `popover.tsx` wrapper.

No new npm installs.

## Files to create / modify

### New

- `src/components/ui/switch.tsx` — minimal RTL-aware toggle.
- `src/components/ui/popover.tsx` — standard shadcn radix wrapper.
- `src/app/(app)/[tenantSlug]/menu/_components/MenuClient.tsx` — main client component.
- `src/app/(app)/[tenantSlug]/menu/_components/MenuItemDrawer.tsx` — Sheet-based create/edit form.
- `src/app/(app)/[tenantSlug]/menu/_components/LinkRecipePopover.tsx` — recipe search + link/unlink.
- `src/app/(app)/[tenantSlug]/menu/_components/DeleteMenuItemDialog.tsx` — AlertDialog confirm.

### Modified

- `src/app/(app)/[tenantSlug]/menu/page.tsx` — replace the placeholder with a real Server Component that fetches tenant, role, and the initial menu list, then renders `<MenuClient>`.
- `src/lib/types/index.ts` — add optional `recipeId` to `MenuItem`.
- `src/lib/actions/menu-items.ts` — already has the `linkRecipe` stub appended.

## Component behavior summary

### `MenuClient`
- Props: `tenantId`, `tenantSlug`, `userRole`, `initialItems: MenuItem[]`.
- State: `items`, `search`, `category` (`'all' | MenuCategory`), `editing` (item or `null` for new), `linkingItem`, `deletingItem`.
- `useTransition` for refresh-on-mutation; sonner toasts.
- Filter: search by `nameHe`/`nameEn` substring (lowercase), category exact match.
- Table columns (RTL): שם מנה, קטגוריה, מחיר, מתכון מקושר, פעיל, פעולות. **No FC% column** per the prompt's "actually do NOT show FC% on this page" override.
- Active toggle: optimistic, on error revert + toast.
- CSV export: builds CSV from current filtered list; columns שם,קטגוריה,מחיר,מזהה-POS; UTF-8 BOM for Excel; `Blob` + temp `<a download>`.
- Empty / loading states per spec.

### `MenuItemDrawer`
- shadcn `Sheet side="right"` (existing component).
- Controlled form via `useState`. Validate on submit, show errors below fields in red.
- Price input: number input bound to a string draft; on save `Math.round(parseFloat(draft) * 100)`.
- Calls `createMenuItem` or `updateMenuItem`, returns the new/updated item to parent for state merge.

### `LinkRecipePopover`
- Trigger: small "קשר מתכון" button (or recipe name + Pencil if linked).
- On open: lazy `getRecipes(tenantId, 'menu')` (cache once).
- Search input + scrollable list. Click → `linkRecipe(...recipe.id)`. "הסר קישור" → `linkRecipe(..., null)`.
- Optimistic update via callback to parent.

### `DeleteMenuItemDialog`
- shadcn AlertDialog. Optimistically removes from parent list; on error, parent re-inserts and shows toast.

## Risks

- `linkRecipe` will fail at runtime until the backend phase ships the `recipe_id` column on `menu_items`. UI is wired correctly so it will "just work" once the column lands. I'll note this clearly so it's not a surprise.
- The custom `Switch` is intentionally minimal; if shadcn's animated switch is required later, swap to the official version after installing `@radix-ui/react-switch`.

Ready to implement on approval.
