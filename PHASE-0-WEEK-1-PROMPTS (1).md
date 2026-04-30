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
