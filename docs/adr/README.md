# Architecture Decision Records

תיעוד מסודר של החלטות ארכיטקטורה גדולות. כל החלטה מקבלת ADR משלה. שינוי החלטה = יצירת ADR חדש שמסמן את הקודם כ-`Superseded`.

## חוקי ADR

1. **כל החלטה ארכיטקטונית גדולה דורשת ADR.** לא תוסיפו Redis בלי ADR.
2. **ADRs לא נמחקים, לא נערכים בדיעבד.** רק `Superseded by NNNN`.
3. **תבנית קבועה:** Status → Context → Decision → Consequences → Alternatives.
4. **שמות קבצים:** `NNNN-kebab-case-title.md`. מספרים רצים, ללא דילוגים.
5. **כל ADR קצר.** אם > 200 שורות, פצל.

## Index

| # | כותרת | סטטוס | תאריך |
|---|---|---|---|
| 0001 | Postgres + RLS for Multi-Tenancy | Accepted | 2026-04-30 |
| 0002 | Supabase as Backend Platform | Accepted | 2026-04-30 |
| 0003 | PWA over Native Mobile | Accepted | 2026-04-30 |
| 0004 | Claude as Primary LLM with Gemini for OCR | Accepted | 2026-04-30 |
| 0005 | Playwright for Scraping When APIs Unavailable | Accepted | 2026-04-30 |
| 0006 | Inngest for Background Jobs | Accepted | 2026-04-30 |
| 0007 | Monolith Architecture | Accepted | 2026-04-30 |
| 0008 | Centralized AI Gateway Pattern | Accepted | 2026-04-30 |
| 0009 | Adapter Pattern for External Integrations | Accepted | 2026-04-30 |
| 0010 | Lovable + Claude Code Hybrid Workflow | Accepted | 2026-04-30 |

## תבנית ל-ADR חדש

```markdown
# ADR-NNNN: כותרת קצרה ומדויקת

**Status:** Proposed | Accepted | Superseded by NNNN | Deprecated  
**Date:** YYYY-MM-DD  
**Author:** [Name]

## Context
מה הבעיה? אילו אילוצים? למה עכשיו?

## Decision
מה הוחלט. ספציפי, חד-משמעי.

## Consequences
**Positive:**
- ...

**Negative:**
- ...

**Neutral:**
- ...

## Alternatives Considered
1. **X** — נדחה כי...
2. **Y** — נדחה כי...

## References
- קישורים רלוונטיים
```
