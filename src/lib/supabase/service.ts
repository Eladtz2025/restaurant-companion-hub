import { createClient } from '@supabase/supabase-js';

import type { Database } from './types';

export function createServiceSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceSupabaseClient must only be called on the server.');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
