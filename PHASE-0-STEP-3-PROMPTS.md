# Phase 0 · Step 0.3 — App Shell, PWA, shadcn RTL

> **Goal:** The application has a complete, professional shell — sidebar, topbar, tenant switcher, navigation. First Lovable collaboration. PWA installable. All shadcn/ui primitives tested for RTL.

---

## Pre-flight check

Before starting any task, run:

```
git log --oneline -5
ls -la src/app/\(app\)/
cat src/middleware.ts | head -30
node -e "const jwt = require('jsonwebtoken'); console.log('jwt ok')" 2>/dev/null || echo "check auth"
```

Expected state:

- Auth pages exist: `/login`, `/signup`, `/reset-password`, `/mfa/setup`, `/mfa/challenge`
- Middleware protects `/(app)/` routes
- JWT custom claims working (tenant_id + role in token)
- Membership management complete

If anything is missing, stop and report.

---

## Task 1 — App Shell Layout (Claude Code)

### Context to load

- `ARCHITECTURE.md` §17 (Frontend structure)
- `docs/adr/0007-monolith-architecture.md`
- `docs/adr/0010-lovable-claude-code-workflow.md`

### Prompt for Claude Code

Build the application shell: the persistent layout that wraps all authenticated pages.

Requirements:

1. Create `src/app/(app)/[tenantSlug]/layout.tsx`:
   - Loads tenant context via `requireTenant(tenantSlug)`
   - Provides tenant data via React Context to all children
   - Renders `<AppShell>` with sidebar + topbar + main content area
   - Handles loading and error states

2. Create `src/components/shared/AppShell.tsx`:
   - RTL layout: sidebar on RIGHT, main content on LEFT
   - Sidebar width: 240px on desktop, collapsible to icon-only (48px)
   - Topbar: 56px height, full width
   - Main content: scrollable, padding 24px
   - Mobile: sidebar hidden by default, toggle button in topbar
   - Responsive breakpoints: mobile < 768px, desktop ≥ 768px

3. Create `src/components/shared/Sidebar.tsx`:
   - Tenant name at top (bold)
   - Navigation items (see list below)
   - Role-based visibility per nav item
   - Active state on current route
   - Collapse toggle button at bottom
   - Navigation items:
     ```
     בית (home) — all roles
     Prep — chef, manager, owner
     צ׳קליסט — all roles
     מלאי — chef, manager, owner
     תפריט ומתכונים — manager, owner
     ביצועי פלור — manager, owner
     פיננסי — manager, owner
     נהלים — all roles
     הגדרות — manager, owner
     ```

4. Create `src/components/shared/Topbar.tsx`:
   - Left (in RTL = visual right): hamburger menu for mobile
   - Center: page title (dynamic, passed as prop)
   - Right (in RTL = visual left): tenant switcher + user avatar + logout

5. Create `src/components/shared/TenantSwitcher.tsx`:
   - Dropdown showing all tenants the user belongs to
   - Current tenant highlighted
   - Click → navigate to `/{newTenantSlug}/`
   - Show tenant name only (no logo yet)

6. Create `src/contexts/TenantContext.tsx`:
   - Provides: `tenantId`, `tenantSlug`, `tenantName`, `userRole`, `userId`
   - Hook: `useTenant()` — throws if used outside provider

7. Create placeholder pages (empty content, just title):
   - `src/app/(app)/[tenantSlug]/page.tsx` — "בית"
   - `src/app/(app)/[tenantSlug]/prep/page.tsx` — "Prep List"
   - `src/app/(app)/[tenantSlug]/checklist/page.tsx` — "צ׳קליסט"
   - All other nav items as empty placeholder pages

Do NOT:

- Build the actual content of any page — placeholders only.
- Add animations or transitions yet — pure functional layout.
- Use any icon library other than `lucide-react`.

### Validation

- [ ] Log in as `owner@example.com`, see the full app shell
- [ ] Sidebar shows correct nav items for owner role
- [ ] Log in as `chef@example.com`, sidebar shows only chef-visible items
- [ ] Mobile view (resize to 375px): sidebar is hidden, hamburger shows/hides it
- [ ] Tenant switcher shows "Mesada Gdola"
- [ ] Navigating between placeholder pages works
- [ ] Logout button works

### Commit

`feat(shell): app shell with sidebar, topbar, tenant switcher`

### Branch

`feat/phase-0-step-3-task-1`

---

## Task 2 — shadcn/ui RTL Audit (Claude Code)

### Context to load

- `ARCHITECTURE.md` §17.2 (RTL)
- Existing `src/components/ui/` (shadcn installs)

