# Contributing to Restaurant OS

## Branching

`main` is the production branch — never commit directly to it.

| Prefix   | Use for               |
| -------- | --------------------- |
| `feat/`  | New features          |
| `fix/`   | Bug fixes             |
| `chore/` | Tooling, deps, config |
| `docs/`  | Documentation only    |

Example: `feat/phase-1-menu-management`

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) are enforced via commitlint.

```
<type>(<scope>): <short summary>
```

Examples:

```
feat(menu): add dish creation API
fix(rls): restrict tenant SELECT policy to members only
chore: upgrade Next.js to 15.4
docs(adr): add ADR-0011 for payment gateway
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`.

## PR process

1. Open a PR against `main` with a descriptive title.
2. Fill in the PR template (summary, changes, testing, checklist).
3. CI must pass: lint, typecheck, build, db-test.
4. At least 1 review approval required.
5. Squash-merge — keep `main` history linear.

## Code style

Run before committing (the pre-commit hook does this automatically):

```bash
pnpm format     # Prettier
pnpm lint       # ESLint
pnpm typecheck  # TypeScript
```

TypeScript strict mode is enabled. No `any`, no `@ts-ignore` without a comment explaining why.

## Migrations

- Create with `pnpm db:diff <descriptive-name>` — never write migrations by hand.
- Never edit an existing migration file. Create a new one instead.
- Always include a rollback comment at the top of the migration:
  ```sql
  -- Rollback: DROP TABLE public.your_table;
  ```
- Every new table must have RLS enabled and at least a SELECT policy.
- Run `pnpm db:types` after any schema change.

## ADRs

An ADR is required for any architectural decision (new dependency, new pattern, changing an existing decision). Use the template in [docs/adr/README.md](docs/adr/README.md). See [ARCHITECTURE.md](ARCHITECTURE.md) for context.

## Testing

| Type        | When                        | Tool           |
| ----------- | --------------------------- | -------------- |
| Unit        | Calculators, pure functions | Vitest         |
| Integration | Adapters, DB helpers        | pgTAP / Vitest |
| E2E         | Critical user flows         | Playwright     |

Always add tests for new business logic. PRs without tests for new features will not be merged.
