## הבעיה

הסיסמה הנכונה לא משנה — הרישום נכשל כי משתנה הסביבה `NEXT_PUBLIC_SUPABASE_URL` מצביע על **כתובת לוח־הבקרה של Supabase** במקום על **כתובת ה־API של הפרויקט**.

ערך נוכחי (שגוי):
```
https://supabase.com/dashboard/project/<project-ref>
```

מה שצריך להיות:
```
https://<project-ref>.supabase.co
```

איך אומת: בדיקת `curl` ישירה ל־`$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup` החזירה HTML של דאשבורד Supabase במקום JSON של auth. בנוסף `auth.users` ריק (0 משתמשים), אין רשומות ב־`auth_logs`, והבקשה פשוט לא מגיעה אל שירות ה־Auth. ב־`signupAction` כל שגיאה לא־מזוהה נופלת ל־"שגיאה ביצירת החשבון. נסה שוב." — וזה בדיוק מה שאת/ה רואה.

## תיקון

### צעד 1 — לעדכן את ה־secret (פעולה שלך, מחוץ לקוד)

בלוח־הבקרה של Supabase: **Project Settings → API → Project URL**. להעתיק את הערך שנראה כך:

```
https://<project-ref>.supabase.co
```

ב־Lovable: **Project Settings → Environment Variables** — לעדכן את `NEXT_PUBLIC_SUPABASE_URL` לערך הנכון. לוודא ש־`NEXT_PUBLIC_SUPABASE_ANON_KEY` עדיין מכיל את ה־**anon public** key מאותו עמוד.

(אופציונלי: לעדכן באותו אופן `SUPABASE_URL` ו־`VITE_SUPABASE_URL` כדי לשמור עקביות, אבל הקוד עצמו קורא רק ל־`NEXT_PUBLIC_*`.)

### צעד 2 — בדיקת שפיות אחרי הריענון

לטעון מחדש את ה־preview, לנסות הרשמה. צפוי:
- אין יותר באנר "שגיאה ביצירת החשבון"
- redirect ל־`/onboarding`
- שורה חדשה ב־`auth.users`

### צעד 3 — שיפור הודעת השגיאה (שינוי קוד קטן, אופציונלי אך מומלץ)

ב־`src/app/(auth)/login/actions.ts`, להוסיף `console.error(error)` בתוך כל ענף `if (error)` של `signupAction` / `loginAction` / `resetPasswordAction` / `updatePasswordAction`, ולהדפיס את `error.message` בתוך ההודעה הגנרית בזמן פיתוח. זה ימנע מצב עתידי שבו תקלת תצורה מציגה הודעה כללית בלי שום רמז ב־logs.

## הערות

- ה־service role key אסור לחלוטין להגיע ל־`NEXT_PUBLIC_*`. רק ה־anon key מותר שם.
- אחרי התיקון, אם תהיה שגיאה אמיתית של Supabase (למשל סיסמה חלשה או email כבר רשום), הקוד הקיים כבר מטפל בזה ומחזיר הודעה ברורה בעברית.
