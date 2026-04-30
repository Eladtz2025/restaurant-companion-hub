# ADR-0010: Lovable + Claude Code Hybrid Workflow

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

המוצר נבנה ע״י Elad בעיקר, עם עזר של AI tools. שתי הפלטפורמות הראשיות:

- **Lovable AI** — UI generator, מהיר, מצוין ל-screens חדשים, חלש בלוגיקה עסקית מורכבת ובאינטגרציות.
- **Claude Code** — terminal-based AI coding agent, מעולה ב-business logic, schema, integrations, refactoring, ו-architectural work.

צריך להחליט: שניהם? אחד? איך מחלקים את העבודה?

## Decision

**Hybrid workflow.** Lovable ו-Claude Code עובדים על אותו GitHub repo, עם חלוקת עבודה ברורה.

### Lovable עושה:
- כל ה-screens תחת `app/(app)/[tenantSlug]/`
- Forms (React Hook Form + Zod)
- Tables, modals, drawers, sheets
- Mobile responsive UI
- RTL adjustments
- shadcn/ui customizations
- Dashboard widgets
- Visual polish ו-styling

### Claude Code עושה:
- Database schema + Migrations (`supabase/migrations/`)
- RLS policies + pgTAP tests
- Edge Functions (`supabase/functions/`) — AI Gateway, OCR pipeline
- Adapters (`adapters/`) — Tabit, OnTopo, Sumit, Marketman
- Scrapers (Playwright)
- Inngest jobs
- Calculators (FC, forecast, P&L)
- AI prompts engineering (`prompts/`)
- E2E tests (Playwright)
- Integration tests
- ADRs ו-tech docs
- Refactoring sweeps
- Code review של Lovable output

### במשותף:
- Bug fixes שהם UI + logic
- Performance optimizations

## Consequences

**Positive:**
- **Speed** — Lovable מייצר screens במהירות, Claude Code בונה את הליבה במקביל.
- **Quality** — כל אחד עושה את מה שהוא טוב בו.
- **Cost-effective** — מפתח אחד בני אדם + 2 AI tools = פרודוקטיביות של צוות קטן.
- **Documentation native** — Claude Code שומר ADRs ו-docs מתעדכנים.
- **Test coverage** — Claude Code מקפיד על tests, Lovable לא תמיד.

**Negative:**
- **Code style drift** — קוד מ-Lovable לא תמיד תואם ל-conventions של Claude Code.  
  → Mitigation: refactor sweeps שבועיים ע״י Claude Code.
- **Lovable מייצר קוד shallow** — לפעמים מטפל ב-happy path בלבד, חסר error handling.  
  → Mitigation: Claude Code מבצע hardening pass לפני merge ל-main.
- **Two contexts** — אתה צריך לזכור איפה לעבוד. blur של גבולות = chaos.
- **Lovable Cloud lock-in** — אם מסתמכים על Lovable Storage / Auth / וכו', יש vendor lock.  
  → Mitigation: לא משתמשים ב-Lovable Cloud, רק ב-Lovable כ-IDE שיוצרת קוד ב-GitHub.
- **Sync** — שינויים ב-Lovable שגוררים שינויים ב-Claude Code (וההפך) דורשים git discipline.

## Workflow Rules

### 1. Single source of truth: GitHub
שני הכלים עובדים על אותו repo. אין fork, אין clone לפלטפורמה ייחודית. הקוד שב-`main` הוא הקוד החי.

### 2. Branches נפרדים
- Lovable ב-branch `lovable/feat-NNN`
- Claude Code ב-branch `cc/feat-NNN`
- שניהם מ-merge ל-`main` רק אחרי PR review.

