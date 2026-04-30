import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/reset-password',
  '/mfa/challenge',
  '/mfa/setup',
  '/api/inngest',
  '/api/_',
  '/_next',
  '/favicon',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // MFA enforcement: if user has an enrolled (verified) TOTP factor but the
  // current session does not have AAL2, redirect to the challenge page.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const challengeUrl = request.nextUrl.clone();
    challengeUrl.pathname = '/mfa/challenge';
    return NextResponse.redirect(challengeUrl);
  }

  // MFA setup nudge: if the user's role is owner or manager and they have no
  // enrolled MFA factor, set a header so the app shell can show a banner.
  // Hard redirect is deferred until 7 days after account creation (future task).
  const role = (user.app_metadata as { user_role?: string })?.user_role;
  if (role === 'owner' || role === 'manager') {
    const hasEnrolled = aal?.currentLevel === 'aal2' || aal?.nextLevel === 'aal2';
    if (!hasEnrolled) {
      response.headers.set('x-mfa-nudge', '1');
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
