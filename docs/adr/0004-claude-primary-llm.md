# ADR-0004: Claude as Primary LLM, Gemini for OCR

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

המוצר משתמש ב-LLM עבור: עריכת מסמכים, פיירזינג של חשבוניות (OCR), ניסוח פולואו אפ ללקוחות, סיווג הוצאות, יצירת בריפים יומיים, יצירת תפריטי אירועים מקלט חופשי.

צריך לבחור מודל ראשי. שיקולים:

- איכות תוכן בעברית
- יכולת לעקוב אחר הוראות מורכבות (format, RTL, terminology)
- עלות לטוקן
- Latency
- Tool calling reliability
- שמירה על הקשר ארוך
- יציבות API ו-uptime

## Decision

**מודל ראשי: Claude Sonnet 4.6 (Anthropic).**  
**מודל קל: Claude Haiku 4.5 (Anthropic).**  
**מודל כבד (שימוש נדיר): Claude Opus 4.7 (Anthropic).**  
**OCR: Gemini 2.5 Pro (Google).**  
**Fallback: GPT-4.1 (OpenAI).**

הקצאה לפי משימה ב-`lib/ai/routing.ts` (ראה ARCHITECTURE.md §7.4).

### למה Claude לרוב המשימות

- איכות עברית גבוהה, שמירה על RTL בלי טעויות.
- מערכת הוראות (system prompts) חזקה — שומר על format.
- Tool calling יציב ומדויק.
- Context window גדול (200K tokens) — מספיק למסמכים שלמים.
- Anthropic מציעה uptime SLA סולידי.

### למה Gemini ל-OCR

- בנצ'מארקים פנימיים: Gemini 2.5 Pro מובילה ב-OCR עברית עם כתב יד.
- Structured output (JSON schema) יציב.
- Multimodal native — תמונה ו-PDF נכנסים ישירות.
- מחיר תחרותי לעיבוד תמונות.

### למה GPT כ-fallback

- חיוני שיש fallback מספק שונה — אם Anthropic נופל, המוצר לא קופא.
- GPT-4.1 איכות סבירה, latency נמוך.
- Anthropic ו-OpenAI לא נופלים בו-זמנית.

## Consequences

**Positive:**

- איכות גבוהה לתוכן בעברית.
- Fallback אמיתי בין שלושה ספקים — אמינות גבוהה.
- AI Gateway (ADR-0008) מאפשר החלפת מודל בלי שינוי קוד.
- Anthropic נחשבת ספק אחראי, פחות סיכוני policy.

**Negative:**

- Claude יקר מ-Gemini Flash או GPT-4.1-mini למשימות פשוטות.  
  → Mitigation: Haiku למשימות קלות.
- תלות בספק זר — תקלות API משפיעות מיידית.  
  → Mitigation: fallback chain.
- עברית של Claude טובה אבל לפעמים פחות "טבעית" מ-GPT.  
  → Mitigation: prompt engineering חזק עם דוגמאות עברית.
- Opus יקר מאוד ($15/M input, $75/M output). שימוש מאוד מצומצם.

**Neutral:**

- מחירים יורדים כל 6 חודשים. בדיקה רבעונית של routing.
- מודלים חדשים מ-Anthropic מתחלפים — AI Gateway מקל על update.

## Alternatives Considered

1. **GPT-4.1 כ-primary** — נדחה. עברית פחות עקבית מ-Claude. Tool calling פחות יציב במשימות מורכבות.
2. **Gemini 2.5 Pro כ-primary** — נדחה. עריכת מסמכים פחות אמינה מ-Claude. שמירה על format חלשה יותר.
3. **רק Anthropic לכל משימה (כולל OCR)** — נדחה. OCR של Anthropic איכותי אבל פחות מדויק מ-Gemini בעברית עם כתב יד.
4. **מודל local (Llama, Qwen)** — נדחה. איכות עברית פחותה, infra עצמאית יקרה, אין benefit מספק.
5. **מודל ייעודי שעבר fine-tuning** — נדחה ל-V1. נשקול אחרי שיש 6+ חודשי data.

## Cost Estimate (per tenant per month)

הערכה גסה לתוכן רגיל של מסעדה אחת:

- 30 חשבוניות OCR @ Gemini Pro: $3
- 60 בריפים יומיים @ Sonnet: $5
- 100 פולואופים @ Sonnet: $4
- 50 עריכות מסמכים @ Sonnet: $3
- 200 classifications @ Haiku: $1
- 5 audits @ Opus (חודשי): $5

**סה"כ: ~$21/חודש לכל tenant.** Cost ceiling default: $5/יום ($150/חודש) — מספיק עם הרבה מרווח.

## Implementation Notes

- כל קריאה עוברת AI Gateway (ADR-0008).
- Routing ב-`lib/ai/routing.ts`.
- Cost tracking בטבלת `ai_calls`.
- Prompt versioning ב-`prompts/{task_type}/v{N}.md`.
- בדיקות תקופתיות (רבעוניות) על איכות בנצ'מארקים פנימיים.

## References

- [Anthropic pricing](https://www.anthropic.com/pricing)
- [Google AI pricing](https://ai.google.dev/pricing)
- ARCHITECTURE.md §7 — AI Gateway
- ADR-0008 — AI Gateway Pattern
