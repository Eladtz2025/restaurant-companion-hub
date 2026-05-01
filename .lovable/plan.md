## הבעיה

מה־Supabase auth logs רואים שההתחברות מצליחה (`POST /token` → 200, event `Login`), אבל המשתמש נשאר בדף `/login`. ב־runtime errors מופיע `UNHANDLED_PROMISE_REJECTION: NEXT_REDIRECT`.

הסיבה: `loginAction` הוא server action שמסיים ב־`redirect('/')`. הפונקציה `redirect()` של Next.js עובדת על ידי זריקת error מיוחד (`NEXT_REDIRECT`). כש־client component מבצע `await loginAction(...)` ואז קורא `result?.error`, ה־`NEXT_REDIRECT` נתפס כ־unhandled rejection במקום להוביל לניווט. בנוסף, הקריאה הזו לא מבצעת `router.refresh()` כדי שה־middleware יראה את ה־session cookies החדשים.

## התיקון

### 1. `src/app/(auth)/login/actions.ts` - `loginAction`
- להחזיר `{ success: true }` במקום לקרוא ל־`redirect('/')`. הניווט יקרה בצד הלקוח אחרי שה־cookies נשמרו.

### 2. `src/app/(auth)/login/page.tsx`
- לקרוא ל־`useRouter` ו־`useSearchParams` מ־`next/navigation`.
- אחרי `loginAction` מוצלח: `router.refresh()` ואז `router.push(next ?? '/')` (כאשר `next` נלקח מה־query param שכבר קיים ב־URL `?next=...`).

### 3. אותו תיקון גם ל־`signupAction` ו־`updatePasswordAction` (אותה בעיה פוטנציאלית) - להחזיר success ולתת ל־client לנווט.

## למה זה יפתור

- ה־server action יסיים נקי, ה־cookies של הסשן ייכתבו דרך ה־`setAll` של ה־cookieStore.
- `router.refresh()` יגרום ל־middleware לרוץ מחדש עם ה־cookies החדשים ולזהות את המשתמש.
- `router.push(next)` ינווט ליעד המקורי (ב־case שלך `/`).

## בדיקה לאחר היישום

1. לוגאאוט.
2. כניסה מחדש עם המייל והסיסמה.
3. צריך להגיע ל־`/` (או ליעד שב־`?next=`) מיד אחרי הלחיצה על "התחבר".
