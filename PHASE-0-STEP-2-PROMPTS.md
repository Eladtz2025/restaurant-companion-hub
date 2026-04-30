# Phase 0 · Step 0.2 — Auth Flow, JWT, MFA

> **Goal:** Full authentication system. Users can sign up, log in, reset password, set up MFA, and be placed in the correct tenant context. JWT carries tenant_id and role as custom claims.

---

## Pre-flight check

Before starting any task, run these commands and verify the expected state:

```
git log --oneline -5
ls -la src/
ls -la src/lib/supabase/
cat src/lib/tenant.ts | head -20
```

Expected state:
- `src/lib/supabase/server.ts`, `browser.ts`, `service.ts` exist
- `src/lib/tenant.ts` exists with `requireTenant` function
- `src/lib/permissions.ts` exists
- Supabase is running locally (`pnpm db:start` works)
- Last commit is from Step 0.1

If anything is missing, stop and report before proceeding.

---

## Task 1 — JWT Custom Claims

### Context to load
- `ARCHITECTURE.md` §4 (Multi-Tenancy), §6 (Auth)
- `docs/adr/0001-postgres-rls-multi-tenant.md`
- `src/lib/supabase/` (existing clients)

### Prompt for Claude Code

Add tenant_id and role as custom claims to the Supabase JWT so every authenticated request carries tenant context.

Requirements:

1. Create a Supabase Auth Hook (Database Function) that fires on every token refresh and injects custom claims:
   ```sql
   -- supabase/migrations/{timestamp}_jwt_custom_claims.sql
   CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
   RETURNS jsonb
   LANGUAGE plpgsql STABLE
   AS $$
   DECLARE
     claims jsonb;
     user_tenant_id uuid;
     user_role text;
   BEGIN
     claims := event -> 'claims';
     
     SELECT m.tenant_id, m.role
     INTO user_tenant_id, user_role
     FROM memberships m
     WHERE m.user_id = (event->>'user_id')::uuid
     LIMIT 1;
     
     IF user_tenant_id IS NOT NULL THEN
       claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::text));
       claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
     END IF;
     
     RETURN jsonb_set(event, '{claims}', claims);
   END;
   $$;
   ```
   
2. Register the hook in `supabase/config.toml`:
   ```toml
   [auth.hook.custom_access_token]
   enabled = true
   uri = "pg-functions://postgres/public/custom_access_token_hook"
   ```

3. Update `src/lib/supabase/server.ts` — add helper `getAuthContext()`:
   ```typescript
   export async function getAuthContext() {
     const supabase = createServerClient();
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return null;
     
     const jwt = await supabase.auth.getSession();
     const claims = jwt.data.session?.access_token 
       ? JSON.parse(atob(jwt.data.session.access_token.split('.')[1]))
       : null;
     
     return {
       userId: user.id,
       email: user.email,
       tenantId: claims?.tenant_id ?? null,
       role: claims?.role ?? null,
     };
   }
   ```

4. Update `src/lib/tenant.ts` — `requireTenant()` now reads from JWT claims first (faster than DB query), falls back to DB.

5. Write pgTAP test: `supabase/tests/jwt_claims.sql`
   - Verify custom claims are present after login
   - Verify tenant_id in claims matches membership

Do NOT:
- Store sensitive data in JWT (no passwords, no PII beyond IDs).
- Use the service role key to read JWT secrets.
- Add claims for users without a membership (return token unchanged).

### Validation
- [ ] `pnpm db:reset` applies the new migration cleanly
- [ ] Log in as `owner@example.com`, decode the JWT (use jwt.io), confirm `tenant_id` and `role` fields are present
- [ ] `pnpm db:test` passes including new JWT tests
- [ ] `getAuthContext()` returns correct tenantId and role in a server component

### Commit
`feat(auth): JWT custom claims with tenant_id and role`

### Branch
`feat/phase-0-step-2-task-1`

---

## Task 2 — Auth Pages UI

