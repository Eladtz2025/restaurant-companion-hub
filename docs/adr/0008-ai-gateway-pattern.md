# ADR-0008: Centralized AI Gateway Pattern

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

המוצר משתמש ב-LLM ב-15+ מקומות שונים: עורך מסמכים, OCR, פולואו אפ, בריף יומי, classification, חיפוש BOM, סיכום אנומליות, ועוד. שיקולים קריטיים:

- **Cost control** — קריאה אחת ל-Opus עולה $0.15. לקוח שיוצא משליטה יכול לעלות $1000/יום.
- **Caching** — אותה חשבונית נסרקת פעמיים? אותו prompt לסיכום זהה?
- **Fallback** — אם Anthropic נופל, האפליקציה מתקפלת?
- **Audit** — מה ה-prompts שנשלחו? מה התשובות?
- **Model swap** — שדרוג ל-Opus 5 — צריך לשנות 50 מקומות?
- **Prompt versioning** — A/B prompts, rollback של prompt רע.

אופציות:

1. **קריאה ישירה ל-SDK בכל מקום** — הפשוט אבל יוצר את כל הבעיות לעיל.
2. **Wrapper פר provider** — חוסך מעט אבל לא פותר cost/cache.
3. **AI Gateway מרכזי** — כל קריאה עוברת שכבה אחת.

## Decision

**AI Gateway מרכזי כ-Edge Function. כל קריאת LLM עוברת דרכו. אין יוצא מהכלל.**

ה-gateway אחראי על:

1. **Auth + permission check** — מי קורא ומה הוא רשאי.
2. **Budget check** — האם ה-tenant עוד בתקציב יומי.
3. **Routing** — לפי `task_type` בוחרים model + params.
4. **Caching** — hash של input → cached response (כשrelevant).
5. **Provider call עם timeout + retry.**
6. **Fallback chain** אם provider ראשי נופל.
7. **Logging** — כל call נכנס ל-`ai_calls` table.
8. **Cost tracking** — חישוב $$$ per call.
9. **Response normalization** — formatting אחיד מ-3 ספקים שונים.

## Consequences

**Positive:**

- **Cost ceiling אכפי per tenant** — אי אפשר לחרוג מתקציב יומי.
- **שינוי model = שינוי בקובץ אחד** (`lib/ai/routing.ts`).
- **Caching אמיתי** — חשבונית זהה לא נסרקת פעמיים.
- **Fallback resilience** — אם Claude נופל, GPT/Gemini לוקחים את התפקיד.
- **Audit מלא** — כל prompt + response + cost.
- **Prompt A/B** דרך `prompt_version` field.
- **Observability טובה** — דשבורד פנימי של AI usage.
- **Rate limiting per user** — מונע abuse.

**Negative:**

- **Single point of failure** — gateway down = AI לא עובד.  
  → Mitigation: Edge Functions של Supabase מבוזרות, uptime גבוה.
- **Latency overhead** — ~50-100ms על כל קריאה.  
  → Mitigation: caching מבטל את ה-overhead לקריאות חוזרות.
- **Code overhead** — שכבה נוספת לכתוב ולתחזק.
- **Local dev** — צריך להריץ Supabase Edge Functions locally או mock.
- **Streaming** — gateway חייב לתמוך ב-streaming אם אחת הקריאות תהיה streaming. complexity נוספת.

**Neutral:**

- AI Gateway הוא תבנית מקובלת בתעשייה (LiteLLM, Portkey, Helicone).

## Alternatives Considered

1. **שירות מנוהל (Portkey, Helicone, LiteLLM Cloud)** — נדחה ל-V1. תלות נוספת, latency נוסף, פחות שליטה. נשקול ב-V2 אם הבית-משלנו נהיה כבד.
2. **קריאה ישירה ל-SDKs** — נדחה. כל הבעיות שהוזכרו ב-context.
3. **שכבת abstraction ב-application code (לא Edge Function)** — נדחה. אז ה-gateway חי בתוך Vercel Function שלא תמיד יציבה לקריאות ארוכות.
4. **Cloudflare AI Gateway** — נדחה. ניתוב טוב אבל אין budget control per tenant ברמת deep integration. אפשר לשלב כתוסף בעתיד.

## API Design

```typescript
// כל קריאה ל-AI:
import { ai } from '@/lib/ai/gateway';

const result = await ai.invoke({
  taskType: 'document.edit',
  input: {
    document: 'תוכן המסמך...',
    instruction: 'תקצר את הפסקה השלישית',
  },
  tenantId: ctx.tenantId,
  userId: ctx.userId,
  metadata: { documentId: doc.id }, // ל-audit
});

// result:
// {
//   output: '...',
//   model: 'claude-sonnet-4-6',
//   tokens: { input: 1234, output: 567 },
//   costCents: 3,
//   cacheHit: false,
//   latencyMs: 1842,
// }
```

## Schema

```sql
CREATE TABLE ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  task_type TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  cost_cents INT NOT NULL,
  latency_ms INT,
  cache_hit BOOLEAN DEFAULT false,
  status TEXT NOT NULL,
  error_message TEXT,
  prompt_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ai_response_cache (
  prompt_hash TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  response JSONB NOT NULL,
  hits INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Caching Rules

| Task                            | Cacheable | TTL     |
| ------------------------------- | --------- | ------- |
| `invoice.ocr`                   | ✅        | 30 days |
| `document.summarize`            | ✅        | 7 days  |
| `expense.categorize_suggestion` | ✅        | 30 days |
| `feedback.sentiment`            | ✅        | 7 days  |
| `document.edit`                 | ❌        | —       |
| `followup.draft`                | ❌        | —       |
| `brief.daily`                   | ❌        | —       |
| `event_quote.generate`          | ❌        | —       |
| `chat.simple`                   | ❌        | —       |

קאש מבוטל אם `prompt_version` השתנה — bump version של prompt → הקאש לאותה משימה נמחק.

## Cost Ceiling Enforcement

```typescript
// בתחילת כל call
const todaySpend = await sumAiCallsCents({ tenantId, since: startOfDay() });
const tenant = await getTenant(tenantId);

if (todaySpend >= tenant.ai_budget_daily_cents) {
  throw new BudgetExceededError({
    tenantId,
    spent: todaySpend,
    budget: tenant.ai_budget_daily_cents,
  });
}

// Alert ב-80%
if (todaySpend >= tenant.ai_budget_daily_cents * 0.8) {
  await emitAlert('ai_budget_warning_80', { tenantId });
}
```

## When to Reconsider

- אם נחליט לשלב streaming AI responses ב-UI — gateway צריך להתעדכן לתמוך ב-SSE.
- אם cost של תחזוקת gateway עולה משמעותית על שירות מנוהל.
- אם volumes גדלים מאוד (1M+ קריאות/חודש) — לשקול שירות מנוהל מקצועי.

## References

- [LiteLLM](https://github.com/BerriAI/litellm) — inspiration
- [Helicone](https://helicone.ai/) — managed alternative
- ARCHITECTURE.md §7 — AI Gateway
- ADR-0004 — Claude as Primary LLM
