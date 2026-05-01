# Phase 9 — Pilot in Restaurant

> **Covers:** Steps 9.1–9.5. Full production deployment in a real restaurant. Onboarding wizard, real data loading, production usage, performance hardening, documentation.

> 🎯 **Goal:** The restaurant cannot go back to the old system. Uptime ≥ 99.5%, 90% of daily ops in the system, no new bugs for 7 consecutive days.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
pnpm lint
```

Expected: Phase 8 complete. All features built and E2E tested.

---

# Step 9.1 — Onboarding Wizard

## Division of labor

**Claude Code:** wizard logic, data validation, tenant provisioning.
**Lovable:** wizard UI (10 steps).

## Task 1 — Wizard Backend (Claude Code)

### Prompt for Claude Code

Build the onboarding wizard backend.

Requirements:

1. Create `src/lib/actions/onboarding.ts`:

```typescript
export interface OnboardingState {
  tenantId: string;
  currentStep: number; // 1-10
  completedSteps: number[];
  data: {
    restaurantInfo?: { name_he; address; phone; logo_url };
    teamMembers?: { email; role }[];
    menuItems?: number; // count imported
    recipes?: number; // count with BOM
    firstInventoryCount?: boolean;
    integrations?: { tabit; ontopo; sumit; marketman }[];
    checklists?: number;
    sops?: number;
    goLiveDate?: Date;
  };
}

