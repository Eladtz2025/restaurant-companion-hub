# ADR-0006: Inngest for Background Jobs

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

המערכת דורשת לוח זמנים אסינכרוני: סנכרון יומי מאינטגרציות, OCR pipeline, חישובי FC, פולואו אפ events, התראות, ועוד. Vercel serverless שלוקח עד 60 שניות לכל function — לא מספיק לסקרייפינג שיכול לקחת דקות.

אופציות:

1. **`setTimeout` ב-Vercel** — לא יעבוד (function משלמת עליו).
2. **Vercel Cron** — תזמון בסיסי בלבד, אין retries, אין observability.
3. **AWS SQS + Lambda** — עוצמתי, מורכב להגדרה ותחזוקה.
4. **BullMQ + Redis** — דורש Redis מנוהל, complexity של queue management.
5. **Inngest** — workflow engine מנוהל, native ל-serverless.
6. **Trigger.dev** — דומה ל-Inngest, פחות בוגר ב-2026.
7. **Temporal** — עוצמתי מאוד, overkill למוצר בגודל הזה.

## Decision

**Inngest כ-job orchestrator יחיד.** כל cron, queue, retry, ו-event-driven workflow עובר Inngest.

## Consequences

**Positive:**
- API מצוין: `inngest.createFunction({ cron: '...', retries: 3 }, ...)` ב-3 שורות.
- Built-in observability: dashboard, logs, replays.
- Native ל-Next.js: Inngest function = Next API route.
- Fan-out/fan-in patterns פשוטים (`step.run`, `step.parallel`).
- Step-level checkpointing — function שנופלת חוזרת מהצעד שנפל, לא מ-0.
- Retries אוטומטיים עם exponential backoff.
- Dead-letter queue מובנה.
- Free tier נדיב (50K steps/חודש).
- אין infra לתחזק.

**Negative:**
- תלות בספק חיצוני — Inngest down = jobs לא רצים.  
  → Mitigation: Inngest מאוד יציב, גם יש לו queue פנימי שמחזיק jobs.
- מחיר עולה בקנה מידה גדול (אלפי tenants).
- API ייחודי — מפתחים חדשים צריכים ללמוד.
- Local development דורש Inngest Dev Server (binary).

**Neutral:**
- אם נצטרך לעזוב — port ל-Trigger.dev או BullMQ אפשרי, אבל עבודת ימים-שבועות.

## Alternatives Considered

1. **Vercel Cron + custom queue** — נדחה. אין retries מובנים, אין observability, חוסר resilience.
2. **AWS SQS + Lambda** — נדחה. דורש AWS expertise ו-DevOps. יקר תפעולית.
3. **BullMQ + Redis** — נדחה. Redis עוד שירות לתחזק. UI חלש מ-Inngest.
4. **Temporal** — נדחה. Overkill, עקומת למידה גבוהה.
5. **Trigger.dev** — נדחה לעת עתה. דומה אבל פחות בוגר. אם ייפול Inngest, לשקול.
6. **Cloudflare Queues + Workers** — נדחה. נצמד ל-Vercel + Supabase, לא רוצה לפזר.

## Use Cases ב-Restaurant OS

| Job | Trigger | Frequency |
|---|---|---|
| `sync.all-tenants` | cron | 04:00 IST יומי |
| `sync.tenant` | event (`sync/tenant.requested`) | on-demand |
| `forecast.recompute` | cron | 05:00 IST יומי |
| `prep.generate` | cron | 05:30 IST יומי |
| `food_cost.recompute` | cron | 06:00 IST יומי |
| `food_cost.actual` | event (after inventory count) | on-demand |
| `ocr.process_invoice` | event (`invoice.uploaded`) | on-demand |
| `notification.send` | event | on-demand |
| `integration.health_check` | cron | hourly |
| `digest.daily_owner` | cron | 08:00 IST יומי |
| `customer.followup_drafts` | cron | 14:00 IST יומי |

## Implementation Notes

```typescript
// inngest/client.ts
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'restaurant-os' });

// inngest/jobs/prep-generate.ts
export const generatePrepTasks = inngest.createFunction(
  { 
    id: 'prep-generate',
    retries: 3,
    concurrency: { limit: 10, key: 'event.data.tenantId' }
  },
  { cron: '30 2 * * *' },  // 05:30 IST = 02:30 UTC
  async ({ step }) => {
    const tenants = await step.run('list-tenants', getActiveTenants);
    
    for (const t of tenants) {
      await step.run(`tenant-${t.id}`, async () => {
        const forecast = await getForecastFor(t.id, addDays(today(), 1));
        const tasks = await computePrepTasks(forecast);
        await insertPrepTasks(t.id, tasks);
      });
    }
  }
);
```

## Cost Estimate

- 100 tenants × 8 cron jobs/day × 30 days = 24K runs/חודש
- כל run = ~2-5 steps
- ~100K steps/חודש
- **Plan: Pro ($50/חודש)** מ-50K+ steps. סולידי.

## When to Reconsider

- אם Inngest pricing קופץ דרסטית.
- אם דרישות ל-real-time (sub-second) שלא ניתן להגיע אליהן ב-Inngest.
- אם החיבור עם Vercel חלש/לא יציב באזור היעד.

## References

- [Inngest docs](https://www.inngest.com/docs)
- [Inngest vs Trigger.dev comparison](https://www.inngest.com/compare)
- ARCHITECTURE.md §10 — Background Jobs
