## Manager Overrides (Step 2.4)

Add a manager-only "override forecast" section to the existing `PrepTaskDrawer` so owners/managers can replace the AI-generated `qtyRequired` and view/revert override history. No new pages.

### 1. Server action stub — `src/lib/actions/overrides.ts` (new)

`'use server'` module mirroring the `prep.ts` in-memory pattern.

- Export `ManagerOverride` interface matching the spec.
- In-memory store: `Map<tenantId, ManagerOverride[]>` (newest first).
- `createOverride(tenantId, data)` — generates id, sets `overriddenBy: 'current_user'`, `reverted: false`, prepends to list.
- `revertOverride(tenantId, overrideId)` — flips `reverted: true`, sets `revertedBy` and `revertedAt`.
- `getOverrides(tenantId, options?)` — filters by `entityType` / `entityId`; excludes reverted unless `includeReverted: true`.

### 2. `PrepListClient.tsx` — pass userRole down

- The component already receives `userRole: Role | null` via Props but doesn't forward it. Update the `<PrepTaskDrawer ... />` call to add `userRole={userRole}`.
- Also extend the `applyTaskUpdate` helper usage so the drawer can update the parent task when an override changes `qtyRequired` — reuse the existing `onSaved` prop (it already accepts a full `PrepTask`).

### 3. `PrepTaskDrawer.tsx` — add override section

Imports to add: `Separator`, `Badge`, `Skeleton`, icons `Wrench`, `History`, `RotateCcw`, `AlertCircle`, `IfRole`, `getOverrides`/`createOverride`/`revertOverride`, type `ManagerOverride`.

New props: `userRole: Role | null`.

New state:
- `overrides: ManagerOverride[]` (active only by default, but we show recent reverted in history too — load with `includeReverted: true` and cap to 5).
- `loadingOverrides: boolean`
- `newQty: string`, `reason: string`
- `applyingOverride: boolean`

Behavior:
- On drawer open (`open && task && isManager`) call `getOverrides(tenantId, { entityType: 'prep_task', entityId: task.id, includeReverted: true })`. Reset inputs.
- Render an `IfRole roles={['owner', 'manager']}` block below the existing fields, separated by `<Separator />`:
  - Header row: `Wrench` icon + "עקיפת תחזית (מנהל בלבד)".
  - "כמות נדרשת נוכחית: {task.qtyRequired} {task.unit}" + Badge "מוגדר ע\"י מנהל" if any non-reverted override exists.
  - Input number for new qty + Textarea for optional reason (max 200 chars) + "החל עקיפה" Button.
  - History section with `History` icon header "היסטוריית עקיפות": list of up to 5 entries, each showing "{overrideValue} (היה: {originalValue})" + relative time + reason (if any) + "בטל" button (`RotateCcw`) for non-reverted entries; reverted entries are shown muted with "(בוטל)" label. Empty state: muted "אין עקיפות".
  - Skeleton rows while `loadingOverrides`.

Apply override flow:
- Validate `Number(newQty) > 0` else toast error (`AlertCircle`-style red toast via `toast.error`).
- Call `createOverride(tenantId, { entityType: 'prep_task', entityId: task.id, field: 'qty_required', originalValue: task.qtyRequired, overrideValue: parsed, reason: reason.trim() || null })`.
- On success: prepend to local `overrides`, clear `newQty` + `reason`, toast success, and call `onSaved({ ...task, qtyRequired: parsed, updatedAt: new Date().toISOString() })` so the parent table updates optimistically. Do NOT close the drawer.
- On error: toast.

Revert flow:
- Call `revertOverride(tenantId, ov.id)`. Optimistically mark the entry `reverted: true` in local list. If this was the most recent active override, also call `onSaved({ ...task, qtyRequired: ov.originalValue as number, updatedAt: ... })` to restore the parent value. On error, rollback + toast.

Helper: small `relativeTimeHe(iso)` (same shape as DashboardClient — "לפני X דקות/שעות/ימים").

Manager check: `const isManager = userRole === 'owner' || userRole === 'manager'`.

### Constraints

- Only modifies: `src/app/(app)/[tenantSlug]/prep/_components/PrepTaskDrawer.tsx`, `PrepListClient.tsx`.
- Adds one new file: `src/lib/actions/overrides.ts` (stub action — required since spec says it already exists; mirrors other stubs).
- shadcn-only primitives, Hebrew RTL, no new packages, optimistic updates with rollback.
