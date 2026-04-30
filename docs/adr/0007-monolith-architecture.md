# ADR-0007: Monolith Architecture

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

יש לבחור בין:

1. **Monolith** — אפליקציה אחת, codebase אחד, deploy אחד.
2. **Microservices** — מספר שירותים, deploys נפרדים, תקשורת ברשת.
3. **Modular monolith** — monolith עם הפרדה ברורה בין domains, אבל deploy אחד.

המערכת מתחילה קטנה (1-10 לקוחות) עם תכנון לגדול (100+). חשוב לא לעשות premature optimization, אבל גם לא להיתקע במקום שיחייב rewrite.

## Decision

**Modular monolith.** Next.js application אחת מאוחסנת ב-Vercel. הפרדה לוגית פנימית לפי domains:

```
app/
├── (app)/[tenantSlug]/
│   ├── prep/
│   ├── inventory/
│   ├── menu/
│   ├── financial/
│   ├── events/
│   └── ...
adapters/        # External integrations (separate per provider)
inngest/         # Background jobs (deployed with monolith)
prompts/         # AI prompts
lib/
├── ai/          # AI gateway logic
├── forecast/    # Forecast engine
├── food-cost/   # FC calculator
├── inventory/
├── tenant.ts
└── permissions.ts
```

כל domain עצמאי לוגית — יש בו business logic, types, תקשורת ל-DB. לא תלוי בקוד פנימי של domain אחר. אם נצטרך להוציא domain ל-service נפרד בעתיד, ה-boundary כבר ברור.

## Consequences

**Positive:**
- **Deploy יחיד, פשוט.** PR → merge → deploy. לא צריך לתאם 5 deploys.
- **Refactoring קל.** type checking על כל הקוד בבת אחת. שינוי schema = שינוי בכל המקומות בו זמנית.
- **Local dev מהיר.** `pnpm dev` ועובדים על הכל.
- **Cost-effective.** Vercel חשבונית אחת, לא 5.
- **Tooling פשוט.** יש logger אחד, error tracker אחד, CI אחד.
- **אין distributed tracing.** debugging קל יותר.
- **Latency מינימלי בין modules** — function call לא network call.

**Negative:**
- **Scaling אחיד** — לא ניתן לסקייל service אחד בנפרד. Vercel serverless functions עוזרת — סקיילינג ברמת function.
- **גבול אחד נופל = הכל יורד.** באג ב-financial יכול להפיל גם את prep.  
  → Mitigation: Error boundaries ב-frontend, try/catch ב-backend, isolation logic.
- **Codebase גדל.** אחרי 200K שורות — חתיכה גדולה לתחזק. אופציה לפצל אז.
- **Deployment time עולה ככל שהאפליקציה גדלה.** Vercel build-time יכול להגיע ל-10+ דקות.

**Neutral:**
- ה-modular boundaries מאפשרות יציאה ל-microservices בעתיד אם יידרש.

## Alternatives Considered

1. **Microservices מההתחלה** — נדחה. premature optimization. דורש DevOps שאין. 80% מ-startups שעושים microservices מתחרטים.
2. **Modular monolith ב-Nx/Turborepo** — נדחה ל-V1. תוסיפים complexity ב-tooling בלי benefit מיידי. אופציה לעבור אם codebase גדל מאוד.
3. **Serverless functions only (לא Next.js framework)** — נדחה. איבוד יתרונות RSC, Server Actions, מערכת אקולוגית.

## When to Reconsider Microservices

מעבר ל-microservices מוצדק רק אם:

1. **Team size > 15 מפתחים** — coordination על monolith נהיה קשה.
2. **Independent scaling** — service אחד דורש 100x משאבים מהאחרים.
3. **Different tech stacks needed** — דרישה אמיתית לפיצול שפות/runtimes.
4. **Domain boundaries מתבהרים מאוד** — אחרי שנתיים של פיתוח רואים בבירור איפה הקווים.

עד אז, monolith.

## Service Extraction Path (If Needed)

המקומות הראשונים שייתכן ויפוצלו (אם בכלל):

1. **AI Gateway** — אם השימוש ב-AI דורש isolation או scaling שונה.
2. **Scrapers** — כבר בעצם רצים כ-Inngest jobs מנותקים. אופציה להוציא אותם לקונטיינר ייעודי.
3. **OCR pipeline** — אם נפח גבוה דורש workers ייעודיים.

הכל אופציונלי. ב-V1 — הכל בתוך ה-monolith.

## Implementation Rules

- **No cross-domain imports באזור business logic.** `prep` לא מייבא מ-`inventory`. שניהם משתמשים ב-`lib/inventory/queries.ts`.
- **Domain ייעודי = folder ייעודי.** לא לפזר לוגיקה בין מקומות.
- **Shared kernel** ב-`lib/` — דברים שכולם צריכים: tenant, permissions, types בסיסיים.
- **Anti-corruption layer** בין domains: אם `events` צריך data מ-`menu`, יש interface מוגדר.

## References

- [Modular monolith pattern](https://www.kamilgrzybek.com/design/modular-monolith-primer/)
- [Should you build a monolith or microservices?](https://martinfowler.com/articles/microservices.html)
- ARCHITECTURE.md §17 — Frontend structure
