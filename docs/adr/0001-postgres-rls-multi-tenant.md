# ADR-0001: Postgres + RLS for Multi-Tenancy

**Status:** Accepted  
**Date:** 2026-04-30  
**Author:** Elad

## Context

Restaurant OS הוא B2B SaaS שיגיע ל-100+ מסעדות. כל מסעדה היא **tenant** עם נתונים מבודדים לחלוטין: אסור שמסעדה תראה את התפריט של מסעדה אחרת, את החשבוניות, את העובדים. דליפת data בין tenants = אירוע סוף-עולם.

יש שלוש אסטרטגיות multi-tenancy מקובלות:

1. **Database-per-tenant** — DB נפרד לכל לקוח. בידוד מקסימלי, יקר תפעולית.
2. **Schema-per-tenant** — schema נפרד באותו DB. מורכב, scaling בעייתי.
3. **Logical (shared DB, tenant_id everywhere)** — DB אחד, `tenant_id` בכל טבלה, אכיפה ברמת query.

האכיפה הלוגית יכולה להיות:
- **Application-level** — הקוד אחראי להוסיף `WHERE tenant_id = ?`. בעיה: מספיק bug אחד והכל נופל.
- **Row-Level Security (RLS) ב-Postgres** — DB עצמו אוכף את הבידוד.

## Decision

**Logical multi-tenancy עם Postgres RLS כשכבת אכיפה ראשית.**

- כל טבלה תכיל `tenant_id UUID NOT NULL` (חוץ מ-`tenants`, `_audit_log`, `migrations`).
- כל טבלה עם RLS מופעלת חובה.
- Policies בנויות לפי תבנית קבועה: `tenant_id IN (SELECT user_tenant_ids())`.
- האפליקציה שולחת tenant context דרך JWT custom claim.
- בדיקות pgTAP אוטומטיות שמוודאות RLS עובד לכל טבלה חדשה.

## Consequences

**Positive:**
- בידוד אכוף ב-DB level — bug באפליקציה לא יכול להדליף data.
- DB אחד, backup אחד, monitoring אחד. תפעול פשוט.
- Cost-effective — לא משלמים על 100 DBs.
- Migrations מתבצעות פעם אחת.
- Cross-tenant analytics אפשריים (אצלנו, לא מוצגים ללקוחות).

**Negative:**
- Schema design מחויב ל-tenant_id בכל מקום — אי אפשר "להוסיף multi-tenancy אחר כך" בקלות.
- RLS policies מוסיפות עומס קל ל-queries (זניח עם indexes נכונים).
- חייבים להיות זהירים מאוד עם service-role key — שימוש שלו עוקף RLS.
- Debugging מורכב יותר (queries עוברים filter שקוף).
- Postgres connection pooling רגיש ל-RLS (PgBouncer transaction mode בלבד).

**Neutral:**
- מודל יציב לעד 1000 tenants. מעבר לכך — לשקול partitioning או sharding.
- אפשר להעביר tenant גדול ל-DB ייעודי בעתיד (migration path אפשרי).

## Alternatives Considered

1. **Database-per-tenant** — נדחה. תפעולית בלתי-אפשרי בלי DevOps team. יקר.
2. **Schema-per-tenant** — נדחה. Migrations חייבות לרוץ על כל schema, סבוך, scaling רע.
3. **Application-level enforcement בלבד** — נדחה. סיכון בעיה רגישה מדי. RLS חייב להיות שם כ-defense in depth.
4. **Multi-DB עם sharding (Citus וכו')** — נדחה. Premature optimization. נשקול אחרי 500+ tenants.

## Implementation Notes

- Helper function `user_tenant_ids()` קיימת ב-DB. כל policy משתמשת בה.
- `auth.uid()` מ-Supabase Auth זמין ב-policies.
- Service-role queries (Edge Functions backend) תמיד מציינים `tenant_id` מפורש.
- pgTAP tests קריטיים: לכל טבלה — בדוק שמשתמש מ-tenant A לא רואה data של tenant B.

## References

- [Postgres RLS docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS guide](https://supabase.com/docs/guides/auth/row-level-security)
- ARCHITECTURE.md §4 — Multi-Tenancy
