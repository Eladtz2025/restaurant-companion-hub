# Phase 8 — OnTopo + Followup + Events & Quotes

> **Covers:** Steps 8.1–8.4. OnTopo reservation integration, AI followup drafts, event menus and quotes with public link.

> ⚠️ **Before starting:** Confirm OnTopo API status. If API available → use OnTopoApiAdapter. If not → MockReservationsAdapter with ComingSoonBadge.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
```

Expected: Phase 7 complete. Actual FC, statistical forecast, Marketman all working.

---

# Step 8.1 — OnTopo Adapter + Customer Data

## Division of labor

**Claude Code:** adapter, schema, sync job, mock adapter.

## Task 1 — Customer Schema + OnTopo Adapter (Claude Code)

### Context to load

- `ARCHITECTURE.md` §8 (Adapter Pattern)
- `src/adapters/types.ts`
- `docs/adr/0005-playwright-scraping.md`

### Prompt for Claude Code

Create customer/visit schema and OnTopo adapter.

Requirements:

1. Migration `{timestamp}_customers.sql`:

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id TEXT,
  name_he TEXT,
  phone TEXT,
  email TEXT,
  birthday DATE,
  first_visit_date DATE,
  total_visits INT NOT NULL DEFAULT 0,
  total_spend_cents INT NOT NULL DEFAULT 0,
  tags TEXT[],
  notes TEXT,
  gdpr_delete_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);

CREATE TABLE customer_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  external_id TEXT,
  visit_date DATE NOT NULL,
  party_size INT,
  server_id TEXT,
  table_number TEXT,
  spend_cents INT,
  visit_type TEXT CHECK (visit_type IN ('walk-in', 'reservation', 'event', 'private')),
  notes TEXT,
  followup_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);

CREATE TABLE customer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  event_date DATE NOT NULL,
  party_size INT,
  event_type TEXT,
  status TEXT DEFAULT 'pending',
  external_id TEXT
);

-- Indexes
CREATE INDEX idx_visits_tenant_date ON customer_visits(tenant_id, visit_date DESC);
CREATE INDEX idx_visits_followup ON customer_visits(tenant_id, followup_sent_at)
  WHERE followup_sent_at IS NULL;
-- RLS on all tables (SELECT: owner/manager, no staff access to customer PII)
```

2. Create `src/adapters/ontopo/api.ts` — ReservationsAdapter:
   - `fetchVisits({ date })` → visits for a date
   - `fetchUpcomingEvents({ from, to })` → future events
   - `fetchCustomerById(externalId)` → customer details

3. Create `src/adapters/mock/mock-reservations.ts`:
   - 10 visits yesterday, 5 upcoming events
   - Hebrew customer names, realistic data

4. Inngest sync `inngest/functions/sync-ontopo.ts`:
   - Cron: `30 1 * * *` (04:30 IST)
   - Fetch yesterday's visits → upsert
   - Fetch next 7 days events → upsert

5. GDPR compliance `src/lib/actions/gdpr.ts`:
   - `requestCustomerDeletion(tenantId, customerId)` → marks for deletion
   - `processGDPRDeletions()` → Inngest weekly job, deletes marked customers
   - Per ARCHITECTURE.md §15.2

6. Tests: sync idempotent, GDPR deletion clears PII.

### Validation

- [ ] Migration clean
- [ ] Mock adapter returns Hebrew customer data
- [ ] Sync upserts visits
- [ ] GDPR deletion removes PII fields
- [ ] `pnpm test` green

### Commit

`feat(ontopo): customer schema, OnTopo adapter, GDPR compliance`

---

# Step 8.2 — AI Followup Drafts

## Division of labor

**Claude Code:** AI followup generator, Inngest job, Lovable prompt.
**Lovable:** followup UI — list, draft, approve, skip.

## Task 1 — Followup Generator (Claude Code)

### Context to load

- `ARCHITECTURE.md` §7 (AI Gateway)

### Prompt for Claude Code

Build the AI followup system.

