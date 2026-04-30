import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from './types';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — cookies can't be set.
            // Middleware handles session refresh instead.
          }
        },
      },
    },
  );
}

export type AuthContext = {
  userId: string;
  tenantId: string | null;
  role: string | null;
};

/**
 * Decodes the JWT custom claims injected by auth.custom_access_token_hook.
 * Falls back to null claims when the user has no tenant membership yet
 * (e.g. immediately after sign-up, before the first tenant is created).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Custom claims live in user_metadata mirror in the JWT payload.
  // Supabase exposes them via the app_metadata field on the User object
  // when read server-side (service role not needed — anon client returns them
  // from the verified JWT).
  const claims = user.app_metadata as {
    tenant_id?: string;
    user_role?: string;
  };

  return {
    userId: user.id,
    tenantId: claims.tenant_id ?? null,
    role: claims.user_role ?? null,
  };
}
