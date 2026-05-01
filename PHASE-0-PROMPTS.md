# Phase 0 · Week 1 — Tasks

> **Goal:** Stand up the foundation. No features, only infrastructure. By end of week: Next.js running locally, Supabase wired up with RLS, CI passing, observability live, Inngest cron echo running.

---

## ⚠️ HUMAN-ONLY PREREQUISITES

> **Claude Code: do not execute this section. It describes manual steps the human completes before invoking you. Skip directly to Task 1 when starting work.**

Before triggering the orchestration:

### A. Repo

- Create private GitHub repo `restaurant-os`
- Push these files to it (already created):
  - `ARCHITECTURE.md`
  - `PHASING.md`
  - `.env.example`
  - `docs/adr/` (README + ADRs 0001–0010)
  - `PHASE-0-WEEK-1-PROMPTS.md` (this file)

### B. External accounts

- Supabase — create two projects: `restaurant-os-staging`, `restaurant-os-production`
- Vercel — link to GitHub
- Anthropic Console — API key
- Google AI Studio — API key (Gemini)
- Inngest — app `restaurant-os`
- Sentry — Next.js project `restaurant-os`
- PostHog — EU project
- Axiom — dataset `restaurant-os`
- Resend — API key (optional this week)

### C. Local machine

- Node 20+
- pnpm 9+
- Docker running
- Supabase CLI 2+

### D. Local env

- Copy `.env.example` to `.env.local`
- Fill in all `[REQUIRED]` values
- Confirm `.env.local` is in `.gitignore`

---

## Task 1 — Bootstrap Next.js

### Context to load

- `ARCHITECTURE.md` §3 (Stack), §17 (Frontend)
- `docs/adr/0002-supabase-platform.md`
- `docs/adr/0003-pwa-not-native.md`
- `docs/adr/0007-monolith-architecture.md`

### Prompt for Claude Code

Bootstrap a Next.js 15 application with TypeScript, Tailwind v4, shadcn/ui, and full Hebrew RTL support.

Requirements:

1. Initialize Next.js 15 with App Router, TypeScript strict mode, ESLint, Tailwind, `src/` directory layout.
2. Use pnpm as the package manager. Generate `pnpm-workspace.yaml` even with one package now.
3. Configure TypeScript strict mode in `tsconfig.json`:
   - `"strict": true`
   - `"noUncheckedIndexedAccess": true`
   - `"noImplicitReturns": true`
   - `"noFallthroughCasesInSwitch": true`
4. Install Tailwind v4 with the official RTL plugin. RTL is the default; LTR is fallback.
5. Set the root layout (`src/app/layout.tsx`):
   - `<html lang="he" dir="rtl">`
   - Heebo font from Google Fonts via `next/font/google`, subsets `['hebrew', 'latin']`
   - `<body>` with proper className for RTL spacing
6. Initialize shadcn/ui via the CLI with `new-york` style and `slate` base color. Do not add components yet.
7. Create the directory tree (empty for now, with `.gitkeep` where needed):
   ```
   src/
   ├── app/
   │   ├── (auth)/.gitkeep
   │   ├── (app)/.gitkeep
   │   └── api/.gitkeep
   ├── components/
   │   ├── ui/.gitkeep
   │   ├── shared/.gitkeep
   │   └── features/.gitkeep
   ├── lib/
   │   ├── supabase/.gitkeep
   │   └── ai/.gitkeep
   ├── adapters/.gitkeep
   └── prompts/.gitkeep
   inngest/.gitkeep
   supabase/.gitkeep
   tests/.gitkeep
   ```
8. Create a placeholder home page at `src/app/page.tsx` showing Hebrew text: "Restaurant OS — תשתית פועלת" with a small subtitle confirming RTL rendering.
9. Add npm scripts to `package.json`:
   - `"dev"`: `"next dev"`
   - `"build"`: `"next build"`
   - `"start"`: `"next start"`
   - `"lint"`: `"next lint"`
   - `"typecheck"`: `"tsc --noEmit"`
   - `"format"`: `"prettier --write ."`
   - `"format:check"`: `"prettier --check ."`
10. Add `.nvmrc` with Node version `20`.

Do NOT:

- Install Redux, Recoil, or any global state library.
- Install styled-components or emotion.
- Configure Pages Router.
- Add authentication yet.

### Validation

- [ ] `pnpm install` exits with code 0
- [ ] `pnpm dev` starts the server on port 3000
- [ ] Home page at http://localhost:3000 renders Hebrew text in RTL direction (verify `dir="rtl"` on `<html>`)
- [ ] Heebo font is applied (verify in browser DevTools Computed styles: font-family includes "Heebo")
- [ ] `pnpm typecheck` exits with code 0 with no errors
- [ ] `git status` is clean after committing