Requirements:

1. Create prompt `prompts/followup/v1.md`:

```
אתה מנהל מסעדה ישראלי. כתוב הודעת פולואו-אפ חמה ואישית ללקוח שביקר.

פרטי הביקור:
- שם לקוח: {customer_name}
- תאריך ביקור: {visit_date}
- גודל מסיבה: {party_size}
- סוג ביקור: {visit_type}
- הוצאה: {spend_ils}₪
- הערות המלצר: {server_notes}

כתוב הודעת WhatsApp / SMS קצרה (50-80 מילה) בעברית.
- חמה ואישית, לא גנרית
- אל תבטיח הנחות או הטבות שלא מאושרות
- אל תכתוב שם המסעדה (המשתמש יוסיף)
- אל תשלח ברכות גנריות

החזר JSON: { "message": string, "tone": "warm"|"professional"|"casual", "confidence": "high"|"medium"|"low" }
```

2. Add to AI Gateway:

```typescript
'followup.draft': { model: 'claude-sonnet-4-6', maxTokens: 300, temp: 0.6 },
```

3. Create `src/lib/actions/followup.ts`:
   - `generateFollowupDraft(tenantId, userId, visitId)` → draft message
   - `saveFollowupDraft(tenantId, visitId, message)` → save draft
   - `skipFollowup(tenantId, visitId)` → mark skipped
   - `markFollowupSent(tenantId, visitId)` → **UI only — no auto-send in V1**
   - `getPendingFollowups(tenantId, days?)` → visits needing followup

4. Inngest job `inngest/functions/followup-drafts.ts`:
   - Cron: `0 11 * * *` (14:00 IST)
   - Get yesterday's visits without followup
   - Generate draft per visit (batch, max 20/day to control AI cost)
   - Save drafts

5. Tests: draft generated, skip works, cost ceiling applied.

### Validation

- [ ] Draft generated for test visit
- [ ] AI cost tracked in `ai_calls`
- [ ] Skip marks visit correctly
- [ ] `pnpm test` green

### Commit

`feat(followup): AI followup draft generation with Inngest job`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-8-followup.md`.

Build **`/[tenantSlug]/followup` page**:

1. **Visit list** (last 3 days):
   - Card per visit: customer name, date, party size, spend
   - Draft badge: "✓ טיוטה מוכנה" or "ממתין לטיוטה"
   - Skip badge on skipped

2. **Followup action panel** (per visit):
   - Draft message in textarea (editable)
   - "שפר עם AI" button → regenerate
   - Character count
   - "סמן כנשלח" button (manual — copies to clipboard)
   - "דלג" button
   - Platform buttons: WhatsApp | SMS | Email (copy text only — no auto-send)

3. **Stats row**:
   - "השבוע: 12 פולואו-אפ נשלחו"
   - "ממוצע זמן תגובה: לא זמין"

After Lovable:

1. Wire visit list to `getPendingFollowups`.
2. Wire draft display to saved drafts.
3. Wire "שפר" to `generateFollowupDraft` (new call).
4. Wire "סמן כנשלח" to `markFollowupSent` + copy to clipboard.

### Commit

`feat(followup): followup UI with AI drafts`

---

# Step 8.3 — Event Menus + Quotes

## Division of labor

**Claude Code:** event schema, quote logic, PDF, public link, AI parsing.
**Lovable:** event creation wizard, quote view, public quote page.

## Task 1 — Event Schema + Quote Engine (Claude Code)

### Prompt for Claude Code

Build event quotes system.

Requirements:

1. Migration `{timestamp}_events.sql`:

```sql
CREATE TABLE restaurant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  party_size INT NOT NULL,
  budget_per_person_cents INT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'quote_sent', 'approved', 'declined', 'completed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES restaurant_events(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  items JSONB NOT NULL DEFAULT '[]',  -- [{menuItemId, name_he, priceCents, qty}]
  fc_total_cents INT,
  revenue_total_cents INT,
  fc_percent NUMERIC(5,2),
  valid_until DATE,
  customer_approved_at TIMESTAMPTZ,
  customer_declined_at TIMESTAMPTZ,
  notes_for_customer TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, version)
);
-- RLS: event_quotes readable publicly via public_token (special policy)
```

2. Create `src/lib/actions/events.ts`:
   - `createEvent(tenantId, data)` → new event
   - `createQuote(tenantId, eventId, items[])` → generate quote with FC
   - `generateQuotePDF(tenantId, quoteId)` → PDF via unified template
   - `getPublicQuote(publicToken)` → no auth required (public endpoint)
   - `approveQuoteAsCustomer(publicToken)` → customer approves
   - `getEventsList(tenantId)` → list with status

3. Public route: `src/app/q/[token]/page.tsx` — no auth required:
   - Shows quote details, menu items, pricing
   - "אני מאשר את ההצעה" button
   - "בקש שינויים" textarea + submit

4. Create AI action for parsing free-form event request:

   ```typescript
   // prompt: 'event.parse_request'
   // input: "אנחנו 45 איש, רוצים ארוחת ערב ב-15 לאפריל, בופה עם דגים ובשרות"
   // output: { party_size, event_date, event_type, dietary_notes, budget_hint }
   ```

5. Tests: quote FC calculation, public token access, customer approval.

### Validation

- [ ] Migration clean
- [ ] Public quote accessible at `/q/[token]` without auth
- [ ] Customer approval sets `customer_approved_at`
- [ ] FC calculation correct on quote items
- [ ] `pnpm test` green

### Commit

`feat(events): event quotes with public link and customer approval`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-8-events.md`.