### 3. Refactor sweep שבועי
פעם בשבוע (יום ה'), Claude Code עושה pass של:
- Type safety improvements
- Error handling
- Test coverage
- Code style normalization
- Removing dead code

PR נפרד עם תיוג `chore: weekly refactor sweep`.

### 4. אסור ל-Lovable
- לגעת ב-`supabase/migrations/`
- לכתוב Edge Functions
- לכתוב adapters או scrapers
- לכתוב Inngest jobs
- לשנות `lib/ai/`, `lib/forecast/`, `lib/food-cost/`
- לכתוב E2E tests

אם Lovable שואל לעשות אחד מאלו — refuse בעדינות והעבר ל-Claude Code.

### 5. אסור ל-Claude Code
לא הרבה. Claude Code יכול לגעת בכל דבר. אבל **אם משנה UI מורכב — קודם שואל את Elad** אם זה משהו ש-Lovable יעשה טוב יותר.

### 6. PR review hierarchy
- PR מ-Lovable: Claude Code reviews (אוטומטי על PR open) → Elad מאשר.
- PR מ-Claude Code: Elad reviews ישירות.
- PR שמשפיע על schema / RLS / security: Elad חייב לבדוק ידנית.

### 7. Conventions אכופים אוטומטית
- ESLint + Prettier על pre-commit (Husky).
- Type check חובה ב-CI.
- כל PR חייב לעבור CI לפני merge.

## Migration Path

ב-Phase 1-3 — Lovable עושה הרבה (UI heavy).  
ב-Phase 4-7 — Claude Code עושה יותר (אינטגרציות, AI, calculators).  
ב-Phase 8-10 — שיווי משקל. Lovable ל-screens חדשים, Claude Code ל-tooling וייצור.

**מתי להחליט שLovable כבר לא נחוץ:**
- קצב יצירת screens יורד מאוד.
- Refactor sweeps מוצאים יותר ויותר בעיות בקוד שלו.
- אתה מבלה > 50% מהזמן בלתקן Lovable במקום לבנות.

אז: ADR חדש שמחליף את זה, מעבר מלא ל-Claude Code.

## Alternatives Considered

1. **רק Claude Code** — נדחה. UI work באמת איטי יותר. Lovable יעיל מאוד ל-screens.
2. **רק Lovable** — נדחה. Lovable חלש בלוגיקה מורכבת ובאינטגרציות. תפוקה נמוכה ב-DB/backend work.
3. **Cursor / Windsurf במקום Claude Code** — אלטרנטיבה לגיטימית. אם ב-Claude Code יש בעיה, אופציה לגיבוי.
4. **גם v0 של Vercel** — נדחה. v0 חזק מאוד אבל יוצר drift נוסף בין כלים. שני AI coding tools זה כבר על הסף.
5. **שכירת מפתח full-stack** — נדחה כפתרון יחיד. תעלות גבוהות, ועדיין משתמשים ב-AI tools להאצה.

## Lovable-Specific Cautions

מהניסיון של Elad עם Lovable:
- **Lovable Cloud Storage** — לא להסתמך עליו. שמירה ב-Supabase Storage בלבד.
- **Lovable Auth** — לא משתמשים. Supabase Auth בלבד.
- **Lovable Edge Functions (Deno)** — אפשר, אבל הקוד מתועד ידנית ולא ב-source ראשי. עדיף Edge Functions ב-Supabase.
- **Versioning ב-Lovable** — נחמד, אבל לא תחליף ל-Git. Git הוא הסטנדרט.

## When to Reconsider

- אם Lovable מוציא Pro feature שעוצמתית מאוד (לדוגמה: AI שמבין את הקוד הקיים ולא רק יוצר חדש) — לשקול הרחבת תפקיד.
- אם Anthropic מוציאה Claude Code Studio עם UI generation — אופציה לאחד.
- אם נמצא שכבת קוד שאף אחד מהשניים לא מתאים — לבחור כלי שלישי לאותה שכבה.

## References

- [Lovable](https://lovable.dev/)
- [Claude Code](https://www.anthropic.com/claude-code)
- PHASING.md נספח א׳ — Division of Labor
