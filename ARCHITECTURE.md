# Restaurant OS — Architecture

> **Status:** Placeholder — to be filled by Elad / Claude Code.
> Source of truth for the system's high-level architecture.
> ADRs in `docs/adr/` are the authoritative decision log; this document explains how they fit together.

> **Stack note (Lovable runtime):** The ADRs describe Next.js + Vercel as the original target. The Lovable repo runs on **TanStack Start + Cloudflare Workers**. When implementing:
>
> - Use `createServerFn` instead of Next.js API Routes / Server Actions.
> - Use TanStack server routes under `src/routes/api/public/*` for webhooks instead of Supabase Edge Functions.
> - Supabase is connected as an external project (per Elad's decision) via the Supabase Integration.
> - Inngest, Playwright, and other Node-only tooling from ADR-0005/0006 cannot run inside the Worker — host them externally and call them over HTTP.

---

## 1. Overview

_TODO: One-paragraph description of what Restaurant OS is, who uses it, and the core value proposition._

## 2. System Diagram

_TODO: ASCII or Mermaid diagram showing frontend ↔ Supabase ↔ Edge Functions ↔ External integrations ↔ AI Gateway ↔ Inngest._

## 3. Tech Stack

_TODO: List every runtime dependency with the ADR that justifies it._

| Layer            | Technology                          | ADR      |
| ---------------- | ----------------------------------- | -------- |
| Frontend         | TanStack Start (React 19)           | —        |
| Backend platform | Supabase (external)                 | ADR-0002 |
| Multi-tenancy    | Postgres RLS                        | ADR-0001 |
| Mobile           | PWA                                 | ADR-0003 |
| LLM              | Claude (+ Gemini OCR, GPT fallback) | ADR-0004 |
| Scraping         | Playwright                          | ADR-0005 |
| Background jobs  | Inngest                             | ADR-0006 |
| Architecture     | Modular monolith                    | ADR-0007 |
| AI access        | Centralized AI Gateway              | ADR-0008 |
| Integrations     | Adapter pattern                     | ADR-0009 |
| Dev workflow     | Lovable + Claude Code hybrid        | ADR-0010 |

## 4. Domain Structure

_TODO: List the bounded contexts (prep, inventory, menu, financial, events, …) and their responsibilities._

## 5. Data Flow

_TODO: Describe the lifecycle of a typical request: client → auth → server fn → DB / external adapter → response._

## 6. Security Model

_TODO: Auth, JWT custom claims, RLS policy template, service-role key handling, secret storage in Vault._

## 7. AI Gateway

_TODO: Reference ADR-0008. Document task_type routing table, budget enforcement, caching keys, fallback chain._

### 7.4 Routing table

_TODO: Map each `task_type` → primary model → fallback chain._

## 8. External Integrations

_TODO: Reference ADR-0009. List adapters (Tabit, OnTopo, Sumit, Marketman), their mode (api/csv/scrape), and the interface they implement._

### 8.1 Adapter Interfaces

Each integration is implemented as an adapter that satisfies a typed interface:

| Adapter type          | Interface             | Implementations                            |
| --------------------- | --------------------- | ------------------------------------------ |
| POS (Tabit)           | `POSAdapter`          | `TabitAdapter`, `MockPOSAdapter`           |
| Reservations (OnTopo) | `ReservationsAdapter` | `OnTopoAdapter`, `MockReservationsAdapter` |
| Accounting (Sumit)    | `AccountingAdapter`   | `SumitAdapter`, `MockAccountingAdapter`    |
| Inventory (Marketman) | `InventoryAdapter`    | `MarketmanAdapter`, `MockInventoryAdapter` |

### 8.2 Implementation Rules

1. **Build against the interface, not the implementation.** All screens, server actions, and Inngest jobs depend only on the adapter interface. The concrete adapter is injected via `tenant_integrations` config at runtime.

2. **All screens are built against the adapter interface regardless of whether the external API is live.** A `MockAdapter` returns realistic demo data during development. Swapping to a live adapter requires no UI changes.

3. **MockAdapters are never deployed to production.** They are guarded by `process.env.NEXT_PUBLIC_ENV !== 'production'`. Attempting to inject a mock adapter in production throws at startup.

4. **"בקרוב" badge signals mock data.** When a screen is running against a `MockAdapter`, a `<ComingSoonBadge>` is rendered to indicate the data is not live. It disappears automatically when a real adapter is active.

5. **Adapter selection is per-tenant.** A tenant with a Tabit contract uses `TabitAdapter`; a tenant without uses `MockPOSAdapter` until they connect. This means the product works end-to-end for every tenant from day one.

## 9. Observability

_TODO: Logs, metrics, error tracking, AI usage dashboard._

## 10. Open Questions

_TODO: Record unresolved architectural questions here so they don't get lost._
