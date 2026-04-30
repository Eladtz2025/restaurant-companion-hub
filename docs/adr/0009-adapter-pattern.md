# ADR-0009: Adapter Pattern for External Integrations

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

המערכת מתחברת ל-4 ספקים חיצוניים: Tabit (POS), OnTopo (reservations), Sumit (accounting), Marketman (inventory). לכל ספק:

- ייתכן API רשמי, ייתכן רק CSV, ייתכן רק scraping.
- שדות, פורמטים, קונבנציות שונות.
- אופציה להחליף ספק בעתיד (Toast במקום Tabit, וכו').
- בעיות uptime/error rate שונות.

אם הקוד הראשי יודע על כל ספק ספציפית — שינוי ספק = rewrite. אם יש שכבת abstraction נכונה — החלפה היא קונפיגורציה.

## Decision

**Adapter Pattern לכל אינטגרציה חיצונית.** ארבעה interface תלויים בסוג הספק (POS, Reservations, Accounting, Inventory). כל ספק מממש את ה-interface שלו. הקוד הראשי לעולם לא מייבא ישירות מ-`Tabit` או `OnTopo`.

## Consequences

**Positive:**
- **Switchable providers** — Tabit → Toast = החלפת implementation, אותו interface.
- **Testable** — קל לעשות mock implementation לבדיקות.
- **Multiple modes per provider** — Tabit יכול להיות API mode, CSV mode, scrape mode — אותו interface, implementation שונה.
- **Tenant-level configuration** — לקוח A על Tabit, לקוח B על Toast — שניהם עובדים.
- **Type safety** — TypeScript interface אכוף.
- **Consistent error handling** — כל adapter זורק errors באותו פורמט.

**Negative:**
- **Up-front design overhead** — צריך לחשוב על ה-interface לפני שמכירים את כל הספקים.
- **"Lowest common denominator"** — לפעמים feature ייחודי לספק לא מתבטא ב-interface.  
  → Mitigation: אופציה ל-`extras` field ב-response, או metadata-based extensions.
- **Indirection overhead** — שכבה נוספת ב-call stack.

**Neutral:**
- אם יום אחד נחליט להוציא adapters לשירות נפרד — הם כבר מבודדים לוגית.

## Interface Definitions

```typescript
// adapters/types.ts

export interface POSAdapter {
  readonly name: string;
  readonly mode: 'api' | 'csv' | 'scrape';
  
  fetchSales(params: { from: Date; to: Date }): Promise<Sale[]>;
  fetchMenuItems(): Promise<MenuItemExternal[]>;
  fetchServers(): Promise<ServerExternal[]>;
  healthCheck(): Promise<HealthStatus>;
}

export interface ReservationsAdapter {
  readonly name: string;
  readonly mode: 'api' | 'scrape';
  
  fetchVisits(params: { date: Date }): Promise<Visit[]>;
  fetchUpcomingEvents(params: { from: Date; to: Date }): Promise<Event[]>;
  fetchCustomerById(externalId: string): Promise<Customer | null>;
  healthCheck(): Promise<HealthStatus>;
}

export interface AccountingAdapter {
  readonly name: string;
  readonly mode: 'api';
  
  fetchInvoices(params: { from: Date; to: Date }): Promise<Invoice[]>;
  fetchPayrollSummary(month: string): Promise<PayrollSummary>;
  fetchVATReports(year: number): Promise<VATReport[]>;
  healthCheck(): Promise<HealthStatus>;
}

export interface InventoryAdapter {
  readonly name: string;
  readonly mode: 'api';
  
  fetchInventoryLevels(): Promise<InventoryLevel[]>;
  fetchPurchaseOrders(params: { status?: 'open' | 'closed' }): Promise<PurchaseOrder[]>;
  pushReceipt?(receipt: GoodsReceipt): Promise<{ externalId: string }>;
  healthCheck(): Promise<HealthStatus>;
}

export type HealthStatus = 
  | { healthy: true; latencyMs: number }
  | { healthy: false; error: string; lastSuccessAt?: Date };
```

## Folder Structure

```
adapters/
├── types.ts                    # Interfaces
├── factory.ts                  # getAdapter(provider, mode) → instance
├── tabit/
│   ├── api.ts                  # POSAdapter implementation - API mode
│   ├── csv.ts                  # POSAdapter implementation - CSV mode
│   ├── scrape.ts               # POSAdapter implementation - scraping mode
│   ├── normalize.ts            # raw response → internal model
│   ├── types.ts                # Tabit-specific types
│   └── index.ts                # exports
├── ontopo/
│   ├── scrape.ts               # ReservationsAdapter
│   ├── normalize.ts
│   └── index.ts
├── sumit/
│   ├── api.ts                  # AccountingAdapter
│   ├── normalize.ts
│   └── index.ts
└── marketman/
    ├── api.ts                  # InventoryAdapter
    ├── normalize.ts
    └── index.ts
```

## Factory

```typescript
// adapters/factory.ts
import { TabitApiAdapter } from './tabit/api';
import { TabitCsvAdapter } from './tabit/csv';
import { TabitScrapeAdapter } from './tabit/scrape';
// ...

export async function getPOSAdapter(
  tenantId: string,
  config: TenantIntegration
): Promise<POSAdapter> {
  switch (config.provider) {
    case 'tabit':
      switch (config.mode) {
        case 'api':    return new TabitApiAdapter(tenantId, config);
        case 'csv':    return new TabitCsvAdapter(tenantId, config);
        case 'scrape': return new TabitScrapeAdapter(tenantId, config);
      }
      break;
    case 'toast':
      return new ToastApiAdapter(tenantId, config);  // עתידי
    default:
      throw new Error(`Unknown POS provider: ${config.provider}`);
  }
}
```

## Tenant Configuration

```sql
CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  category TEXT NOT NULL,    -- 'pos' | 'reservations' | 'accounting' | 'inventory'
  provider TEXT NOT NULL,    -- 'tabit' | 'ontopo' | 'sumit' | 'marketman' | 'toast' | ...
  mode TEXT NOT NULL,        -- 'api' | 'csv' | 'scrape' | 'manual'
  credentials_vault_key TEXT,
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'inactive',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INT DEFAULT 0,
  UNIQUE (tenant_id, category, provider)
);
```

לקוח יכול לעבור ספק:
1. בעל המסעדה הולך ל-`/settings/integrations`
2. רואה Tabit `active`, מוסיף Toast `inactive`
3. מתחבר ל-Toast (auth flow)
4. מעבר Toast ל-`active`, Tabit ל-`inactive`
5. סנכרון ראשון מ-Toast מתחיל
6. כל הקוד הראשי לא יודע על השינוי

## Normalization Rules

כל adapter מחזיר נתונים בפורמט פנימי משלנו, לא של הספק. התרגום קורה ב-`normalize.ts`:

```typescript
// adapters/tabit/normalize.ts
import type { TabitSaleRaw } from './types';
import type { Sale } from '../types';

export function normalizeTabitSale(raw: TabitSaleRaw): Sale {
  return {
    externalId: raw.OrderId,
    occurredAt: new Date(raw.CloseDateTime),
    tableNumber: raw.TableNumber?.toString(),
    serverExternalId: raw.WaiterCode,
    totalCents: Math.round(raw.GrossTotal * 100),
    items: raw.Items.map(normalizeItem),
    rawPayload: raw,  // נשמר ל-debug
  };
}
```

## Alternatives Considered

1. **קריאה ישירה ל-API של Tabit מהקוד הראשי** — נדחה. לא ניתן להחליף ספק בלי rewrite.
2. **Webhook-only** — נדחה. אין לכל ספק webhook אמין.
3. **iPaaS חיצוני (Zapier, n8n)** — נדחה. תלות בשירות חיצוני, latency, יקר ב-scale.
4. **GraphQL federation לכל ספק** — נדחה. overkill, חוזרים לאותה בעיית abstraction.

## Implementation Rules

1. **Adapter לעולם לא משדר ל-DB ישירות.** הוא מחזיר data, ה-orchestrator (Inngest job) שומר.
2. **Adapter לעולם לא יודע על tenant logic.** רק על איך לקבל data מהספק.
3. **כל adapter כולל `healthCheck()` שעובר אם השירות זמין.**
4. **Normalization fail-safe** — אם field חסר, החזר `null` ו-warning ב-log, אל תזרוק exception.
5. **Rate limiting per provider** — כל adapter יודע מה ה-rate limit שלו ומכבד.

## When to Reconsider

- אם interface הופך מורכב מדי — לפצל ל-sub-interfaces.
- אם נכנס ספק שלא מתאים לאחד מ-4 ה-categories — להוסיף category חדשה.
- אם נצטרך data בריאל-טיים מ-WebSocket — להוסיף `subscribe()` method.

## References

- [Adapter Pattern (GoF)](https://en.wikipedia.org/wiki/Adapter_pattern)
- ARCHITECTURE.md §8 — Integrations layer
- ADR-0005 — Playwright for Scraping