### Commit

`feat: bootstrap Next.js 15 with TypeScript, Tailwind v4, RTL`

### Branch

`feat/phase-0-week-1-task-1`

---

## Task 2 — Code Quality Tooling

### Context to load

- `package.json` (existing)

### Prompt for Claude Code

Set up code quality tooling: ESLint flat config, Prettier, Husky, lint-staged, commitlint.

Requirements:

1. Configure ESLint flat config (`eslint.config.mjs`):
   - Extend `next/core-web-vitals` and `next/typescript`
   - Add `@typescript-eslint/no-unused-vars` as error
   - Add `@typescript-eslint/consistent-type-imports` as warn
   - Add `import/order` rule with grouping
   - Disable `react/no-unescaped-entities` (Hebrew has many apostrophes)

2. Configure Prettier (`.prettierrc.json`):
   - `"semi": true`
   - `"singleQuote": true`
   - `"trailingComma": "all"`
   - `"printWidth": 100`
   - `"tabWidth": 2`
   - `"arrowParens": "always"`
   - `"plugins": ["prettier-plugin-tailwindcss"]`
   - Create `.prettierignore` excluding: `node_modules`, `.next`, `.vercel`, `supabase/.branches`, `*.lock`

3. Set up Husky for git hooks:
   - Run `pnpm dlx husky init`
   - Configure `pre-commit` hook to run `lint-staged`
   - Configure `commit-msg` hook to run `commitlint`

4. Set up `lint-staged` in `package.json`:
   - `"*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"]`
   - `"*.{json,md,yml,yaml,css}": ["prettier --write"]`

5. Set up commitlint with conventional commits:
   - Install `@commitlint/cli` and `@commitlint/config-conventional`
   - Create `commitlint.config.mjs` extending conventional
   - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

6. Add EditorConfig (`.editorconfig`):
   - 2 spaces indent
   - LF line endings
   - UTF-8
   - Trim trailing whitespace (except markdown)

Do NOT:

- Configure Stylelint.
- Use the deprecated `.eslintrc.json` format.
- Add airbnb or other heavy ESLint configs.

### Validation

- [ ] Introduce a deliberate ESLint violation (unused variable). Run `pnpm lint`. It fails. Revert.
- [ ] Introduce a Prettier violation. Run `pnpm format:check`. It fails. Revert.
- [ ] Attempt a commit with message `"asdf"`. Husky rejects via commitlint.
- [ ] Commit with `"chore: configure code quality tooling"`. It passes.
- [ ] Confirm `pre-commit` hook auto-fixes a fixable lint issue.

### Commit

`chore: configure code quality tooling (ESLint, Prettier, Husky, commitlint)`

### Branch

`feat/phase-0-week-1-task-2`

---

## Task 3 — Supabase Local + Baseline Schema

### Context to load

- `ARCHITECTURE.md` §4 (Multi-Tenancy), §5 (Data Model), §6 (Auth)
- `docs/adr/0001-postgres-rls-multi-tenant.md`
- `docs/adr/0002-supabase-platform.md`

### Prompt for Claude Code

Initialize Supabase locally and create the foundational schema with RLS.

Requirements:

1. Initialize Supabase:
   - Run `supabase init` in the project root
   - Update `supabase/config.toml`:
     - `api.port`: 54321
     - `db.port`: 54322
     - `studio.port`: 54323
     - `auth.site_url`: `"http://localhost:3000"`
     - `auth.additional_redirect_urls`: `["http://localhost:3000/**"]`
     - `auth.enable_signup`: true
     - `auth.email.enable_signup`: true
     - `auth.email.enable_confirmations`: false (local dev)

2. Create the first migration: `supabase/migrations/{timestamp}_baseline.sql`. Include in this order:

   a. Extensions: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

   b. `tenants` table (no `tenant_id`, no RLS — this IS the tenant table). Fields per `ARCHITECTURE.md` §4.2.

   c. `memberships` table linking `auth.users` to tenants with role. Fields per `ARCHITECTURE.md` §4.2. Roles allowed: `'owner'`, `'manager'`, `'chef'`, `'staff'`. Add `CHECK` constraint on role.

   d. Helper function `user_tenant_ids()` per `ARCHITECTURE.md` §4.3. Mark as `STABLE SECURITY DEFINER`.

   e. Helper function `user_role_in(uuid)` returning text — the role of current user in given `tenant_id`.

   f. `_audit_log` table per `ARCHITECTURE.md` §5.1.

   g. Trigger function `set_updated_at()` — generic trigger to update `updated_at`.

   h. Enable RLS on `tenants` and `memberships` with policies:
   - `tenants`: users can `SELECT` tenants they're a member of
   - `memberships`: users can `SELECT` their own memberships
   - `INSERT`/`UPDATE`/`DELETE`: only via service role for now

