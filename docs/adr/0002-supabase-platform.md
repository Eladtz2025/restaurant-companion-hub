# ADR-0002: Supabase as Backend Platform

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

צריך לבחור backend platform שמספק: Postgres, Auth, Storage, Edge Functions, Realtime. אופציות עיקריות:

1. **Self-hosted** — Postgres על AWS RDS + Auth0/Clerk + S3 + Lambda + custom realtime
2. **Supabase** — הכל באותה פלטפורמה
3. **Firebase** — של Google, NoSQL primary
4. **AWS Amplify** — מעטפת AWS
5. **Neon + Clerk + Cloudflare** — שילוב של best-of-breed

קונטקסט נוסף:

- אני (Elad) מנוסה ב-Supabase. הצוות שיגדל יזדקק להתמחות.
- צריך RLS אמיתי (החלטה מ-ADR-0001).
- צריך קצב פיתוח גבוה.
- תקציב מוגבל בשלב הראשון.

## Decision

**Supabase כפלטפורמת backend מרכזית.**

מרכיבים בשימוש:

- **Postgres** — DB ראשי עם RLS
- **Supabase Auth** — אימות + JWT + MFA
- **Supabase Storage** — קבצים (תמונות מנות, חתימות, OCR sources)
- **Supabase Edge Functions (Deno)** — AI Gateway, OCR pipeline, custom endpoints
- **Supabase Realtime** — עדכונים live ל-dashboard
- **Supabase Vault** — אחסון מוצפן ל-credentials של אינטגרציות

Vercel תארח את ה-Next.js frontend.

## Consequences

**Positive:**

- מהירות פיתוח גבוהה — אין צורך לחבר 5 שירותים.
- RLS native — חלק מ-DNA של Supabase, לא bolt-on.
- מחיר נוח עד מאות tenants.
- Local development דרך Supabase CLI עם Docker.
- Migrations + types אוטומטיים מ-CLI.
- קהילה גדולה, תיעוד טוב.

**Negative:**

- Vendor lock-in מסוים — אבל הכל Postgres + S3-compatible, אז migration אפשרי.
- Supabase outages משפיעות על כל המערכת.
- Edge Functions ב-Deno — פחות מערכת אקולוגית מ-Node.
- Realtime יכול להיות יקר בהיקפים גדולים.
- Connection pooling רגיש (PgBouncer transaction mode בלבד עם RLS).

**Neutral:**

- אפשר להוציא Postgres ל-Neon/RDS אם נצטרך — Supabase לא מסתיר את ה-DB.
- אפשר להחליף Auth ל-Clerk/Auth0 בעתיד אם יידרש.

## Alternatives Considered

1. **Self-hosted על AWS** — נדחה. דורש DevOps שאין. עצירה של 3 חודשים בהקמה.
2. **Firebase** — נדחה. NoSQL לא מתאים לסכמה רלציונית של מסעדה. RLS חלש.
3. **AWS Amplify** — נדחה. מסורבל, vendor lock-in חזק יותר מ-Supabase, מחיר.
4. **Neon (DB) + Clerk (Auth) + Cloudflare R2 (Storage) + Cloudflare Workers** — נדחה לעת עתה. שילוב טוב טכנית, אבל overhead של אינטגרציה. נשקול אם Supabase יוגבל ב-V2.
5. **PlanetScale + Supabase Auth + S3** — נדחה. PlanetScale הסיר branching ולא תומך ב-RLS native.

## Migration Path

אם יום אחד נצטרך לעזוב Supabase:

- **Postgres** — `pg_dump`, deploy ל-Neon/RDS, מחבר ל-Supabase Auth (שאפשר להריץ self-hosted) או מחליף לאחר.
- **Storage** — S3-compatible, migration script.
- **Edge Functions** — דנו ב-Cloudflare Workers, port מ-Deno ל-Workers דורש refactor אבל אפשרי.
- **Auth** — JWT-based, אפשר להחליף provider ולשמור users.

הערכה: 6-8 שבועות פיתוח אם נחליט לעבור. עלות זמן טובה לפי Vendor lock-in.

## References

- [Supabase docs](https://supabase.com/docs)
- ARCHITECTURE.md §3 — Stack
