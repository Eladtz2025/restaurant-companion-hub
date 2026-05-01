# Restaurant OS — Timeline

> **Purpose:** Single view of who builds what, in what order. Companion to `PHASING.md` (detailed deliverables) and `ARCHITECTURE.md` (decisions).
>
> **Update cadence:** Status column updated at end of each step. Only status moves — everything else is stable.

---

## How to use this file

- **Status column** — your current position in the build. Update as you go.
- **Prompt source** — file containing the orchestration prompts for that step. Some don't exist yet; they're created at the end of the prior step.
- **Builder** — Claude Code (CC), Lovable (LV), or both. See `docs/adr/0010-lovable-claude-code-workflow.md` for division rules.
- **When in doubt** — read `PHASING.md` for the full deliverable list; this file is the index, not the spec.

---

## Status legend

- ⬜ Not started
- 🟦 In progress
- ✅ Done
- 🟥 Blocked

---

## Phase 0 · Foundations

| Step | Theme                                                                | Builder | Prompt source        | Status |
| ---- | -------------------------------------------------------------------- | ------- | -------------------- | ------ |
| 0.1  | Bootstrap, Code Quality, Schema, CI, Observability, Inngest, Docs    | CC      | `PHASE-0-PROMPTS.md` | ✅     |
| 0.2  | Auth flow, JWT custom claims, Memberships, MFA setup                 | CC      | `PHASE-0-PROMPTS.md` | ⬜     |
| 0.3  | App Shell (sidebar, topbar, tenant switcher), PWA, shadcn RTL-tested | CC + LV | `PHASE-0-PROMPTS.md` | ⬜     |

**Definition of Done:** New developer onboards in ≤ 50 min. Two test tenants, can switch between them. RLS verified by pgTAP. Sentry/PostHog/Axiom + Inngest fire from real flows.

---

## Phase 1 · Core Data — Menu, Recipes, Theoretical Food Cost

| Step | Theme                                                                                                                                            | Builder | Prompt source        | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | -------------------- | ------ |
| 1.1  | Schema + APIs: `menu_items`, `ingredients`, `recipes`, `recipe_components`. Server Actions. Audit triggers. Recipe cost calculator + unit tests. | CC      | `PHASE-1-PROMPTS.md` | ⬜     |
| 1.2  | Ingredients UI — table, search, filter, create/edit form, CSV import                                                                             | LV + CC | `PHASE-1-PROMPTS.md` | ⬜     |
| 1.3  | Recipes UI part 1 — list, BOM editor (ingredient + sub-recipe), live cost                                                                        | LV + CC | `PHASE-1-PROMPTS.md` | ⬜     |
| 1.4  | Recipes UI part 2 — versions, instructions markdown, video embed, image upload                                                                   | LV + CC | `PHASE-1-PROMPTS.md` | ⬜     |
| 1.5  | Menu management UI, FC report page, AI assistant for recipe drafting                                                                             | LV + CC | `PHASE-1-PROMPTS.md` | ⬜     |

**Definition of Done:** 50 menu items + 200 ingredients enterable in one workday. Each menu item shows accurate theoretical FC with ingredient drill-down. AI suggests sane BOM for new dishes ≥ 70% accuracy by chef judgment.

---

## Phase 2 · Daily Operations — Prep + Checklists

| Step | Theme                                                                                     | Builder | Prompt source        | Status |
| ---- | ----------------------------------------------------------------------------------------- | ------- | -------------------- | ------ |
| 2.1  | `prep_tasks` schema. Prep list page. Station toggle. Recipe drawer on tap.                | LV + CC | `PHASE-2-PROMPTS.md` | ⬜     |
| 2.2  | `SimpleAverageProvider` (4-step moving avg). Daily Inngest prep job. Manager override UI. | CC + LV | `PHASE-2-PROMPTS.md` | ⬜     |
| 2.3  | Checklists — schema, templates, daily completion, digital signature (canvas → Storage).   | LV + CC | `PHASE-2-PROMPTS.md` | ⬜     |
| 2.4  | Home dashboard per role (owner, manager, chef, staff). Realtime subscriptions.            | LV + CC | `PHASE-2-PROMPTS.md` | ⬜     |
| 2.5  | UAT with real chef. UX fixes. Performance audit. Mobile validation. First E2E test.       | CC + LV | `PHASE-2-PROMPTS.md` | ⬜     |