### Context to load
- `ARCHITECTURE.md` §17 (Frontend)
- `docs/adr/0003-pwa-not-native.md`
- Existing `src/app/(auth)/` directory

### Prompt for Claude Code

Build the authentication pages: login, signup, password reset. Hebrew RTL, clean design.

Requirements:

1. Install auth dependencies:
   - `@supabase/ssr` (if not already installed from Step 0.1)

2. Create `src/app/(auth)/layout.tsx`:
   - Centered card layout, max-width 400px
   - Restaurant OS logo placeholder (text-based for now)
   - RTL Hebrew by default
   - No sidebar, no topbar

3. Create `src/app/(auth)/login/page.tsx`:
   - Fields: email, password
   - "התחבר" button (primary)
   - Link to signup: "אין לך חשבון? הירשם"
   - Link to password reset: "שכחת סיסמה?"
   - Error states in Hebrew: "אימייל או סיסמה שגויים", "נדרש מייל תקין"
   - On success: redirect to `/` (home)
   - Use React Hook Form + Zod for validation
   - Loading state on button during submission

4. Create `src/app/(auth)/signup/page.tsx`:
   - Fields: email, password, confirm password, full name
   - "הירשם" button
   - On success: redirect to `/onboarding` (placeholder route for now)
   - Validation in Hebrew

5. Create `src/app/(auth)/reset-password/page.tsx`:
   - Step 1: email input → send reset link
   - Step 2: new password + confirm (when user arrives with token)
   - Hebrew copy throughout

6. Create `src/middleware.ts`:
   - Protect all routes under `/(app)/` — redirect to `/login` if not authenticated
   - Allow public routes: `/login`, `/signup`, `/reset-password`, `/api/inngest`, `/api/_*`
   - Use Supabase Auth middleware helper

7. Create `src/app/(auth)/login/actions.ts` (Server Actions):
   - `loginAction(formData)` — calls `supabase.auth.signInWithPassword`
   - `signupAction(formData)` — calls `supabase.auth.signUp`
   - `resetPasswordAction(formData)` — calls `supabase.auth.resetPasswordForEmail`

Do NOT:
- Use client-side only auth. All auth actions must be Server Actions.
- Store session in localStorage. Supabase SSR uses cookies only.
- Show technical error messages to users. Map all errors to Hebrew copy.
- Add social login (Google, GitHub) — not in V1.

### Validation
- [ ] `/login` renders correctly in RTL with Hebrew labels
- [ ] Login with `owner@example.com` / `password123` (seed data) succeeds and redirects to `/`
- [ ] Login with wrong password shows Hebrew error message
- [ ] Accessing `/(app)/` when logged out redirects to `/login`
- [ ] Middleware does NOT block `/api/inngest` or `/api/_observability-test`

### Commit
`feat(auth): login, signup, password reset pages with RTL Hebrew`

### Branch
`feat/phase-0-step-2-task-2`

---

## Task 3 — MFA Setup Flow

### Context to load
- `ARCHITECTURE.md` §6.3 (MFA)
- `src/app/(auth)/` (existing pages)

### Prompt for Claude Code

Add TOTP-based MFA setup and enforcement for owner and manager roles.

Requirements:

1. Create `src/app/(app)/settings/security/page.tsx`:
   - Show MFA status: enabled / not enabled
   - If not enabled: "הפעל אימות דו-שלבי" button
   - If enabled: "בטל אימות דו-שלבי" button (with confirmation)

2. Create MFA enrollment flow at `src/app/(auth)/mfa/setup/page.tsx`:
   - Call `supabase.auth.mfa.enroll({ factorType: 'totp' })`
   - Display QR code for scanning with authenticator app
   - Show manual entry code below QR
   - Input field for 6-digit verification code
   - "אמת ופעל" button
   - On success: redirect to home

3. Create MFA challenge page at `src/app/(auth)/mfa/challenge/page.tsx`:
   - Shown after login if user has MFA enabled
   - 6-digit code input
   - "אמת" button
   - Error: "קוד שגוי. נסה שוב."

