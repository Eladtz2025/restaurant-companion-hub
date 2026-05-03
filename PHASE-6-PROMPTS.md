# Phase 6 — Sumit + OCR + Financial Dashboard

> **Covers:** Steps 6.1–6.5. Sumit accounting integration, OCR invoice pipeline, full P&L dashboard, expense tagging, month close wizard.

> ⚠️ **Before starting:** Confirm Sumit API credentials are in `.env.local` as `SUMIT_API_KEY` and `SUMIT_ORG_ID`. If not available → use MockAccountingAdapter with ComingSoonBadge.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
```

Expected: Phase 5 complete. Documents, SOPs, AI editor all working.

---

# Step 6.1 — Sumit Adapter

## Division of labor

**Claude Code:** adapter, schema, sync job, mock adapter.
**Lovable:** expense management UI.

## Task 1 — Expenses Schema + Sumit Adapter (Claude Code)

### Context to load

- `ARCHITECTURE.md` §8 (Adapter Pattern)
- `src/adapters/types.ts`

### Prompt for Claude Code

Create the accounting schema and Sumit adapter.

Requirements:

1. Migration `{timestamp}_expenses.sql`:

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  category TEXT NOT NULL CHECK (category IN (
    'food', 'beverage', 'labor', 'utilities', 'rent', 'marketing',
    'equipment', 'maintenance', 'taxes', 'other'
  )),
  subcategory TEXT,
  amount_cents INT NOT NULL,
  vat_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  expense_date DATE NOT NULL,
  description_he TEXT,
  invoice_number TEXT,
  receipt_image_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'sumit', 'ocr')),
  sumit_doc_id TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- 'YYYY-MM'
  total_gross_cents INT NOT NULL,
  total_net_cents INT NOT NULL,
  employee_count INT NOT NULL,
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, month)
);

CREATE INDEX idx_expenses_tenant_date ON expenses(tenant_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(tenant_id, category, expense_date);
-- RLS on all tables
```

2. Create `src/adapters/sumit/api.ts` — AccountingAdapter:
   - `fetchInvoices({ from, to })` → map Sumit invoice format to internal `Expense[]`
   - `fetchPayrollSummary(month)` → map to `PayrollSummary`
   - Auth: `Authorization: Bearer {SUMIT_API_KEY}` header
   - Base URL: `https://api.sumit.co.il`

3. Create `src/adapters/mock/mock-accounting.ts` — MockAccountingAdapter:
   - Returns realistic Hebrew expense data (20 expenses, 2 payroll summaries)
   - Category breakdown matching real restaurant ratios (food ~30%, labor ~35%)

4. Create `src/lib/actions/expenses.ts`:
   - `getExpenses(tenantId, from, to, category?)` → filtered list
   - `createExpense(tenantId, data)` → manual entry
   - `categorizeExpense(tenantId, expenseId, category)` → update category
   - `getExpenseSummary(tenantId, from, to)` → total by category
   - `upsertExpenses(tenantId, expenses[])` → bulk from adapter

5. Inngest sync job `inngest/functions/sync-sumit.ts`:
   - Cron: `0 2 * * *` (05:00 IST)
   - Fetch yesterday's invoices from Sumit → upsert expenses
   - Fetch current month payroll → upsert summary

6. Tests `tests/adapters/sumit.test.ts`:
   - Mock HTTP responses → correct expense mapping
   - Duplicate external_id → upsert, no duplicate
   - At least 5 tests

### Validation

- [ ] Migration clean
- [ ] Mock adapter returns plausible data
- [ ] Sync job runs and upserts expenses
- [ ] `pnpm test` green

### Commit

`feat(sumit): expenses schema, Sumit adapter, mock adapter, sync job`

---

# Step 6.2 — OCR Invoice Pipeline

## Task 1 — OCR Pipeline (Claude Code)

### Context to load

- `ARCHITECTURE.md` §13 (OCR pipeline)
- `ARCHITECTURE.md` §7 (AI Gateway — invoice.ocr task)

### Prompt for Claude Code

Build the OCR pipeline for Hebrew invoice photos.

Requirements:

1. Create Inngest job `inngest/functions/ocr-invoice.ts`:

