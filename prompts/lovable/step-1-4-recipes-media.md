# Lovable Prompt — Recipe Media, Markdown & Version History (Step 1.4)

> Paste this entire file into Lovable. Add media, instructions, and version history to the existing recipe detail page.

---

## Context

This is a multi-tenant restaurant operations app built with:

- **Next.js 15 App Router** — all pages in `src/app/[tenantSlug]/`
- **React 19**, TypeScript strict mode
- **shadcn/ui** only — do not install or use any other component library
- **Tailwind CSS v4**
- **RTL Hebrew UI** — `dir="rtl"` is set on `<html>` globally
- **Role system**: `owner > manager > chef > staff`

**Do not write any Server Actions, DB queries, or API routes.**

---

## Server Actions to use (already implemented)

```typescript
// src/lib/actions/recipes.ts
import {
  updateRecipe,
  getRecipeVersions,
  restoreRecipeVersion,
  saveRecipeVersion,
} from '@/lib/actions/recipes';

// src/lib/storage/recipe-images.ts
import { uploadRecipeImage, deleteRecipeImage } from '@/lib/storage/recipe-images';
```

### Function signatures

```typescript
// Update recipe fields (returns Recipe)
updateRecipe(tenantId: string, id: string, data: Partial<{
  nameHe: string;
  nameEn: string | null;
  instructionsMd: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  yieldQty: number;
  yieldUnit: IngredientUnit;
}>)

// Save a version snapshot → returns RecipeVersion
saveRecipeVersion(tenantId: string, recipeId: string, changeNote?: string): Promise<RecipeVersion>

// Get version history (newest first)
getRecipeVersions(tenantId: string, recipeId: string): Promise<RecipeVersion[]>

// Restore recipe to a past version → returns RecipeWithComponents
restoreRecipeVersion(tenantId: string, recipeId: string, version: number): Promise<RecipeWithComponents>

// Upload image → returns public URL string
uploadRecipeImage(tenantId: string, recipeId: string, file: File): Promise<string>

// Delete all images for a recipe
deleteRecipeImage(tenantId: string, recipeId: string): Promise<void>
```

### Types

```typescript
// src/lib/types/index.ts
interface Recipe {
  id: string;
  tenantId: string;
  nameHe: string;
  nameEn: string | null;
  type: 'menu' | 'prep';
  yieldQty: number;
  yieldUnit: IngredientUnit;
  active: boolean;
  imageUrl?: string | null;
  currentVersion?: number;
  instructionsMd?: string | null;
  videoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecipeVersion {
  id: string;
  tenantId: string;
  recipeId: string;
  version: number;
  snapshotData: RecipeWithComponents;
  changedBy: string | null;
  changeNote: string | null;
  createdAt: string;
}
```

---

## Existing page to extend

The recipe detail page already exists at:

```
src/app/(app)/[tenantSlug]/recipes/[id]/page.tsx            ← Server Component
src/app/(app)/[tenantSlug]/recipes/[id]/_components/
  RecipeEditorClient.tsx    ← main client component — ADD sections to this
  BomTable.tsx
  AddComponentPopover.tsx
  LiveCostPanel.tsx
```

**Do NOT rewrite the existing components. Add the new sections below the existing BOM table inside `RecipeEditorClient`.**

---

## What to build

Add three new collapsible sections to `RecipeEditorClient`, each as a separate component file:

---

### 1. `RecipeImageUpload.tsx` — Image Section

Place at the **top of the page**, above the recipe name editor.

**Layout (RTL):**

```
┌──────────────────────────────────────────────────────────────────┐
│  [תמונת המתכון]                                                    │
│                                                                  │
│  ┌──────────────────────┐                                        │
│  │   📷 תמונה נוכחית   │  ← show if imageUrl exists             │
│  │   or placeholder    │     otherwise show camera icon         │
│  └──────────────────────┘                                        │
│                                                                  │
│  [העלה תמונה]  [הסר תמונה]  ← "הסר" only if imageUrl exists     │
└──────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- "העלה תמונה" button opens a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` 
- On file select: call `uploadRecipeImage(tenantId, recipeId, file)`, then `updateRecipe(tenantId, id, { imageUrl: url })`
- Show upload progress spinner while uploading
- "הסר תמונה" button: calls `deleteRecipeImage(tenantId, recipeId)`, then `updateRecipe(tenantId, id, { imageUrl: null })`
- On error: show error toast in Hebrew — "שגיאה בהעלאת התמונה"
- Image is displayed at 16:9 aspect ratio, max-width 400px, `object-fit: cover`
- Max file size enforced client-side (5MB) — show toast "קובץ גדול מדי — מקסימום 5MB" if exceeded

**Props:**
```typescript
interface RecipeImageUploadProps {
  tenantId: string;
  recipeId: string;
  imageUrl: string | null | undefined;
  onImageChange: (newUrl: string | null) => void;
  canEdit: boolean; // owner or manager only
}
```

---

### 2. `RecipeInstructionsEditor.tsx` — Markdown Instructions + Video

Place below the BOM table.

**Layout (RTL):**

```
┌──────────────────────────────────────────────────────────────────┐
│  [📝 הוראות הכנה]                            [עריכה | תצוגה מקדימה] │
├──────────────────────────────────────────────────────────────────┤
│  Textarea (edit mode):                                           │
│  כתוב הוראות הכנה בעברית...                                       │
│                                                                  │
│  OR rendered markdown (preview mode)                             │
├──────────────────────────────────────────────────────────────────┤
│  [🎬 קישור לסרטון]                                                │
│  Input: https://youtube.com/...                                  │
│  ← if valid YouTube/Vimeo URL: show embedded iframe below       │
└──────────────────────────────────────────────────────────────────┘
```

