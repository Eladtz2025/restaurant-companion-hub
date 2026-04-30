import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { MFASecurityPanel } from './MFASecurityPanel';

export default async function SecuritySettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const mfaEnabled = (factors?.totp ?? []).some((f) => f.status === 'verified');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">הגדרות אבטחה</h1>
      <MFASecurityPanel mfaEnabled={mfaEnabled} />
    </div>
  );
}