```typescript
export const processInvoiceOCR = inngest.createFunction(
  { id: 'ocr-invoice', retries: 2 },
  { event: 'invoice/uploaded' },
  async ({ event, step }) => {
    const { tenantId, userId, storageUrl } = event.data;

    const ocrResult = await step.run('ocr', () =>
      callAIGateway({
        taskType: 'invoice.ocr',
        input: { imageUrl: storageUrl },
        tenantId,
        userId,
      }),
    );

    const parsed = await step.run('parse', () => parseOCRResult(ocrResult));

    const receipt = await step.run('save', () =>
      createGoodsReceiptFromOCR(tenantId, userId, parsed),
    );

    await step.run('notify', () => notifyManagerForApproval(tenantId, receipt.id));

    return { receiptId: receipt.id, confidence: parsed.confidence };
  },
);
```

2. Create `src/lib/ocr/invoice-parser.ts`:
   - Parse AI Gateway JSON response into `GoodsReceiptDraft`
   - Fuzzy-match ingredient names to DB ingredients
   - Flag unmatched items for manual review
   - Return confidence score

3. Create `src/lib/actions/ocr.ts`:
   - `uploadInvoiceForOCR(tenantId, userId, file)` → upload to Storage, fire Inngest event
   - `getOCRResults(tenantId)` → pending OCR receipts awaiting approval
   - `approveOCRReceipt(tenantId, receiptId, edits?)` → approve with optional corrections

4. Use the OCR prompt from `ARCHITECTURE.md` §13.3 (paste it into `prompts/invoice-ocr/v1.md`).

5. Tests `tests/ocr/`:
   - Parse valid OCR JSON → correct receipt draft
   - Fuzzy match "עגבניה" → finds "עגבניות"
   - Low confidence items flagged
   - At least 6 tests

### Validation

- [ ] Upload invoice image → Inngest job fires
- [ ] OCR result parsed → goods receipt draft created
- [ ] Manager notified for approval
- [ ] `pnpm test` green

### Commit

`feat(ocr): invoice OCR pipeline with Inngest, fuzzy match, approval flow`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-6-ocr.md`.

Build:

1. **`/inventory/receipts/upload` page**:
   - Drag-drop or camera capture (mobile)
   - Upload progress
   - "מעבד עם AI..." loading state
   - Success: redirect to receipt approval page

2. **OCR approval page** (`/inventory/receipts/ocr-review/[id]`):
   - Side-by-side: original image (left) + parsed data (right)
   - Confidence badge per field
   - Edit any field inline
   - Unmatched ingredients highlighted in yellow: "לא זוהה — בחר מרכיב"
   - "אשר קליטה" button
   - "ידני" button → falls back to manual receipt form

After Lovable: wire all to OCR actions.

### Commit

`feat(ocr): OCR upload and approval UI`

---

# Step 6.3 — Financial Dashboard

## Task 1 — P&L Engine (Claude Code)

### Prompt for Claude Code

Build the P&L calculation engine.

Requirements:

1. Create `src/lib/financial/pnl.ts`:

```typescript
export interface PLReport {
  period: { from: Date; to: Date };
  revenue: { total: number; byDay: DailyRevenue[] };
  expenses: {
    total: number;
    byCategory: Record<string, number>;
    food: number;
    labor: number;
    other: number;
  };
  grossProfit: number;
  grossMarginPercent: number;
  fc_percent: number;
  labor_percent: number;
  ebitda_estimate: number;
}

export async function buildPLReport(tenantId: string, from: Date, to: Date): Promise<PLReport>;
```

2. Revenue from `sales` table (or 0 + mock if Tabit not connected).
3. Expenses from `expenses` table.
4. FC from `daily_fc_snapshots`.
5. Labor from `payroll_summaries`.

6. Tests `tests/financial/pnl.test.ts`:
   - Correct gross profit with known data
   - FC% matches daily snapshots
   - At least 6 tests

### Commit

`feat(financial): P&L engine`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-6-financial-dashboard.md`.

Build **`/[tenantSlug]/financial` page**:

1. **KPI row** (4 cards):
   - הכנסות החודש
   - רווח גולמי %
   - Food Cost %
   - עלות עבודה %

2. **P&L chart** (recharts stacked bar):
   - Revenue vs expenses by week
   - 30/60/90 day selector

3. **Expense breakdown** (donut chart):
   - By category with ₪ amounts

4. **YoY comparison** (line chart):
   - This month vs same month last year

5. **Expense list** (table):
   - Date, supplier, category, amount
   - Filter by category
   - "תייג" dropdown per row

6. **ComingSoonBadge** on revenue if Tabit not connected.

After Lovable:

1. Wire all charts to `buildPLReport`.
2. Wire expense list to `getExpenses`.
3. Wire category tag to `categorizeExpense`.

### Commit

`feat(financial): P&L dashboard with charts and expense list`

---

# Step 6.4 — AI Expense Categorization + Month Close

## Task 1 — AI Categorization + Close Wizard (Claude Code)

### Prompt for Claude Code

Build AI expense categorization and month-close wizard.

Requirements:

1. Add to AI Gateway:

```typescript
'expense.categorize_suggestion': { model: 'claude-haiku-4-5', maxTokens: 100, temp: 0.0 },
```

2. Create prompt `prompts/expense-categorize/v1.md`:

```
קבל תיאור הוצאה ממסעדה ישראלית. החזר JSON בלבד:
{ "category": "food"|"beverage"|"labor"|"utilities"|"rent"|"marketing"|"equipment"|"maintenance"|"taxes"|"other", "confidence": "high"|"medium"|"low" }

תיאור: {description}
ספק: {supplier}
```

3. Create `src/lib/actions/ai-expenses.ts`:
   - `suggestExpenseCategory(tenantId, userId, description, supplier)` → category suggestion
   - Auto-suggest on new expense save (only if not already categorized)
   - Only trigger after 30+ expenses exist (to avoid early noise)

4. Create month-close wizard `src/lib/actions/month-close.ts`:
   - Step 1: Check uncategorized expenses → prompt to categorize
   - Step 2: Check missing receipts → list
   - Step 3: Confirm payroll → Sumit sync
   - Step 4: Generate monthly P&L snapshot
   - Step 5: Export PDF report

5. Write Lovable prompt `prompts/lovable/phase-6-month-close.md`:
   - 5-step wizard UI
   - "סגירת חודש" button on financial dashboard (owner only)
   - Progress indicator
   - Each step: list of items to resolve + "המשך" button

### Commit

`feat(financial): AI expense categorization, month-close wizard`

---

# Step 6.5 — Anomaly Detection + Polish

## Task 1 — Anomaly Detection + E2E (Claude Code)

### Prompt for Claude Code

Add financial anomaly detection and complete Phase 6.

Requirements:

1. Add to AI Gateway:

```typescript
'finance.anomaly_detect': { model: 'claude-opus-4-7', maxTokens: 1024, temp: 0.1 },
```

2. Create `inngest/functions/anomaly-detect.ts`:
   - Runs monthly (1st of month, 07:00 IST)
   - Compares this month's expense categories to last 3 months avg
   - Sends to Opus: "האם יש חריגות חשודות?"
   - Creates alert if Opus flags something
   - Expensive — runs once/month only

3. E2E `tests/e2e/phase6.spec.ts`:
   - Upload invoice image → OCR fires → draft receipt created
   - Approve receipt → expense created → ingredient cost updated
   - Financial dashboard shows correct P&L
   - Month-close wizard completes all 5 steps

### Validation

- [ ] OCR → receipt → expense → cost update chain works end-to-end
- [ ] P&L numbers correct with seeded data
- [ ] Month close wizard completes

### Commit

`feat(financial): anomaly detection, Phase 6 E2E tests`

---

## End of Phase 6

Phase 6 Definition of Done:

- [ ] All invoices in dashboard within 24h (Sumit or OCR)
- [ ] OCR ≥ 85% accuracy on test invoices
- [ ] Owner closes month in < 30 min
- [ ] P&L numbers match test data ≤ 0.5% drift
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green

Read `TIMELINE.md`. Next is Phase 7. Check if `PHASE-7-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