**Markdown editor behavior:**
- Toggle buttons: "עריכה" / "תצוגה מקדימה" — use shadcn Tabs
- In edit mode: plain `<Textarea>` with `dir="rtl"`, Hebrew placeholder
- In preview mode: render markdown using `dangerouslySetInnerHTML` after converting with a simple inline converter — support **bold** (`**text**`), bullet lists (`- item`), and numbered lists (`1. item`), newlines → `<br>`. No external markdown library.
- Auto-save: debounce 1500ms after last keystroke → call `updateRecipe(tenantId, id, { instructionsMd: value })`
- Show small "נשמר ✓" confirmation after save, fade out after 2s

**Video URL behavior:**
- Input field with Hebrew placeholder "הדבק קישור לסרטון YouTube או Vimeo"
- Validation on blur: accepts `youtube.com/watch?v=`, `youtu.be/`, `vimeo.com/` URLs
- If valid: show `<iframe>` embed below the input (16:9 aspect ratio, full width)
  - YouTube embed URL: `https://www.youtube.com/embed/{videoId}`
  - Vimeo embed URL: `https://player.vimeo.com/video/{videoId}`
- If invalid and non-empty: red border + "קישור לא תקין" error message
- On blur with valid URL: call `updateRecipe(tenantId, id, { videoUrl: value })`
- On clear: call `updateRecipe(tenantId, id, { videoUrl: null })`

**Props:**
```typescript
interface RecipeInstructionsEditorProps {
  tenantId: string;
  recipeId: string;
  instructionsMd: string | null | undefined;
  videoUrl: string | null | undefined;
  canEdit: boolean;
}
```

---

### 3. `RecipeVersionHistory.tsx` — Version History Panel

Place at the **bottom** of the page, inside a collapsible `<Collapsible>` (shadcn).

**Layout (RTL):**

```
┌──────────────────────────────────────────────────────────────────┐
│  [🕐 היסטוריית גרסאות]                               [▼ הצג/הסתר] │
├──────────────────────────────────────────────────────────────────┤
│  גרסה 3   30 באפריל 2026   אלעד כהן         [שחזר]              │
│  גרסה 2   29 באפריל 2026   מנהל המסעדה      [שחזר]              │
│  גרסה 1   28 באפריל 2026   אלעד כהן         [שחזר]              │
└──────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Collapsed by default; clicking the header expands it
- Load `getRecipeVersions(tenantId, recipeId)` when expanded (lazy load)
- Date format: "30 באפריל 2026" using `toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })`
- "שחזר" button (owner/manager only):
  - Opens an `AlertDialog` confirmation:
    ```
    שחזור גרסה
    שחזור יחליף את כל רכיבי המתכון הנוכחי. פעולה זו אינה הפיכה.
    [ביטול]  [שחזר]
    ```
  - On confirm: call `restoreRecipeVersion(tenantId, recipeId, version.version)`
  - On success: show toast "הגרסה שוחזרה בהצלחה", reload page data
  - On error: show toast "שגיאה בשחזור הגרסה"
- Empty state: "אין היסטוריית גרסאות עדיין"
- Loading: `<Skeleton>` rows × 3 while fetching

**Also: Auto-save version on meaningful saves**

In `RecipeEditorClient`, when the user clicks the main "שמור" button:
- After calling `updateRecipe`, also call `saveRecipeVersion(tenantId, recipe.id, 'עדכון ידני')`
- This ensures a snapshot is saved on every manual save

**Props:**
```typescript
interface RecipeVersionHistoryProps {
  tenantId: string;
  recipeId: string;
  canRestore: boolean; // owner or manager
}
```

---

## Integration into `RecipeEditorClient`

```tsx
// At the top of the return JSX (before recipe name input):
<RecipeImageUpload
  tenantId={tenantId}
  recipeId={recipe.id}
  imageUrl={recipe.imageUrl}
  onImageChange={(url) => setRecipe((r) => ({ ...r, imageUrl: url }))}
  canEdit={canEdit}
/>

// After the BOM table:
<RecipeInstructionsEditor
  tenantId={tenantId}
  recipeId={recipe.id}
  instructionsMd={recipe.instructionsMd}
  videoUrl={recipe.videoUrl}
  canEdit={canEdit}
/>

// At the bottom:
<RecipeVersionHistory
  tenantId={tenantId}
  recipeId={recipe.id}
  canRestore={canEdit}
/>
```

---

## File structure to produce

```
src/app/(app)/[tenantSlug]/recipes/[id]/_components/
  RecipeImageUpload.tsx       ← NEW
  RecipeInstructionsEditor.tsx ← NEW
  RecipeVersionHistory.tsx     ← NEW
```

Modify only `RecipeEditorClient.tsx` to integrate the three new components.

---

## Shared UI rules

1. **RTL everywhere**: all text right-aligned, textareas with `dir="rtl"`
2. **Hebrew only**: every visible label/button/placeholder in Hebrew
3. **shadcn/ui only**: Button, Textarea, Input, Skeleton, Collapsible, AlertDialog, Tabs, Badge
4. **No state management library**: useState + useTransition only
5. **Role guard**: wrap "העלה", "הסר", "שחזר" buttons in role check (only owner/manager)
6. **Toasts**: use shadcn `useToast` for all feedback
7. **Icons**: lucide-react only — `Camera`, `Trash2`, `Upload`, `FileText`, `Video`, `Clock`, `RotateCcw`, `ChevronDown`

---

## DO NOT

- Write Server Actions
- Write DB migrations
- Install any new packages (no markdown library, no react-player, no react-dropzone)
- Rewrite existing components (BomTable, AddComponentPopover, LiveCostPanel)
- Use `fetch` or `axios` — call Server Actions directly
