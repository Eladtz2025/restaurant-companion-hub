# תיקון: לא רואים את מסך הלוגין

## הבעיה

`src/app/page.tsx` מבצע כרגע `redirect('/api/setup')` — שזה endpoint של API שמחזיר JSON, לא דף UI. לכן כשנכנסים ל-`/` לא רואים את מסך הכניסה אלא תגובה של API (או שגיאה).

ה-middleware אמנם אמור להפנות ל-`/login` כשאין משתמש, אבל מכיוון ש-`page.tsx` עצמו מבצע redirect מיידי לפני רינדור, החוויה נשברת.

## השינוי

### `src/app/page.tsx`
להחליף ב-Server Component שמבצע:
1. יצירת Supabase server client (קריאת cookies).
2. `supabase.auth.getUser()`.
3. אם אין user → `redirect('/login')`.
4. אם יש user → לטעון את ה-`memberships` של המשתמש (tenant_id + slug) ולהפנות ל-`/{firstTenantSlug}`.
5. אם למשתמש אין שום tenant → `redirect('/api/setup')` (מצב onboarding קיים).

### למה זה פותר
- כניסה ל-`/` ללא session → הפניה מיידית ל-`/login` ורואים את הטופס.
- אחרי התחברות מוצלחת, `window.location.assign('/')` ב-login יגיע לדף הבית, יזהה session, ויפנה ל-tenant הנכון.

## קבצים שיושפעו
- `src/app/page.tsx` — שכתוב מלא (קצר, ~30 שורות).

אין שינויים ב-middleware, ב-DB, או בקבצי auth אחרים.