Build:

1. **`/[tenantSlug]/events` page** — event list:
   - Cards: customer/event name, date, party size, status badge
   - "אירוע חדש" button

2. **Event creation wizard** (3 steps):
   - Step 1: Free text input "תאר את האירוע" OR manual fields
   - Step 2: Menu selection (checkbox grid of menu items) + pricing
   - Step 3: Quote preview → "שלח ללקוח" generates PDF + copies public link

3. **`/q/[token]` page** (public, no login):
   - Restaurant name + logo
   - Quote details (menu items, pricing)
   - Notes from restaurant
   - "אני מאשר ✓" and "בקש שינויים" buttons
   - Valid until date

After Lovable:

1. Wire wizard step 1 to AI event parser.
2. Wire menu selection to FC calculation.
3. Wire "שלח ללקוח" to PDF generation + copy public link.
4. Wire public page to `getPublicQuote`.
5. Wire approval buttons to `approveQuoteAsCustomer`.

### Commit

`feat(events): event creation wizard, quote UI, public approval page`

---

# Step 8.4 — Bug Bash + Polish + E2E

## Task 1 — Final Polish (Claude Code)

### Prompt for Claude Code

Complete Phase 8 with E2E tests and final cross-system polish.

Requirements:

1. E2E `tests/e2e/phase8.spec.ts`:
   - OnTopo sync → visit appears in followup list
   - AI draft generated for visit
   - Manager marks as sent → visit removed from pending
   - Create event → wizard completes → quote PDF generated
   - Public link accessible → customer approves → status updates

2. PDF cross-browser: verify quote PDF renders correctly on Windows Chrome and iOS Safari.

3. Verify ComingSoonBadge appears correctly on OnTopo-dependent screens when not connected.

4. Performance: followup page with 20 visits loads < 2s.

5. Final RTL audit: all Phase 8 screens in RTL, Hebrew only.

### Commit

`test(phase8): E2E tests, cross-browser PDF, performance audit`

---

## End of Phase 8

Phase 8 Definition of Done:

- [ ] AI proposes followup for 95% of visits
- [ ] Manager approves 80% with light editing
- [ ] Event quote produced in 15 min
- [ ] Public quote link works for customer approval
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green

Read `TIMELINE.md`. Next is Phase 9 (Pilot). Check if `PHASE-9-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
