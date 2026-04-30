# ADR-0005: Playwright for Scraping When APIs Unavailable

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

חלק מהאינטגרציות הקריטיות (Tabit, OnTopo) לא מספקות API ציבורי לכל לקוח. שלוש אופציות:

1. **לוותר על האינטגרציה** — לא רלוונטי, אלה data sources חיוניים.
2. **CSV ייצוא ידני** — פתרון אנושי, שביר.
3. **Scraping עם credentials של הלקוח** — אוטומציה דרך browser automation.

אם בוחרים scraping, יש שתי אופציות:

- **Playwright** (Microsoft, modern)
- **Puppeteer** (Google, ותיקה)

## Decision

**Playwright לכל ה-scraping. CSV ידני כ-fallback. תמיד מנסים API רשמי קודם.**

תהליך החלטה לכל אינטגרציה חדשה:

1. **Step 1:** פנייה רשמית לספק לבקשת API.
2. **Step 2:** אם אין מענה תוך 4 שבועות — בדיקת CSV export.
3. **Step 3:** אם אין CSV או הוא לא מכסה את הצרכים — Playwright scraping.

## Consequences

**Positive:**

- מאפשר אינטגרציה גם כשהספק לא משתף פעולה.
- Playwright יציב מ-Puppeteer ב-2026, תמיכה רחבה יותר.
- Selectors מודרניים (`getByRole`, `getByTestId`) פחות שבירים מ-CSS class selectors.
- אופציה auto-wait מובנית מקטינה flakiness.
- Multi-browser (Chromium, Firefox, WebKit) — אם site חוסם Chrome, יש fallback.

**Negative:**

- **משפטית אפור:** רוב תנאי השימוש אוסרים גישה אוטומטית. אם הלקוח מסכים לכך מפורשות זה אפור (לא שחור), אבל סיכון קיים.
- **שביר:** כל שינוי UI בספק שובר את הסקרייפר.
- **תחזוקה מתמשכת:** הערכה 5-15% מזמן הפיתוח לכל סקרייפר ב-rolling basis.
- **Anti-bot:** סיכון חסימה אם זוהה כבוט. דורש user-agent נקי, rate limiting שמרני, התנהגות אנושית.
- **Credentials של הלקוח** — סיכון אבטחה. חייב Vault encryption.
- **Performance:** Playwright דורש Chromium binary בכל run — ~150MB.

**Neutral:**

- אפשר להחליף Playwright ב-Puppeteer בעתיד אם יידרש (API דומה).
- Inngest מאפשר להריץ scrapers as jobs מבלי לנהל infra ידנית.

## Alternatives Considered

1. **Puppeteer** — נדחה. פיתוח איטי יותר ב-Google. Playwright יציב ומגיב יותר.
2. **Selenium** — נדחה. ארכיטקטורה ישנה, איטי.
3. **Cheerio + fetch** (לא browser) — נדחה. רוב האתרים דורשים JS execution לטעון data.
4. **API reverse engineering (HTTP requests ישירות)** — נדחה. שביר יותר, וגם מפר תנאי שימוש.
5. **שירות חיצוני (Browse AI, Apify)** — נדחה. תלות נוספת, יקר ב-scale, איבוד שליטה.
6. **Manual CSV-only** — נדחה כפתרון יחיד. שביר אנושית, לא scalable.

## Implementation Rules

חוקי ברזל לכל סקרייפר:

1. **Credentials של הלקוח, לא שלך.** הלקוח מספק user/pass של עצמו. נשמר ב-Supabase Vault.
2. **הסכמה מפורשת חתומה.** הלקוח חותם בהסכם השימוש שהוא מאשר גישה אוטומטית מטעמו.
3. **User-Agent קבוע, לא מנסה להתחזות.** לא לחקות bot detection bypass.
4. **Rate limiting שמרני.** פעם ביום מקסימום. אין צורך ב-real-time.
5. **על כל כשל — alert.** אסור שsync שותק יום שלם.
6. **Selectors דרך `data-testid` או `data-*` attributes** כשאפשר. CSS classes רק כ-fallback.
7. **Timeout מקסימלי 60s לכל פעולה.** לא להישאר תקוע.
8. **Headless mode בלבד בייצור.**
9. **Browser context חדש לכל run** — לא לחלוק cookies בין tenants.

## Failure Handling

```
Run failed once → retry אחרי 30 דקות (Inngest)
Run failed 3x ביום → alert ל-tech support
Run failed 3 ימים ברצף → email לבעלים, status 'failing' באינטגרציה
Run failed 7 ימים → השעיה אוטומטית, דורש פעולה ידנית
```

## When to Reconsider

- אם ספק (Tabit/OnTopo) מספק API — מחליפים מיד את ה-scraper.
- אם anti-bot מקשה מדי — ייתכן שצריך proxy network או human-in-loop.
- אם משפטית הופך מוגבל יותר (תקדים משפטי, שינוי תנאי שימוש מפורש) — דחיית הגישה ובחזרה ל-CSV ידני.

## References

- [Playwright docs](https://playwright.dev/)
- [hiQ vs LinkedIn ruling](https://en.wikipedia.org/wiki/HiQ_Labs_v._LinkedIn) — הקשר משפטי
- ARCHITECTURE.md §9 — Scrapers
- ADR-0009 — Adapter Pattern
