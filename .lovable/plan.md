
# הקמת מבנה הריפו — תשתית תיעוד וארכיטקטורה

## מה ייבנה

העתקת כל הקבצים שהעלית למבנה הבא בריפו:

```text
restaurant-os/
├── .env.example
├── ARCHITECTURE.md          ← placeholder עם כותרות ריקות למילוי
├── PHASING.md               ← placeholder עם כותרות ריקות למילוי
└── docs/
    └── adr/
        ├── README.md
        ├── 0001-postgres-rls-multi-tenant.md
        ├── 0002-supabase-platform.md
        ├── 0003-pwa-not-native.md
        ├── 0004-claude-primary-llm.md
        ├── 0005-playwright-scraping.md
        ├── 0006-inngest-jobs.md
        ├── 0007-monolith-architecture.md
        ├── 0008-ai-gateway-pattern.md
        ├── 0009-adapter-pattern.md
        └── 0010-lovable-claude-code-workflow.md
```

## פרטים

1. **10 ADRs + README** — יועתקו כמו שהם, בלי שינויים. זה התיעוד ההיסטורי שלך ואין סיבה לערוך אותו.

2. **.env.example** — יועתק כמו שהוא לשורש הפרויקט.

3. **ARCHITECTURE.md** — placeholder עם סעיפים ריקים (Overview, System Architecture, Tech Stack, Domain Structure, Data Flow, Security, AI Gateway, Integrations). אתה או Claude Code תמלאו אותו.

4. **PHASING.md** — placeholder עם סעיפים ריקים (Phase 1-9, Milestones, Dependencies). אתה או Claude Code תמלאו אותו.

5. **הערה חשובה על הסטאק**: ה-ADRs מתארים Next.js + Vercel. בפועל ב-Lovable הסטאק הוא TanStack Start + Cloudflare Workers. ה-ADRs נשארים כתיעוד היסטורי. כשתגיעו לבנות פיצ'רים, ההתאמות יהיו:
   - `createServerFn` במקום Next.js API Routes / Server Actions
   - Server routes (`/api/public/*`) במקום Edge Functions לוובהוקים
   - Lovable Cloud או Supabase Integration (חיצוני) במקום Supabase ישיר

## מה לעשות אחרי האישור

- **אתה**: חבר GitHub דרך Connectors → GitHub → Connect project
- **אתה**: חבר Supabase החיצוני דרך Supabase Integration
- **אתה**: הגדר Claude Code על הריפו ב-GitHub
- **אתה/Claude Code**: מלא את ARCHITECTURE.md ו-PHASING.md