3. Create seed data: `supabase/seed.sql`
   - 1 tenant: "Mesada Gdola" (slug: `'mesada-gdola'`)
   - 4 test users via `auth.users` INSERT directly (bcrypt'd password `'password123'`):
     - `owner@example.com` (role: owner)
     - `manager@example.com` (role: manager)
     - `chef@example.com` (role: chef)
     - `staff@example.com` (role: staff)
   - Memberships linking each user to the tenant

4. Create pgTAP tests: `supabase/tests/baseline_rls.sql`. Verify with at least 5 distinct test cases:
   - User from tenant A cannot see tenants of tenant B
   - Without auth context, `user_tenant_ids()` returns empty
   - Service role can see everything
   - User can see their own memberships
   - User cannot see other users' memberships

5. Create Supabase TypeScript clients in `src/lib/supabase/`:
   - `server.ts` — `createServerClient` using `cookies()` from `next/headers`
   - `browser.ts` — `createBrowserClient`
   - `service.ts` — `createServiceClient` using `SERVICE_ROLE_KEY`. Server-only. Throw if invoked in browser environment.
   - `types.ts` — re-export of generated types (will be auto-generated)

6. Add scripts to `package.json`:
   - `"db:start"`: `"supabase start"`
   - `"db:stop"`: `"supabase stop"`
   - `"db:reset"`: `"supabase db reset"`
   - `"db:diff"`: `"supabase db diff -f"`
   - `"db:test"`: `"supabase test db"`
   - `"db:types"`: `"supabase gen types typescript --local > src/lib/supabase/database.types.ts"`

7. Update `.gitignore`:
   - `supabase/.branches`
   - `supabase/.temp`

8. Create `src/lib/tenant.ts` with `requireTenant(tenantSlug)` helper per `ARCHITECTURE.md` §4.4.

9. Create `src/lib/permissions.ts` per `ARCHITECTURE.md` §6.2.

Do NOT:

- Add tables for menu, recipes, inventory — those come in later phases.
- Add custom JWT claims yet.
- Use `SERIAL` or `BIGSERIAL`. UUIDs only.
- Use `FLOAT` for money. Always `INT` cents.
- Use `TIMESTAMP` without time zone. Always `TIMESTAMPTZ`.

### Validation

- [ ] `pnpm db:start` brings up Postgres + Auth + Studio
- [ ] `pnpm db:reset` applies the migration cleanly with no errors
- [ ] `pnpm db:test` runs pgTAP and ALL tests pass
- [ ] `pnpm db:types` generates `database.types.ts` without errors
- [ ] Supabase Studio at http://localhost:54323 lists `tenants`, `memberships`, `_audit_log`
- [ ] `requireTenant('mesada-gdola')` works for a logged-in test user (validate with a unit test)
- [ ] No SERIAL, FLOAT money, or naked TIMESTAMP exists in the migration

### Commit

`feat(db): baseline schema with RLS, helpers, and seed data`

### Branch

`feat/phase-0-week-1-task-3`

---

## Task 4 — CI Workflow (GitHub Actions)

### Context to load

- `package.json` (existing scripts)

### Prompt for Claude Code

Set up GitHub Actions CI. PRs cannot merge unless CI passes.

Requirements:

1. Create `.github/workflows/ci.yml` with these parallel jobs:

   **Job: `lint`**
   - Setup pnpm + Node 20
   - `pnpm install --frozen-lockfile`
   - `pnpm lint`
   - `pnpm format:check`

   **Job: `typecheck`**
   - Same setup
   - `pnpm typecheck`

   **Job: `build`**
   - Same setup
   - `pnpm build` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from secrets (dummy values OK for build)

   **Job: `db-test`**
   - Same setup + Supabase CLI installation
   - Start Supabase locally in CI
   - Apply migrations
   - Run pgTAP tests
   - Tear down

2. All jobs:
   - Trigger: `pull_request` to `main`, `push` to `main`
   - Use pnpm cache for `node_modules`
   - Use Node 20
   - Concurrency group cancels in-progress runs on the same PR

3. Create `.github/workflows/migrations-check.yml`:
   - Runs on PR
   - Detects changes in `supabase/migrations/`
   - If detected: dry-run apply against staging
   - Comments diff on PR

4. Create `.github/dependabot.yml`:
   - npm ecosystem, weekly
   - github-actions ecosystem, weekly
   - Group minor + patch updates
   - Auto-assign Elad as reviewer (use placeholder username)

5. Create `.github/CODEOWNERS`:
   - `* @YOUR_USERNAME` (placeholder)
   - `/supabase/migrations/` requires explicit review
   - `/docs/adr/` requires explicit review

6. Create `.github/pull_request_template.md`:
   - Sections: Summary, Changes, Testing, Screenshots (if UI), Checklist
   - Checklist items: tests added, ADR if architectural, migrations have rollback notes, RLS policies added if new tables

Do NOT:

- Use CircleCI or any non-GitHub-Actions provider.
- Add deployment steps — Vercel handles that.
- Run E2E tests yet.
- Add extra caching beyond pnpm cache.

### Validation

- [ ] Push the branch and open a PR
- [ ] All 4 CI jobs run on the PR
- [ ] All jobs pass on the current code
- [ ] Verify a deliberate breakage fails the right job (introduce a TS error, push, confirm `typecheck` fails, then revert)
- [ ] CODEOWNERS triggers review request on `supabase/migrations/` change

### Commit

`ci: add GitHub Actions workflows (lint, typecheck, build, db-test)`

### Branch

`feat/phase-0-week-1-task-4`

---

## Task 5 — Observability (Sentry, PostHog, Axiom)

### Context to load

- `ARCHITECTURE.md` §14 (Observability)
- Existing `src/lib/` structure

### Prompt for Claude Code

Wire up Sentry, PostHog, and Axiom for full-stack observability.

Requirements:

1. **Sentry:**
   - Install `@sentry/nextjs`
   - Run `npx @sentry/wizard@latest -i nextjs --skip-connect` and accept defaults
   - Configure `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`:
     - DSN from `NEXT_PUBLIC_SENTRY_DSN`
     - `tracesSampleRate: 0.1`
     - `environment` from `NEXT_PUBLIC_ENV`
     - `replaysSessionSampleRate: 0.0`
     - `beforeSend`: scrub PII (Hebrew names, phones, emails must NOT leak)
   - Source maps upload via `SENTRY_AUTH_TOKEN` in CI
   - Add `src/lib/observability/sentry.ts` with helper `setSentryTenantContext({ tenantId, role })`

2. **PostHog:**
   - Install `posthog-js` and `posthog-node`
   - Create `src/lib/observability/posthog.ts`:
     - Browser: lazy init in `app/layout.tsx`
     - Server: init in API routes / server actions
   - Use EU endpoint (https://eu.posthog.com)
   - Disable autocapture — explicit events only
   - Capture baseline events: `page_viewed`, `error_occurred`
   - Add helper `track({ event, properties, tenantId, userId })`

3. **Axiom:**
   - Install `next-axiom` or `@axiomhq/js`
   - Create `src/lib/observability/logger.ts`:
     - Methods: `info`, `warn`, `error`, `debug`
     - Auto-include `tenant_id` and `user_id` from context if available
     - Dev: pretty-print to console; Prod: send to Axiom
   - Schema: `{ timestamp, level, tenant_id, user_id, action, duration_ms, ... }`

4. **Unified module** at `src/lib/observability/index.ts`:

   ```typescript
   export { logger } from './logger';
   export { track } from './posthog';
   export { setSentryTenantContext } from './sentry';
   export { reportError } from './errors';
   ```

   `reportError(err, context)` fires to all 3.

5. **Test endpoint** at `src/app/api/_observability-test/route.ts` (dev-only — guard with `NEXT_PUBLIC_ENV !== 'production'`):
   - On GET: throws an error → Sentry catches it
   - Logs an info message → Axiom shows it
   - Tracks an event → PostHog shows it

6. **Privacy:**
   - PostHog: respect Do-Not-Track header
   - Sentry: scrub PII via `beforeSend`
   - Add a privacy notice toggle (placeholder)

7. Update `next.config.js` to wrap with Sentry's `withSentryConfig`.

Do NOT:

- Enable Session Replay.
- Track PII (names, phones, addresses).
- Send raw error messages with user data to Sentry.
- Use multiple loggers (Pino, Winston).

### Validation

- [ ] `pnpm dev` runs without observability errors
- [ ] Hit `/api/_observability-test` (dev mode):
  - [ ] Sentry web UI shows the error
  - [ ] Axiom dashboard shows the log entry
  - [ ] PostHog dashboard shows the event
- [ ] `pnpm build` succeeds with all 3 SDKs configured
- [ ] No PII appears in any captured event (verify by inspecting one event from each service)

### Commit

`feat(observability): wire up Sentry, PostHog, Axiom`

### Branch

`feat/phase-0-week-1-task-5`

---

## Task 6 — Inngest + Echo Cron

### Context to load

- `ARCHITECTURE.md` §10 (Background Jobs)
- `docs/adr/0006-inngest-jobs.md`

### Prompt for Claude Code

Set up Inngest with one cron echo function as proof of life.

Requirements:

1. Install Inngest:
   - `pnpm add inngest`
   - `pnpm add -D inngest-cli`

2. Create the Inngest client at `inngest/client.ts`:
   - Export `inngest` instance with id `'restaurant-os'`
   - TypeScript event schema:
     ```typescript
     type Events = {
       'sync/tenant.requested': { data: { tenantId: string } };
       'echo/test.fired': { data: { message: string; firedAt: string } };
     };
     ```

3. Create `inngest/functions/echo-cron.ts`:
   - Cron schedule conditional on env:
     ```typescript
     const cron = process.env.NEXT_PUBLIC_ENV === 'production' ? '0 1 * * *' : '*/5 * * * *';
     ```
     (Production = daily 04:00 IST = 01:00 UTC. Dev = every 5 minutes.)
   - The function:
     - `step.run('log-fire', () => logger.info({ action: 'echo.fired', timestamp: new Date().toISOString() }))`
     - Send event `'echo/test.fired'` with the message
     - Return success
   - Retries: 2

4. Create Inngest API route at `src/app/api/inngest/route.ts`:
   - Use `serve` from `inngest/next`
   - Register the echo function
   - Signing key from `INNGEST_SIGNING_KEY`

5. Add scripts to `package.json`:
   - `"inngest:dev": "inngest-cli dev"`
   - The dev server runs separately on port 8288

6. Validation endpoint at `src/app/api/_inngest-test/route.ts` (dev-only):
   - On POST: `inngest.send({ name: 'echo/test.fired', data: { message: 'manual test', firedAt: new Date().toISOString() }})`
   - Return the trigger ID

Do NOT:

- Schedule the prod cron yet — only code it correctly.
- Add real business logic to the echo function.
- Use `setTimeout` or `setInterval` anywhere.

### Validation

- [ ] Run `pnpm dev` and `pnpm inngest:dev` in two terminals
- [ ] Open http://localhost:8288 (Inngest dev UI)
- [ ] `echo-cron` is listed under Functions
- [ ] Wait 5 minutes — the cron fires automatically (verify in Inngest dev UI)
- [ ] POST to `/api/_inngest-test` — manual trigger appears in Inngest dev UI
- [ ] Axiom received the `echo.fired` log
- [ ] No `setTimeout`/`setInterval` introduced anywhere in the codebase

### Commit

`feat(jobs): inngest setup with echo cron`

### Branch

`feat/phase-0-week-1-task-6`

---

## Task 7 — README, CONTRIBUTING, and Final Docs

### Context to load

- Existing repo structure (everything from Tasks 1-6)

### Prompt for Claude Code

Create developer-facing documentation. A new developer should clone the repo, read README, and have a running system within 60 minutes.

Requirements:

1. Create `README.md` at the root (English, for devs):
   - Title and one-line description
   - Status badges: CI status, Node version
   - Table of contents
   - Sections:
     a. **What is this?** — 3 sentences max
     b. **Tech stack** — bullet list pointing to ADRs
     c. **Prerequisites** — Node 20, pnpm 9, Docker, Supabase CLI
     d. **Quick start** — 8 commands max from clone to running
     e. **Project structure** — tree of top-level directories with one-line descriptions
     f. **Development workflow** — branching, commits, PR process
     g. **Common commands** — table of pnpm scripts with descriptions
     h. **Troubleshooting** — top 5 issues and solutions
     i. **Documentation** — links to `ARCHITECTURE.md`, `PHASING.md`, `docs/adr/`
     j. **License** — proprietary, all rights reserved
   - Under 250 lines total.

2. Create `CONTRIBUTING.md`:
   - **Branching:** `main` is production. Feature branches: `feat/`, `fix/`, `chore/`, `docs/`.
   - **Commits:** Conventional Commits enforced. Examples.
   - **PR process:** Open PR → CI must pass → 1 review → squash merge.
   - **Code style:** Run `pnpm format` and `pnpm lint --fix` before committing.
   - **Migrations:** Always include rollback comments. Never modify existing migrations.
   - **ADRs:** Required for architectural decisions. Use template in `docs/adr/README.md`.
   - **Testing:** Unit tests for calculators. Integration for adapters. E2E for critical flows.

3. Create `CODE_OF_CONDUCT.md` using Contributor Covenant 2.1 with placeholder contact email.

4. Create `SECURITY.md`:
   - How to report security issues (placeholder email)
   - Supported versions
   - Disclosure timeline

5. Update `package.json`:
   - `"name": "restaurant-os"`
   - `"version": "0.1.0"`
   - `"description": "Restaurant operations OS for the Israeli market"`
   - `"private": true`
   - `"engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" }`

6. Add `CHANGELOG.md` (empty, with header explaining semantic versioning + Keep a Changelog format).

7. Verify all docs link correctly:
   - README links to ARCHITECTURE, PHASING, ADRs, CONTRIBUTING
   - CONTRIBUTING links to ADRs README and ARCHITECTURE
   - ADR README links to ARCHITECTURE for context

Do NOT:

- Write a 1000-line README.
- Duplicate content from `ARCHITECTURE.md` or `PHASING.md` — link to them.
- Add CI badges that don't exist yet.
- Include marketing language.

### Validation

- [ ] `README.md` is under 250 lines
- [ ] All cross-document links resolve (no 404s in markdown links)
- [ ] Following the README's Quick Start on a clean clone, a developer can reach `localhost:3000` in under 60 minutes (estimate during a dry-run; document the actual time)
- [ ] `package.json` engines field is set
- [ ] `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` all exist

### Commit

`docs: add README, CONTRIBUTING, security policies, and changelog`

### Branch

`feat/phase-0-week-1-task-7`

---

## End of Week 1

When Task 7 is committed, Week 1 is done. The orchestration prompt will signal completion. The human will then create the prompts for Week 2 (auth flow, JWT custom claims, MFA, tenant switcher).

---

# Phase 0 · Step 0.2 — Auth Flow, JWT, MFA

> **Goal:** Full authentication system. Users can sign up, log in, reset password, set up MFA, and be placed in the correct tenant context. JWT carries tenant_id and role as custom claims.

---

## Pre-flight check

Before starting any task, run these commands and verify the expected state:

```
git log --oneline -5
ls -la src/
ls -la src/lib/supabase/
cat src/lib/tenant.ts | head -20
```

Expected state:

- `src/lib/supabase/server.ts`, `browser.ts`, `service.ts` exist
- `src/lib/tenant.ts` exists with `requireTenant` function
- `src/lib/permissions.ts` exists
- Supabase is running locally (`pnpm db:start` works)
- Last commit is from Step 0.1

If anything is missing, stop and report before proceeding.

---

## Task 1 — JWT Custom Claims

### Context to load

- `ARCHITECTURE.md` §4 (Multi-Tenancy), §6 (Auth)
- `docs/adr/0001-postgres-rls-multi-tenant.md`
- `src/lib/supabase/` (existing clients)

### Prompt for Claude Code

Add tenant_id and role as custom claims to the Supabase JWT so every authenticated request carries tenant context.

Requirements:

1. Create a Supabase Auth Hook (Database Function) that fires on every token refresh and injects custom claims:
   ```sql
   -- supabase/migrations/{timestamp}_jwt_custom_claims.sql
   CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
   RETURNS jsonb
   LANGUAGE plpgsql STABLE
   AS $$
   DECLARE
     claims jsonb;
     user_tenant_id uuid;
     user_role text;
   BEGIN
     claims := event -> 'claims';

     SELECT m.tenant_id, m.role
     INTO user_tenant_id, user_role
     FROM memberships m
     WHERE m.user_id = (event->>'user_id')::uuid
     LIMIT 1;

     IF user_tenant_id IS NOT NULL THEN
       claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::text));
       claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
     END IF;

     RETURN jsonb_set(event, '{claims}', claims);
   END;
   $$;
   ```
2. Register the hook in `supabase/config.toml`:

   ```toml
   [auth.hook.custom_access_token]
   enabled = true
   uri = "pg-functions://postgres/public/custom_access_token_hook"
   ```

3. Update `src/lib/supabase/server.ts` — add helper `getAuthContext()`:

   ```typescript
   export async function getAuthContext() {
     const supabase = createServerClient();
     const {
       data: { user },
     } = await supabase.auth.getUser();
     if (!user) return null;

     const jwt = await supabase.auth.getSession();
     const claims = jwt.data.session?.access_token
       ? JSON.parse(atob(jwt.data.session.access_token.split('.')[1]))
       : null;

     return {
       userId: user.id,
       email: user.email,
       tenantId: claims?.tenant_id ?? null,
       role: claims?.role ?? null,
     };
   }
   ```

4. Update `src/lib/tenant.ts` — `requireTenant()` now reads from JWT claims first (faster than DB query), falls back to DB.

5. Write pgTAP test: `supabase/tests/jwt_claims.sql`
   - Verify custom claims are present after login
   - Verify tenant_id in claims matches membership

Do NOT:

- Store sensitive data in JWT (no passwords, no PII beyond IDs).
- Use the service role key to read JWT secrets.
- Add claims for users without a membership (return token unchanged).

### Validation

- [ ] `pnpm db:reset` applies the new migration cleanly
- [ ] Log in as `owner@example.com`, decode the JWT (use jwt.io), confirm `tenant_id` and `role` fields are present
- [ ] `pnpm db:test` passes including new JWT tests
- [ ] `getAuthContext()` returns correct tenantId and role in a server component

### Commit

`feat(auth): JWT custom claims with tenant_id and role`

### Branch

`feat/phase-0-step-2-task-1`

---

## Task 2 — Auth Pages UI

### Context to load

- `ARCHITECTURE.md` §17 (Frontend)
- `docs/adr/0003-pwa-not-native.md`
- Existing `src/app/(auth)/` directory

### Prompt for Claude Code

Build the authentication pages: login, signup, password reset. Hebrew RTL, clean design.

Requirements:

1. Install auth dependencies:
   - `@supabase/ssr` (if not already installed from Step 0.1)

2. Create `src/app/(auth)/layout.tsx`:
   - Centered card layout, max-width 400px
   - Restaurant OS logo placeholder (text-based for now)
   - RTL Hebrew by default
   - No sidebar, no topbar

3. Create `src/app/(auth)/login/page.tsx`:
   - Fields: email, password
   - "התחבר" button (primary)
   - Link to signup: "אין לך חשבון? הירשם"
   - Link to password reset: "שכחת סיסמה?"
   - Error states in Hebrew: "אימייל או סיסמה שגויים", "נדרש מייל תקין"
   - On success: redirect to `/` (home)
   - Use React Hook Form + Zod for validation
   - Loading state on button during submission

4. Create `src/app/(auth)/signup/page.tsx`:
   - Fields: email, password, confirm password, full name
   - "הירשם" button
   - On success: redirect to `/onboarding` (placeholder route for now)
   - Validation in Hebrew

5. Create `src/app/(auth)/reset-password/page.tsx`:
   - Step 1: email input → send reset link
   - Step 2: new password + confirm (when user arrives with token)
   - Hebrew copy throughout

6. Create `src/middleware.ts`:
   - Protect all routes under `/(app)/` — redirect to `/login` if not authenticated
   - Allow public routes: `/login`, `/signup`, `/reset-password`, `/api/inngest`, `/api/_*`
   - Use Supabase Auth middleware helper

7. Create `src/app/(auth)/login/actions.ts` (Server Actions):
   - `loginAction(formData)` — calls `supabase.auth.signInWithPassword`
   - `signupAction(formData)` — calls `supabase.auth.signUp`
   - `resetPasswordAction(formData)` — calls `supabase.auth.resetPasswordForEmail`

Do NOT:

- Use client-side only auth. All auth actions must be Server Actions.
- Store session in localStorage. Supabase SSR uses cookies only.
- Show technical error messages to users. Map all errors to Hebrew copy.
- Add social login (Google, GitHub) — not in V1.

### Validation

- [ ] `/login` renders correctly in RTL with Hebrew labels
- [ ] Login with `owner@example.com` / `password123` (seed data) succeeds and redirects to `/`
- [ ] Login with wrong password shows Hebrew error message
- [ ] Accessing `/(app)/` when logged out redirects to `/login`
- [ ] Middleware does NOT block `/api/inngest` or `/api/_observability-test`

### Commit

`feat(auth): login, signup, password reset pages with RTL Hebrew`

### Branch

`feat/phase-0-step-2-task-2`

---

## Task 3 — MFA Setup Flow

### Context to load

- `ARCHITECTURE.md` §6.3 (MFA)
- `src/app/(auth)/` (existing pages)

### Prompt for Claude Code

Add TOTP-based MFA setup and enforcement for owner and manager roles.

Requirements:

1. Create `src/app/(app)/settings/security/page.tsx`:
   - Show MFA status: enabled / not enabled
   - If not enabled: "הפעל אימות דו-שלבי" button
   - If enabled: "בטל אימות דו-שלבי" button (with confirmation)

2. Create MFA enrollment flow at `src/app/(auth)/mfa/setup/page.tsx`:
   - Call `supabase.auth.mfa.enroll({ factorType: 'totp' })`
   - Display QR code for scanning with authenticator app
   - Show manual entry code below QR
   - Input field for 6-digit verification code
   - "אמת ופעל" button
   - On success: redirect to home

3. Create MFA challenge page at `src/app/(auth)/mfa/challenge/page.tsx`:
   - Shown after login if user has MFA enabled
   - 6-digit code input
   - "אמת" button
   - Error: "קוד שגוי. נסה שוב."

4. Update `src/middleware.ts`:
   - After auth check: if user has MFA factor enrolled but not verified in this session → redirect to `/mfa/challenge`
   - If user is `owner` or `manager` and MFA not enrolled → redirect to `/mfa/setup` (soft enforcement: show banner first, hard redirect after 7 days — implement the banner only for now)

5. Create MFA server actions in `src/app/(auth)/mfa/actions.ts`:
   - `enrollMFAAction()` — initiates enrollment, returns QR data
   - `verifyMFAAction(code)` — verifies and activates
   - `challengeMFAAction(code)` — verifies session challenge

6. Add MFA status indicator in settings page.

Do NOT:

- Implement SMS MFA. TOTP only.
- Force hard redirect to MFA setup in this step (banner only).
- Build the full settings page — only the security tab.

### Validation

- [ ] Log in as `owner@example.com`, go to `/settings/security`, see MFA setup option
- [ ] Complete MFA enrollment with a real authenticator app (Google Authenticator)
- [ ] Log out and log back in — MFA challenge page appears
- [ ] Correct code passes, wrong code shows Hebrew error
- [ ] Middleware correctly redirects MFA-enrolled users to challenge page

### Commit

`feat(auth): TOTP MFA enrollment and challenge flow`

### Branch

`feat/phase-0-step-2-task-3`

---

## Task 4 — Membership Management

### Context to load

- `ARCHITECTURE.md` §4, §6
- `src/lib/permissions.ts`
- `src/lib/tenant.ts`

### Prompt for Claude Code

Build the ability to invite users to a tenant and manage their roles.

Requirements:

1. Create `supabase/migrations/{timestamp}_membership_policies.sql`:
   - Add INSERT policy on `memberships`: only `owner` can add members
   - Add UPDATE policy: only `owner` can change roles
   - Add DELETE policy: only `owner` can remove members (cannot remove self)

2. Create `src/app/(app)/[tenantSlug]/settings/team/page.tsx`:
   - Table of current members: name, email, role, joined date, actions
   - "הזמן חבר צוות" button (owner only)
   - Role badge per member (color-coded: owner=purple, manager=blue, chef=green, staff=gray)
   - Remove member button (owner only, cannot remove self)

3. Create invite flow:
   - Modal: email input + role selector
   - Server Action: `inviteMemberAction({ email, role, tenantSlug })`
     - Check caller is owner
     - Call `supabase.auth.admin.inviteUserByEmail()` with metadata `{ tenantSlug, role }`
     - Create pending membership record
   - Invited user receives email, clicks link, completes signup, membership activates

4. Create `src/app/(auth)/accept-invite/page.tsx`:
   - Handles the invite link
   - User sets password
   - Membership is activated
   - Redirect to home

5. Update `src/lib/tenant.ts`:
   - Add `getUserRole(tenantId, userId)` helper
   - Add `assertRole(ctx, ...allowedRoles)` — throws if caller's role not in list

6. Add role-based UI guards:
   - `<IfRole roles={['owner', 'manager']}>` component that conditionally renders children
   - Use in team settings to hide admin actions from non-owners

Do NOT:

- Allow a user to change their own role.
- Allow removing the last owner of a tenant.
- Send invite emails in dev — Supabase local uses Inbucket (http://localhost:54324).

### Validation

- [ ] Owner can see team settings page
- [ ] Manager cannot see "הזמן" or "הסר" buttons (UI guards work)
- [ ] Invite flow works end-to-end in local (use Inbucket at localhost:54324 to receive email)
- [ ] `assertRole` throws correctly when called with wrong role
- [ ] Cannot remove last owner (error state shown)

### Commit

`feat(auth): membership management with invite flow and role guards`

### Branch

`feat/phase-0-step-2-task-4`

---

## End of Step 0.2

When Task 4 is committed, Step 0.2 is complete. Read `TIMELINE.md` — the next step is 0.3. Check if `PHASE-0-STEP-3-PROMPTS.md` exists in the repo root. If it does, load it and begin. If it does not, stop and wait for Elad.

---

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