export async function getOnboardingState(tenantId: string): Promise<OnboardingState>;
export async function completeStep(
  tenantId: string,
  step: number,
  data: unknown,
): Promise<OnboardingState>;
export async function skipStep(tenantId: string, step: number): Promise<OnboardingState>;
```

2. Wizard steps:
   - Step 1: Restaurant info (name, address, phone, logo upload)
   - Step 2: Add team members (invite by email)
   - Step 3: Import menu (CSV or manual, min 10 items to proceed)
   - Step 4: Add recipes (top 20 by sales — link to menu items)
   - Step 5: First inventory count (min 30 ingredients)
   - Step 6: Configure integrations (Tabit/Sumit/Marketman/OnTopo)
   - Step 7: Set up checklists (use defaults or customize)
   - Step 8: Upload first SOPs (3 minimum)
   - Step 9: System tour (modal walkthrough)
   - Step 10: Go live confirmation

3. Persist state in DB:

```sql
-- migration: {timestamp}_onboarding.sql
CREATE TABLE tenant_onboarding (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 1,
  completed_steps INT[] NOT NULL DEFAULT '{}',
  state_data JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

4. Redirect logic: if onboarding not complete → redirect from any page to `/onboarding`.

5. Tests: step completion, skip, redirect logic.

### Validation

- [ ] Migration clean
- [ ] Complete step 3 with CSV import → `menuItems` count updated
- [ ] Redirect to onboarding if not complete
- [ ] `pnpm test` green

### Commit

`feat(onboarding): 10-step onboarding wizard backend`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-9-onboarding.md`.

Build:

1. **`/onboarding` page** — wizard:
   - Progress bar: step X of 10
   - Step indicator (left sidebar on desktop, top dots on mobile)
   - Each step: title, description, action area, "המשך" button
   - "דלג לעכשיו" link (for optional steps)
   - Back button
   - Step completion animation

2. **Step-specific UIs**:
   - Step 1: form fields + logo upload
   - Step 2: add member rows (email + role dropdown)
   - Step 3: CSV drop zone + preview table
   - Step 4: recipe checklist (top menu items listed)
   - Step 5: inventory count (simplified version of count screen)
   - Step 6: integration cards with connect buttons
   - Step 7: checklist template selector
   - Step 8: SOP uploader
   - Step 9: video tour embed (YouTube)
   - Step 10: confetti + "התחל לעבוד!" button

After Lovable: wire all steps to `completeStep`.

### Commit

`feat(onboarding): wizard UI, 10 steps wired`

---

# Step 9.2 — Real Data Loading

> This step is mostly manual work by Elad, supported by Claude Code for data tools.

## Task 1 — Data Import Tools (Claude Code)

### Prompt for Claude Code

Build data import tooling to load real restaurant data efficiently.

Requirements:

1. Create `scripts/import-menu.ts` — CLI script:
   - Reads CSV exported from existing POS/spreadsheet
   - Maps columns (interactive prompts if ambiguous)
   - Creates menu_items + ingredients in bulk
   - Dry-run mode: shows what would be imported

2. Create `scripts/import-recipes.ts` — CLI script:
   - Reads recipes from Excel (common format: שם מנה | מרכיב | כמות | יחידה)
   - Creates recipes + recipe_components
   - Reports: imported X recipes, Y missing ingredients (created as stubs)

3. Create `src/app/(app)/[tenantSlug]/settings/data-import/page.tsx` (owner only):
   - Upload area for menu CSV
   - Upload area for recipes Excel
   - Preview + confirm before import
   - Progress indicator during import
   - Error report after import

4. Create admin endpoint for bulk operations (service role, never exposed to frontend):
   - `POST /api/admin/seed-tenant` — seeds tenant with demo data
   - Protected by secret header

### Validation

- [ ] `scripts/import-menu.ts` successfully imports a 50-item CSV
- [ ] Recipe import with missing ingredients creates stubs
- [ ] Data import page accessible to owner

### Commit

`feat(import): bulk data import tools for pilot onboarding`

---

# Step 9.3 — Production Deployment + Monitoring

## Task 1 — Production Hardening (Claude Code)

### Prompt for Claude Code

Harden the system for production deployment.

Requirements:

1. **Vercel production deploy:**
   - Set all env vars in Vercel dashboard
   - Enable Vercel Analytics
   - Enable Vercel Speed Insights
   - Custom domain configured

2. **Supabase production:**
   - Enable Point-in-Time Recovery (PITR) on production project
   - Set up daily backup schedule
   - Enable SSL enforcement
   - Set connection pooling to transaction mode (PgBouncer)
   - Apply all migrations to production

3. **Security checklist** (per ARCHITECTURE.md §15.1):
   - [ ] HTTPS only with HSTS preload
   - [ ] CSP headers configured in `next.config.js`
   - [ ] Rate limiting on auth endpoints (Upstash)
   - [ ] MFA enforced for owner (verify in production)
   - [ ] Service role key not in any git history
   - [ ] Sentry scrubbing PII verified in production

4. **Monitoring dashboards** (set up in each service):
   - Sentry: error rate dashboard
   - PostHog: feature usage funnel
   - Axiom: daily active users, API response times
   - Inngest: job success rates, failure alerts

5. **Runbook** `docs/runbook.md`:
   - What to do if DB is unreachable
   - What to do if Vercel deploy fails
   - What to do if AI Gateway returns errors
   - What to do if Tabit sync fails
   - How to manually trigger a sync
   - How to restore from backup

6. **Load test** (basic):
   - 10 concurrent users on prep page
   - 5 concurrent users on inventory count
   - Verify no DB connection errors

### Validation

- [ ] Production URL accessible
- [ ] Sentry receives production errors
- [ ] PostHog receives production events
- [ ] All Inngest jobs registered in production
- [ ] Load test passes without errors
- [ ] Runbook written

### Commit

`ops: production hardening, monitoring dashboards, runbook`

---

# Step 9.4 — Parallel Running + Bug Fixes

> The restaurant runs both old system and Restaurant OS in parallel for week 1, then switches fully in week 2.

## Task 1 — Bug Fix Sprint (Claude Code)

### Prompt for Claude Code

Run parallel operation support and fix real-world bugs.

This is an ongoing task during pilot. For each bug reported:

1. Reproduce locally
2. Write a failing test
3. Fix
4. Verify test passes
5. Deploy to production
6. Confirm with Elad

Expected categories of bugs during pilot:

- Hebrew text rendering issues on specific devices
- iOS Safari edge cases
- Race conditions in Realtime subscriptions
- Slow queries with real production data volume
- Edge cases in FC calculation (comps, returns, waste)
- Onboarding wizard step failures with real data

For each bug: open a GitHub issue, link to fix PR.

**Performance triage** if pages are slow in production:

1. Add `EXPLAIN ANALYZE` to slow queries in Supabase
2. Add indexes if missing
3. Add `React.memo` or `useMemo` if component re-rendering
4. Add `cache()` or `unstable_cache` if data rarely changes

### Commit pattern

`fix: [description of bug]` — one commit per fix, linked to GitHub issue

---

# Step 9.5 — Documentation + Handover

## Task 1 — User Documentation (Claude Code)

### Prompt for Claude Code

Create complete user documentation for restaurant staff.

Requirements:

1. Create `docs/user-guide/` directory with these files (Hebrew markdown):
   - `owner-guide.md` — setup, integrations, reports, FC
   - `manager-guide.md` — daily brief, prep override, checklists, documents
   - `chef-guide.md` — prep list, recipes, waste reporting, inventory count
   - `staff-guide.md` — checklist completion, SOPs, daily brief

2. Create `docs/faq.md` — top 20 questions from pilot.

3. In-app help: add `?` tooltip to every KPI card and complex UI element with a short Hebrew explanation.

4. Create `docs/video-scripts/` — scripts for tutorial videos (not the videos themselves):
   - Script for each role (4 scripts)
   - Max 3 minutes per video
   - Simple, no jargon

5. Update `README.md` with production deployment instructions.

### Validation

- [ ] All 4 user guides written
- [ ] FAQ has at least 20 questions
- [ ] In-app tooltips on all KPI cards
- [ ] Video scripts complete

### Commit

`docs: complete user documentation for pilot`

---

## End of Phase 9

Phase 9 Definition of Done:

- [ ] 90% of daily operations in the system
- [ ] No new bug reports for 7 consecutive days
- [ ] Owner says "I'm not going back"
- [ ] Uptime ≥ 99.5% over 30 days (check Vercel + Supabase dashboards)
- [ ] All user documentation complete
- [ ] Runbook tested (simulate DB outage, verify response)
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green

Read `TIMELINE.md`. Next is Phase 10 (SaaS). Check if `PHASE-10-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.

---

> **Note to Claude Code:** Phase 10 (SaaS productization) requires significant business decisions from Elad before technical work begins — pricing, legal entity, Stripe tax configuration, marketing strategy. Do not attempt Phase 10 without explicit instruction and updated prompts file. The technical build of Phase 10 is straightforward given everything built in Phases 0-9; the constraints are business decisions, not engineering.