### Prompt for Claude Code

Install and audit all shadcn/ui components that will be used in Phase 1-3. Verify each renders correctly in RTL Hebrew.

Requirements:

1. Install these shadcn/ui components:

   ```bash
   pnpm dlx shadcn@latest add button input label form select textarea dialog sheet table badge avatar dropdown-menu tooltip popover command separator skeleton card tabs alert
   ```

2. Create `src/app/(app)/[tenantSlug]/_dev/components/page.tsx` (dev-only, guarded by `NEXT_PUBLIC_ENV !== 'production'`):
   - A showcase page displaying every installed component with Hebrew sample text
   - Tests RTL rendering: text alignment, icon placement, form field directions, dropdown positioning
   - Mark any component that has RTL issues with a red border

3. Fix RTL issues found. Common ones:
   - `Select` chevron should be on left (in RTL)
   - `Dialog` close button should be on left
   - `Sheet` default side should be `right` for nav drawers, `left` for detail panels
   - `Table` text alignment: Hebrew text right-aligned, numbers left-aligned
   - `Dropdown` menu should open to the left (not right) in RTL
   - `Toast` should appear bottom-right (which is bottom-start in RTL)

4. Create `src/lib/ui-utils.ts`:
   - `cn()` — className merger (clsx + tailwind-merge, likely already exists)
   - `rtlClass(ltrClass, rtlClass)` — returns correct class based on dir
   - `formatCurrency(cents)` — formats ILS: "₪1,234.50"
   - `formatDate(date)` — formats in Hebrew locale: "30 באפריל 2026"
   - `formatPercent(ratio)` — "30.5%"

5. Create `src/components/shared/PageHeader.tsx`:
   - Props: title (Hebrew string), subtitle (optional), actions (ReactNode)
   - Consistent header for all inner pages
   - Actions slot on the left (RTL visual right)

6. Update Tailwind config to add custom colors matching the design system:
   - `brand-primary`: used for main actions
   - `brand-surface`: card backgrounds
   - Keep only 2 brand colors + gray scale. No color explosion.

Do NOT:

- Modify shadcn component source files directly — override via CSS variables only.
- Add custom animations.
- Use color values not in the Tailwind config.

### Validation

- [ ] All 20 components render without console errors
- [ ] Component showcase page renders at `/_dev/components` in dev mode
- [ ] No RTL layout issues visible (all items in the showcase page look correct in Hebrew)
- [ ] `formatCurrency(12345)` returns `"₪123.45"`
- [ ] `formatDate(new Date('2026-04-30'))` returns Hebrew date string

### Commit

`feat(ui): install shadcn components, fix RTL issues, add UI utilities`

### Branch

`feat/phase-0-step-3-task-2`

---

## Task 3 — PWA Configuration (Claude Code)

### Context to load

- `ARCHITECTURE.md` §17.4 (PWA)
- `docs/adr/0003-pwa-not-native.md`

### Prompt for Claude Code

Make the app installable as a Progressive Web App with offline fallback.

Requirements:

1. Install PWA package:

   ```bash
   pnpm add next-pwa
   ```

2. Create `public/manifest.json`:

   ```json
   {
     "name": "Restaurant OS",
     "short_name": "RestOS",
     "description": "מערכת ניהול מסעדה",
     "start_url": "/",
     "display": "standalone",
     "orientation": "portrait-primary",
     "background_color": "#ffffff",
     "theme_color": "#000000",
     "lang": "he",
     "dir": "rtl",
     "icons": [
       { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
       {
         "src": "/icons/icon-512-maskable.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "maskable"
       }
     ]
   }
   ```

3. Create placeholder icons (simple solid color PNG, 192x192 and 512x512) in `public/icons/`. Use a Node script to generate them:

   ```bash
   node scripts/generate-icons.js
   ```

   Generate the script that uses `sharp` or `canvas` to create simple placeholder icons.

4. Configure `next-pwa` in `next.config.js`:
   - `dest: 'public'`
   - `disable: process.env.NEXT_PUBLIC_ENV === 'development'` (off in dev to avoid confusion)
   - `register: true`
   - `skipWaiting: true`
   - Cache strategy: network-first for API routes, stale-while-revalidate for static

5. Add offline fallback page `src/app/offline/page.tsx`:
   - Hebrew message: "אין חיבור לאינטרנט"
   - Subtitle: "בדוק את החיבור שלך ונסה שוב"
   - Retry button that calls `window.location.reload()`

6. Add `<link rel="manifest">` to `src/app/layout.tsx`.