**Definition of Done:** Chef uses system every morning unaided after one 10-minute walkthrough. Manager closes shift with digital signature, all stored. Real-time dashboard updates work.

---

## Phase 3 · Inventory + Counts + Waste + Daily FC

| Step | Theme                                                                                                              | Builder | Prompt source               | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------- | ------ |
| 3.1  | `inventory_snapshots`, `waste_events` schema. Inventory count UI (mobile-first). Auto-save per row.                | LV + CC | `PHASE-3-PROMPTS.md`        | ⬜     |
| 3.2  | Snapshot calculator (qty_expected). Variance table. "Mark as waste" action.                                        | CC + LV | `PHASE-3-STEP-2-PROMPTS.md` | ⬜     |
| 3.3  | Waste tracking — fast entry, reason picklist, AI anomaly detection (Haiku). Weekly waste report.                   | LV + CC | `PHASE-3-STEP-3-PROMPTS.md` | ⬜     |
| 3.4  | Manual goods receipts. Schema for `goods_receipts`, `goods_receipt_lines`, `suppliers`. Cost-per-unit auto-update. | CC + LV | `PHASE-3-STEP-4-PROMPTS.md` | ⬜     |
| 3.5  | FC engine — Stage A (theoretical). Daily Inngest job. 30-day trend chart. Target alerts.                           | CC + LV | `PHASE-3-STEP-5-PROMPTS.md` | ⬜     |

**Definition of Done:** Weekly count of 80 ingredients takes < 30 min. Waste reported in seconds. Daily theoretical FC calculated and displayed against target.

---

## Phase 4 · Tabit + Floor Performance

> ⚠️ **Critical lead time:** Formal API request to Tabit must be sent at Phase 0. By Phase 4 you need either the API, official CSV access, or a scraper ready.

| Step | Theme                                                                                                | Builder | Prompt source               | Status |
| ---- | ---------------------------------------------------------------------------------------------------- | ------- | --------------------------- | ------ |
| 4.1  | Tabit adapter (API or CSV or scrape per `tenant_integrations`). Sales schema. POS adapter interface. | CC      | `PHASE-4-PROMPTS.md`        | ⬜     |
| 4.2  | Daily sync via Inngest. Hourly health check. `/settings/integrations` UI with status + manual retry. | CC + LV | `PHASE-4-STEP-2-PROMPTS.md` | ⬜     |
| 4.3  | Floor performance page. Server table, conversion %, 30-day trends, drill-down.                       | LV + CC | `PHASE-4-STEP-3-PROMPTS.md` | ⬜     |
| 4.4  | AI daily brief. Manager approval flow. Weekly competition leaderboard.                               | CC + LV | `PHASE-4-STEP-4-PROMPTS.md` | ⬜     |
| 4.5  | FC daily based on real Tabit sales. Reconciliation vs Tabit < 1%. UAT.                               | CC      | `PHASE-4-STEP-5-PROMPTS.md` | ⬜     |

**Definition of Done:** Yesterday's sales in by 09:00 daily. Manager approves AI brief in 5 min. Reliable Tabit sync ≥ 99% per month.

---

## Phase 5 · AI Document Editor + SOPs

| Step | Theme                                                                                       | Builder | Prompt source               | Status |
| ---- | ------------------------------------------------------------------------------------------- | ------- | --------------------------- | ------ |
| 5.1  | `documents`, `document_versions`, `document_signatures`. Unified PDF template (Heebo, RTL). | CC      | `PHASE-5-PROMPTS.md`        | ⬜     |
| 5.2  | AI Editor UX — chat panel, "Ask AI" button per doc, diff view, approve/reject.              | LV + CC | `PHASE-5-STEP-2-PROMPTS.md` | ⬜     |
| 5.3  | AI Editor backend — `document.edit` task in AI Gateway, prompt engineering, rate limit.     | CC      | `PHASE-5-STEP-3-PROMPTS.md` | ⬜     |
| 5.4  | SOPs library. Version → re-signature flow. Cross-staff sign-on prompt.                      | LV + CC | `PHASE-5-STEP-4-PROMPTS.md` | ⬜     |
| 5.5  | Floor training docs library. Employee file (basic). Role-linked training.                   | LV + CC | `PHASE-5-STEP-5-PROMPTS.md` | ⬜     |