4. Update `src/middleware.ts`:
   - After auth check: if user has MFA factor enrolled but not verified in this session → redirect to `/mfa/challenge`
   - If user is `owner` or `manager` and MFA not enrolled → redirect to `/mfa/setup` (soft enforcement: show banner first, hard redirect after 7 days — implement the banner only for now)

5. Create MFA server actions in `src/app/(auth)/mfa/actions.ts`:
   - `enrollMFAAction()` — initiates enrollment, returns QR data
   - `verifyMFAAction(code)` — verifies and activates
   - `challengeMFAAction(code)` — verifies session challenge

6. Add MFA status indicator in settings page.

Do NOT:
- Implement SMS MFA. TOTP only.
- Force hard redirect to MFA setup in this step (banner only).
- Build the full settings page — only the security tab.

### Validation
- [ ] Log in as `owner@example.com`, go to `/settings/security`, see MFA setup option
- [ ] Complete MFA enrollment with a real authenticator app (Google Authenticator)
- [ ] Log out and log back in — MFA challenge page appears
- [ ] Correct code passes, wrong code shows Hebrew error
- [ ] Middleware correctly redirects MFA-enrolled users to challenge page

### Commit
`feat(auth): TOTP MFA enrollment and challenge flow`

### Branch
`feat/phase-0-step-2-task-3`

---

## Task 4 — Membership Management

### Context to load
- `ARCHITECTURE.md` §4, §6
- `src/lib/permissions.ts`
- `src/lib/tenant.ts`

### Prompt for Claude Code

Build the ability to invite users to a tenant and manage their roles.

Requirements:

1. Create `supabase/migrations/{timestamp}_membership_policies.sql`:
   - Add INSERT policy on `memberships`: only `owner` can add members
   - Add UPDATE policy: only `owner` can change roles
   - Add DELETE policy: only `owner` can remove members (cannot remove self)

2. Create `src/app/(app)/[tenantSlug]/settings/team/page.tsx`:
   - Table of current members: name, email, role, joined date, actions
   - "הזמן חבר צוות" button (owner only)
   - Role badge per member (color-coded: owner=purple, manager=blue, chef=green, staff=gray)
   - Remove member button (owner only, cannot remove self)

3. Create invite flow:
   - Modal: email input + role selector
   - Server Action: `inviteMemberAction({ email, role, tenantSlug })`
     - Check caller is owner
     - Call `supabase.auth.admin.inviteUserByEmail()` with metadata `{ tenantSlug, role }`
     - Create pending membership record
   - Invited user receives email, clicks link, completes signup, membership activates

4. Create `src/app/(auth)/accept-invite/page.tsx`:
   - Handles the invite link
   - User sets password
   - Membership is activated
   - Redirect to home

5. Update `src/lib/tenant.ts`:
   - Add `getUserRole(tenantId, userId)` helper
   - Add `assertRole(ctx, ...allowedRoles)` — throws if caller's role not in list

6. Add role-based UI guards:
   - `<IfRole roles={['owner', 'manager']}>` component that conditionally renders children
   - Use in team settings to hide admin actions from non-owners

Do NOT:
- Allow a user to change their own role.
- Allow removing the last owner of a tenant.
- Send invite emails in dev — Supabase local uses Inbucket (http://localhost:54324).

### Validation
- [ ] Owner can see team settings page
- [ ] Manager cannot see "הזמן" or "הסר" buttons (UI guards work)
- [ ] Invite flow works end-to-end in local (use Inbucket at localhost:54324 to receive email)
- [ ] `assertRole` throws correctly when called with wrong role
- [ ] Cannot remove last owner (error state shown)

### Commit
`feat(auth): membership management with invite flow and role guards`

### Branch
`feat/phase-0-step-2-task-4`

---

## End of Step 0.2

When Task 4 is committed, Step 0.2 is complete. Read `TIMELINE.md` — the next step is 0.3. Check if `PHASE-0-STEP-3-PROMPTS.md` exists in the repo root. If it does, load it and begin. If it does not, stop and wait for Elad.
