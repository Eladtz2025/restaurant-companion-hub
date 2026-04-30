# Restaurant OS

[![CI](https://github.com/eladtz2025/restaurant-companion-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/eladtz2025/restaurant-companion-hub/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## Table of Contents

- [What is this?](#what-is-this)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [Common commands](#common-commands)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [License](#license)

---

## What is this?

Restaurant OS is a multi-tenant SaaS platform for Israeli restaurants. It handles operations: prep sheets, inventory, menu management, financial tracking, and AI-assisted workflows. Built for the Israeli market with full Hebrew RTL support.

## Tech stack

| Layer           | Technology                         | Decision                                               |
| --------------- | ---------------------------------- | ------------------------------------------------------ |
| Frontend        | Next.js 15, React 19, Tailwind v4  | —                                                      |
| Backend         | Supabase (Postgres, Auth, Storage) | [ADR-0002](docs/adr/0002-supabase-platform.md)         |
| Multi-tenancy   | Postgres RLS                       | [ADR-0001](docs/adr/0001-postgres-rls-multi-tenant.md) |
| Mobile          | PWA                                | [ADR-0003](docs/adr/0003-pwa-not-native.md)            |
| LLM             | Claude + Gemini OCR                | [ADR-0004](docs/adr/0004-claude-primary-llm.md)        |
| Scraping        | Playwright                         | [ADR-0005](docs/adr/0005-playwright-scraping.md)       |
| Background jobs | Inngest                            | [ADR-0006](docs/adr/0006-inngest-jobs.md)              |
| Architecture    | Modular monolith                   | [ADR-0007](docs/adr/0007-monolith-architecture.md)     |

## Prerequisites

- **Node.js** ≥ 20 — use [nvm](https://github.com/nvm-sh/nvm): `nvm use`
- **pnpm** ≥ 9 — `npm install -g pnpm`
- **Docker** — required for local Supabase
- **Supabase CLI** — installed via `pnpm db:start` (bundled in devDependencies)

## Quick start

```bash
# 1. Clone and enter the repo
git clone https://github.com/eladtz2025/restaurant-companion-hub.git
cd restaurant-companion-hub

# 2. Use the right Node version
nvm use

# 3. Install dependencies
pnpm install

# 4. Copy environment variables and fill them in
cp .env.example .env.local

# 5. Start the local database
pnpm db:start

# 6. Apply migrations and seed data
pnpm db:reset

# 7. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Supabase Studio is at [http://localhost:54323](http://localhost:54323).

## Project structure

```
.
├── docs/adr/              # Architecture Decision Records
├── inngest/               # Inngest client + background functions
│   └── functions/
├── src/
│   ├── adapters/          # External integration adapters (Tabit, OnTopo, …)
│   ├── app/               # Next.js App Router pages and API routes
│   │   ├── (app)/         # Authenticated app shell
│   │   ├── (auth)/        # Login / signup pages
│   │   └── api/           # API routes (Inngest, Supabase webhooks, …)
│   ├── components/
│   │   ├── features/      # Domain-specific components
│   │   ├── shared/        # Cross-domain reusable components
│   │   └── ui/            # shadcn/ui primitives
│   ├── lib/
│   │   ├── ai/            # AI Gateway client
│   │   ├── observability/ # Sentry, PostHog, Axiom
│   │   ├── supabase/      # Typed Supabase clients
│   │   ├── permissions.ts # Role-based permission helpers
│   │   └── tenant.ts      # requireTenant() helper
│   └── prompts/           # LLM prompt templates
├── supabase/
│   ├── migrations/        # Postgres migrations (never edit existing ones)
│   ├── seed.sql           # Local dev seed data
│   └── tests/             # pgTAP tests
└── tests/                 # E2E and integration tests (Playwright)
```

## Development workflow

- **Branching:** `main` is production. Feature branches use `feat/`, `fix/`, `chore/`, `docs/` prefixes.
- **Commits:** Conventional Commits enforced via commitlint. See [CONTRIBUTING.md](CONTRIBUTING.md).
- **PRs:** CI must pass (lint, typecheck, build, db-test) and require 1 review before merge.
- **Migrations:** Create with `pnpm db:diff <name>`. Never edit existing migration files.
- **Types:** After schema changes, run `pnpm db:types` to regenerate `database.types.ts`.

## Common commands

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `pnpm dev`            | Start Next.js dev server                   |
| `pnpm build`          | Production build                           |
| `pnpm lint`           | ESLint                                     |
| `pnpm typecheck`      | TypeScript check (`tsc --noEmit`)          |
| `pnpm format`         | Prettier write                             |
| `pnpm format:check`   | Prettier check (used in CI)                |
| `pnpm db:start`       | Start local Supabase (Docker)              |
| `pnpm db:stop`        | Stop local Supabase                        |
| `pnpm db:reset`       | Apply migrations + seed                    |
| `pnpm db:diff <name>` | Generate new migration from schema changes |
| `pnpm db:test`        | Run pgTAP tests                            |
| `pnpm db:types`       | Regenerate TypeScript types from DB schema |
| `pnpm inngest:dev`    | Start Inngest dev server (port 8288)       |

## Troubleshooting

**Docker not running** — `pnpm db:start` fails with "Cannot connect to Docker daemon". Start Docker Desktop and retry.

**Port 54321 already in use** — Another Supabase project is running. Run `pnpm db:stop` first, or change ports in `supabase/config.toml`.

**`pnpm install` fails with lockfile mismatch** — Run `pnpm install --no-frozen-lockfile` once, commit the updated lockfile.

**TypeScript errors after `pnpm db:reset`** — Regenerate types: `pnpm db:types`.

**Inngest functions not appearing at localhost:8288** — Make sure `pnpm dev` is also running. Inngest dev server proxies to the Next.js app.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and design principles
- [PHASING.md](PHASING.md) — Product roadmap and phase breakdown
- [docs/adr/](docs/adr/) — All Architecture Decision Records
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute

## License

Proprietary — all rights reserved. © 2026 Elad. Unauthorized copying, distribution, or use is strictly prohibited.