**Definition of Done:** Manager creates SOP in 15 min via AI. 100% staff signs new version within a week. AI never breaks Hebrew RTL formatting.

---

## Phase 6 · Sumit + OCR + Financial Dashboard

| Step | Theme                                                                                            | Builder | Prompt source               | Status |
| ---- | ------------------------------------------------------------------------------------------------ | ------- | --------------------------- | ------ |
| 6.1  | Sumit adapter (API). Schema: `expenses`, `payroll_summaries`, `tax_reports`. Daily sync.         | CC      | `PHASE-6-PROMPTS.md`        | ⬜     |
| 6.2  | OCR pipeline — Inngest job, Gemini 2.5 Pro with strict schema, fuzzy match, manager approval UI. | CC + LV | `PHASE-6-STEP-2-PROMPTS.md` | ⬜     |
| 6.3  | Financial dashboard — P&L, KPI cards, 30/60/90 trends, YoY comparison.                           | LV + CC | `PHASE-6-STEP-3-PROMPTS.md` | ⬜     |
| 6.4  | Manual expense tagging. AI categorization suggestions (Haiku). Drill-down. PDF export.           | LV + CC | `PHASE-6-STEP-4-PROMPTS.md` | ⬜     |
| 6.5  | "Close month" wizard. Anomaly detection (Opus). Reconciliation with bookkeeper.                  | CC      | `PHASE-6-STEP-5-PROMPTS.md` | ⬜     |

**Definition of Done:** All month invoices in dashboard within 24h. OCR ≥ 85% accuracy on Hebrew invoices. Owner closes month in 30 min. Numbers match bookkeeping ≤ 0.5% drift.

---

## Phase 7 · Marketman + Actual FC + Statistical Forecast

> 🔥 **Most critical phase for commercial success.** Food Cost accuracy decides if the product sells or not.

| Step | Theme                                                                                                                 | Builder | Prompt source               | Status |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------- | ------ |
| 7.1  | Marketman adapter (API). Sync inventory levels + purchase orders.                                                     | CC      | `PHASE-7-PROMPTS.md`        | ⬜     |
| 7.2  | Actual FC engine. Theoretical vs actual. Shrinkage calculation. Drill-down. AI insight (Sonnet).                      | CC + LV | `PHASE-7-STEP-2-PROMPTS.md` | ⬜     |
| 7.3  | `StatisticalForecastProvider` — weighted MA, std dev, Z-score, holiday calendar (IL), seasonality, outlier detection. | CC      | `PHASE-7-STEP-3-PROMPTS.md` | ⬜     |
| 7.4  | Forecast UI — 7-day view, color coding, drill-down. Replaces `SimpleAverageProvider` in prep.                         | LV + CC | `PHASE-7-STEP-4-PROMPTS.md` | ⬜     |
| 7.5  | Accuracy validation. Tuning. User documentation.                                                                      | CC      | `PHASE-7-STEP-5-PROMPTS.md` | ⬜     |

**Definition of Done:** Actual FC verified across 3 consecutive weekly counts. Shrinkage actionable. Forecast MAPE < 20% on 30 days post-launch.

---

## Phase 8 · OnTopo + Followup + Events

> ⚠️ **Critical lead time:** Formal API request to OnTopo must be sent at Phase 0.

