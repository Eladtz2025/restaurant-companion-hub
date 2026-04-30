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

## 9. Observability

_TODO: Logs, metrics, error tracking, AI usage dashboard._

## 10. Open Questions

_TODO: Record unresolved architectural questions here so they don't get lost._
