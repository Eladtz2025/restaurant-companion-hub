## הרצת ה-migration המלא + יצירת tenant עבורך

### מה אעשה

**שלב 1 — הרצת migration מלא דרך כלי ה-migration של Lovable**
אריץ את כל התוכן של `supabase/full-setup.sql` (חוץ מבלוק ה-SEED בסוף) כ-migration אחד שמכיל:

1. **טבלאות בסיס**: `tenants`, `memberships`, `_audit_log`
2. **טבלאות ליבה**: `menu_items`, `ingredients`, `recipes`, `recipe_components`
3. **פונקציות**: `user_tenant_ids()`, `user_role_in()`, `set_updated_at()`
4. **JWT Custom Claims Hook**: `auth.custom_access_token_hook` — מזריק `tenant_id` ו-`user_role` ל-JWT בעת login
5. **RLS Policies** מלאות לכל הטבלאות (select/insert/update/delete לפי תפקיד)
6. **Triggers** ל-updated_at
7. **עמודות נוספות** ל-ingredients (`pkg_qty`, `category`)

**שלב 2 — יצירת tenant ו-membership עבור המשתמש שלך**
אצטרך את **כתובת המייל שאיתה נרשמת**. אריץ INSERT ל-`tenants` (slug: `my-restaurant`, name: `המסעדה שלי`) ו-INSERT ל-`memberships` עם `role='owner'` עבור ה-user_id שלך.

**שלב 3 — הפעלת ה-JWT hook ב-Supabase Dashboard**
ה-hook `auth.custom_access_token_hook` נוצר ב-DB אך **חייב להיות מופעל ידנית** ב-Dashboard:
`Authentication → Hooks → Custom Access Token → Select function: custom_access_token_hook → Enable`

אסביר לך איך לעשות את זה אחרי ה-migration (זה צעד ידני בן 30 שניות, לא ניתן לאוטומציה דרך SQL).

**שלב 4 — Logout ו-login מחדש**
כדי לקבל JWT חדש עם הקליימים החדשים (`tenant_id`, `user_role`), תצטרך/י להתנתק ולהתחבר שוב.

### תוצאה צפויה
- Login → דף הבית בודק session → מוצא membership → מפנה ל-`/my-restaurant` → הדשבורד נטען עם RLS תקין.

### שאלה לפני שמתחילים
מה כתובת המייל שאיתה נרשמת? (אשתמש בה בבלוק ה-SEED להצמדת ה-tenant ל-user_id שלך)