| Step | Theme                                                                                                              | Builder | Prompt source               | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------- | ------ |
| 8.1  | OnTopo adapter (API or scrape). `customer_visits`, `customer_events`, `customers`.                                 | CC      | `PHASE-8-PROMPTS.md`        | ⬜     |
| 8.2  | Followup AI drafts (Sonnet). UI: last 3 days' visits, draft per visit, approve/edit/skip. **Not auto-sent in V1.** | LV + CC | `PHASE-8-STEP-2-PROMPTS.md` | ⬜     |
| 8.3  | Event menus & quotes. Wizard, AI parsing of free-form input, auto FC, public quote link.                           | LV + CC | `PHASE-8-STEP-3-PROMPTS.md` | ⬜     |
| 8.4  | Polish, bug bash, PDF render cross-browser, end-to-end with Tabit + OnTopo.                                        | CC + LV | `PHASE-8-STEP-4-PROMPTS.md` | ⬜     |

**Definition of Done:** AI proposes followup for 95% of visits, manager approves 80% with light editing. Event quote produced in 15 min including customer-facing link.

---

## Phase 9 · Pilot in Restaurant

| Step | Theme                                                                                  | Builder     | Prompt source               | Status |
| ---- | -------------------------------------------------------------------------------------- | ----------- | --------------------------- | ------ |
| 9.1  | Onboarding wizard — 10 steps from blank tenant to go-live.                             | LV + CC     | `PHASE-9-PROMPTS.md`        | ⬜     |
| 9.2  | Real data load — full menu, ingredients, integrations live, 20+ users.                 | Manual + CC | `PHASE-9-STEP-2-PROMPTS.md` | ⬜     |
| 9.3  | Production usage — parallel to existing process, then system primary. Daily bug fixes. | CC + LV     | `PHASE-9-STEP-3-PROMPTS.md` | ⬜     |
| 9.4  | Performance audit, load testing, DB indexes, cache strategy, backup drill.             | CC          | `PHASE-9-STEP-4-PROMPTS.md` | ⬜     |
| 9.5  | User docs (PDF + video). FAQ. Runbook.                                                 | CC          | `PHASE-9-STEP-5-PROMPTS.md` | ⬜     |

**Definition of Done:** 90% of daily ops in the system. No new bug reports for 7 consecutive days. Owner: "I'm not going back." Uptime ≥ 99.5% / 30 days.

---

## Phase 10 · SaaS Productization

| Step | Theme                     | Builder | Prompt source | Status |
| ---- | ------------------------- | ------- | ------------- | ------ |
| 10.1 | Self-service onboarding   | LV + CC | TBD           | ⬜     |
| 10.2 | Stripe billing            | CC      | TBD           | ⬜     |
| 10.3 | Customer Success tooling  | CC + LV | TBD           | ⬜     |
| 10.4 | Marketing site + content  | LV + CC | TBD           | ⬜     |
| 10.5 | First 10 paying customers | Manual  | TBD           | ⬜     |

**Definition of Done:** 10 paying customers, MRR > $5K, churn < 10%/month, NPS > 40.

---

## When to ask Elad for input

Claude Code proceeds independently within a step's prompts. Stop and ask only when:

1. **Step complete** — tasks done, need next step's prompts file.
2. **Validation fails twice** on the same task after retry.
3. **Architecture conflict** — task contradicts `ARCHITECTURE.md` or an ADR.
4. **Destructive operation** — wipes data, drops tables, force-pushes, or rewrites git history.
5. **External dependency missing** — required API key or account access absent from `.env.local`.
6. **New ADR needed** — an architectural decision must be documented before writing code.

Otherwise, advance.

---

## Critical lead-time items

Must be initiated early — not at phase start:

| Item                                | Initiate at | Needed by  |
| ----------------------------------- | ----------- | ---------- |
| Tabit API request (formal email)    | Phase 0     | Phase 4    |
| OnTopo API request                  | Phase 0     | Phase 8    |
| Sumit API access                    | Phase 4     | Phase 6    |
| Marketman API access                | Phase 6     | Phase 7    |
| Privacy policy + DPA (legal review) | Phase 7     | Phase 9    |
| Stripe account + tax setup          | Phase 8     | Phase 10.2 |
| Trademark + domain registration     | Phase 7     | Phase 10.4 |

---

## Updates log

| Date       | Change           | By            |
| ---------- | ---------------- | ------------- |
| 2026-04-30 | Initial timeline | Elad + Claude |

_(Add a row on phasing changes. Never edit prior rows.)_
