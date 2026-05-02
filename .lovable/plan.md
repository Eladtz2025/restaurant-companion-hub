## Goal

Extend the existing recipe detail page (`src/app/(app)/[tenantSlug]/recipes/[id]/`) with three new sections: image upload, markdown instructions + video embed, and version history. All in Hebrew RTL, shadcn/ui only, role-gated for owner/manager.

## Prerequisites — missing in repo

The prompt says "Server Actions to use (already implemented)". They are **not** in the repo:

- `src/lib/actions/recipes.ts` is missing `saveRecipeVersion`, `getRecipeVersions`, `restoreRecipeVersion`, and the `instructionsMd` / `videoUrl` / `imageUrl` fields on `updateRecipe`.
- `src/lib/storage/recipe-images.ts` does not exist (no `uploadRecipeImage`, `deleteRecipeImage`).
- The `Recipe` type lacks `imageUrl`, `instructionsMd`, `videoUrl`, `currentVersion`.
- `RecipeVersion` type doesn't exist.
- DB has no `recipe_versions` table or storage bucket for recipe images.

The prompt also says "DO NOT write Server Actions / DB migrations". So **Claude Code (the orchestrator) must ship those before this UI task lands**. I'll write the UI against the documented signatures and types — it will compile only once those types and actions exist.

**Recommendation**: I'll add the missing optional fields to the `Recipe` type and add a `RecipeVersion` interface (purely type-level, no DB / no actions), so the UI compiles. Backend wiring stays Claude's responsibility.

## Missing shadcn primitives

Need to add (shadcn copy-paste components, no new packages):
- `src/components/ui/textarea.tsx`
- `src/components/ui/collapsible.tsx` (wraps `@radix-ui/react-collapsible` — already a transitive dep of other radix components, will verify; if not present, fall back to a manual `useState` open/close — no new install).

I'll verify availability of `@radix-ui/react-collapsible` first; if missing, I'll implement a plain `<button>` + conditional render instead of installing.

## Deviations from prompt I'll apply (consistency with existing code)

- **Toasts**: prompt says "shadcn useToast"; existing code uses `sonner`'s `toast`. I'll keep `sonner` for consistency.
- **Role guard**: existing code uses `IfRole` wrapper component, not inline checks — I'll use `IfRole` for the action buttons.
- **Header layout**: image goes above the name row, but I'll keep the existing back button / save button top bar untouched.

## File plan

### New files

1. **`src/app/(app)/[tenantSlug]/recipes/[id]/_components/RecipeImageUpload.tsx`**
   - Hidden `<input type="file">` triggered by "העלה תמונה" button.
   - 5MB client-side check, accept jpeg/png/webp.
   - Uploading state via `useTransition` + spinner.
   - Renders `<img>` at 16:9, max-width 400px, `object-cover`, rounded.
   - "הסר תמונה" button under image (role-gated).
   - On success/error: sonner toast in Hebrew.
   - Calls `uploadRecipeImage` then `updateRecipe({ imageUrl })`; calls `onImageChange` to update parent state.

2. **`src/app/(app)/[tenantSlug]/recipes/[id]/_components/RecipeInstructionsEditor.tsx`**
   - Card with shadcn `Tabs` ("עריכה" / "תצוגה מקדימה").
   - Edit tab: `<Textarea dir="rtl">` with Hebrew placeholder.
   - Preview tab: inline markdown converter (regex-based) supporting `**bold**`, `- bullet`, `1. numbered`, newlines→`<br>`. Output via `dangerouslySetInnerHTML` (escape HTML first to prevent XSS).
   - Auto-save: `useEffect` with `setTimeout(1500)` debounce on text change → `updateRecipe({ instructionsMd })`. Sets a "נשמר ✓" indicator that fades after 2s.
   - Below: video URL `<Input>` with validate-on-blur. Regex parses YouTube (`v=` or `youtu.be/`) and Vimeo (`vimeo.com/123`) IDs. On valid + change → `updateRecipe({ videoUrl })`. Renders `<iframe>` 16:9 below input. Invalid → red border + Hebrew error text.
   - Read-only when `!canEdit`: textarea disabled, video input disabled.

3. **`src/app/(app)/[tenantSlug]/recipes/[id]/_components/RecipeVersionHistory.tsx`**
   - Wrapped in a header button + state-driven open/close (since shadcn Collapsible may not be installed — uses `ChevronDown` rotating).
   - Lazy load: on first open, `useTransition` calls `getRecipeVersions`. Cache result in state.
   - Renders list of rows: version number, formatted date (`he-IL` long), changeNote.
   - "שחזר" button per row (gated via `IfRole` / `canRestore` prop) → `AlertDialog` confirm → `restoreRecipeVersion` → toast + `router.refresh()`.
   - Loading: 3× `<Skeleton>` rows.
   - Empty: Hebrew message.

### Modified files

4. **`RecipeEditorClient.tsx`**
   - Add `recipe` to local state via `useState` so `RecipeImageUpload`'s `onImageChange` can update header image.
   - Insert `<RecipeImageUpload>` at top, above the back-button row (or just under it, above the name — per prompt: above name editor).
   - After the BOM table grid: `<RecipeInstructionsEditor>` full-width below.
   - At bottom: `<RecipeVersionHistory>`.
   - Update `handleSaveHeader`: after `updateRecipe`, also call `saveRecipeVersion(tenantId, recipe.id, 'עדכון ידני')` (best-effort, swallow error with toast).

5. **`src/lib/types/index.ts`**
   - Add optional `imageUrl`, `instructionsMd`, `videoUrl`, `currentVersion` to `Recipe`.
   - Add `RecipeVersion` interface.

6. **`src/components/ui/textarea.tsx`** — standard shadcn textarea (small file).

7. **`src/components/ui/collapsible.tsx`** — only if `@radix-ui/react-collapsible` is already in `node_modules`/`package.json`. Otherwise skip and use plain state in the version history component.

## Open questions / risks

- **Backend gap**: this UI cannot function in production until Claude Code adds the storage helpers, server actions, DB columns (`image_url`, `instructions_md`, `video_url`, `current_version`), the `recipe_versions` table, and the Supabase storage bucket. I'll write the UI to the documented signatures so it compiles and works as soon as the backend lands.
- **Markdown XSS**: I'll HTML-escape the textarea content before applying the bold/list regex transformations, so user content can't inject tags via `dangerouslySetInnerHTML`.
- **Version snapshotting on every "save"**: writing a version every time the user clicks save (even for tiny name edits) can pollute history. Acceptable per the prompt; flagging in case you want to debounce or only snapshot on BOM changes.

Confirm and I'll implement.