7. Add Wake Lock API to prevent screen sleep on kitchen-facing pages:
   - Create `src/hooks/useWakeLock.ts`
   - Activates on prep list and checklist pages
   - Releases when page unmounts or tab loses focus

8. Add install prompt logic:
   - Track visit count in localStorage
   - After 3rd visit: show subtle "הוסף למסך הבית" banner
   - Create `src/components/shared/InstallPrompt.tsx`

Do NOT:

- Enable PWA in development (disable: true for dev).
- Use aggressive caching that breaks auth flows.
- Show install prompt on first visit.

### Validation

- [ ] `pnpm build` succeeds with PWA config
- [ ] `manifest.json` accessible at `/manifest.json`
- [ ] Icons load at `/icons/icon-192.png` and `/icons/icon-512.png`
- [ ] In Chrome DevTools → Application → Manifest: no errors
- [ ] Lighthouse PWA score ≥ 80 on production build
- [ ] Offline page shows when network is disconnected

### Commit

`feat(pwa): PWA manifest, icons, offline fallback, wake lock`

### Branch

`feat/phase-0-step-3-task-3`

---

## Task 4 — Home Dashboard Skeleton (Lovable + Claude Code)

### Context to load

- `ARCHITECTURE.md` §17 (Frontend)
- `src/components/shared/` (existing shell components)
- `src/contexts/TenantContext.tsx`

### Prompt for Claude Code

Build the home dashboard skeleton — the first real screen users see. No real data yet, just structure and role-based layout.

Requirements:

1. Create `src/app/(app)/[tenantSlug]/page.tsx` — full home dashboard:

   **For owner/manager:**
   - Row 1: 4 KPI cards (skeleton placeholders): "מכירות אתמול", "Food Cost %", "Prep %", "Waste"
   - Row 2: "משימות פתוחות" list (empty state: "אין משימות פתוחות 🎉")
   - Row 3: "פעילות אחרונה" feed (empty state)
   - Row 4: "התראות" section (empty state)

   **For chef:**
   - Row 1: "Prep להיום" card (links to `/prep`)
   - Row 2: "צ׳קליסט משמרת" card (links to `/checklist`)
   - Row 3: "דווח Waste" quick action button

   **For staff:**
   - Row 1: "נהלים לחתימה" (placeholder: "אין נהלים חדשים")
   - Row 2: "משימות שלי" (empty)

2. Create `src/components/features/dashboard/KPICard.tsx`:
   - Props: title, value, unit, trend (up/down/neutral), isLoading
   - Loading state: skeleton animation
   - Trend indicator: green arrow up, red arrow down

3. Create `src/components/features/dashboard/EmptyState.tsx`:
   - Props: icon (lucide), title, subtitle, action (optional button)
   - Consistent empty states across all pages

4. Create `src/components/features/dashboard/ActivityFeed.tsx`:
   - List of activity items with icon, text, timestamp
   - Empty state built in
   - Will be populated with real data in Phase 4+

5. Add Supabase Realtime subscription placeholder:
   - Connect to a `dashboard` channel on mount
   - Log incoming events to console (no UI update yet)
   - Disconnect on unmount
   - This proves Realtime works before we need it for real

Do NOT:

- Fetch real data yet — all values are hardcoded placeholders.
- Build charts — Phase 4+ only.
- Add complex animations.

### Validation

- [ ] Owner sees 4 KPI cards + activity feed + alerts
- [ ] Chef sees prep + checklist + waste cards
- [ ] Staff sees their specific view
- [ ] KPI cards show loading skeleton before "loading" state resolves
- [ ] Realtime connection established (visible in Supabase Studio → Realtime)
- [ ] Empty states render correctly with Hebrew text

### Commit

`feat(dashboard): role-based home dashboard skeleton`

### Branch

`feat/phase-0-step-3-task-4`

---

## End of Step 0.3 — End of Phase 0

When Task 4 is committed, Phase 0 is complete.

Run the Phase 0 Definition of Done check:

- [ ] New developer can onboard in ≤ 50 min (test by following README from scratch)
- [ ] Two test tenants exist, user can switch between them
- [ ] RLS verified by pgTAP (run `pnpm db:test`)
- [ ] Sentry, PostHog, Axiom all receive events
- [ ] Inngest echo cron fires
- [ ] Auth flow complete: login, signup, MFA, invite, roles
- [ ] App shell renders correctly for all 4 roles
- [ ] PWA installable

Read `TIMELINE.md`. Next step is Phase 1, Step 1.1. Check if `PHASE-1-STEP-1-PROMPTS.md` exists. If yes, load and begin. If no, stop and wait for Elad.
