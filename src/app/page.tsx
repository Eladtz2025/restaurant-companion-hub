import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenants(slug)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const slug = (membership?.tenants as { slug: string } | null)?.slug;

  if (slug) {
    redirect(`/${slug}`);
  }

  // No tenant yet — bootstrap via setup endpoint
  redirect('/api/setup');
}
