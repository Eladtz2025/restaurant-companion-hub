'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

import { challengeMFAAction } from '../actions';

export default function MFAChallengePageClient() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setLoadingFactors(false);
      const totpFactor = data?.totp?.find((f) => f.status === 'verified');
      if (totpFactor) setFactorId(totpFactor.id);
    });
  }, []);

  async function handleVerify() {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    setError(null);
    const result = await challengeMFAAction(factorId, code);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push('/');
    }
  }

  if (loadingFactors) {
    return <p className="text-muted-foreground text-sm">טוען...</p>;
  }

  if (!factorId) {
    // No enrolled TOTP factor — skip MFA challenge and send to home.
    router.push('/');
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">אימות דו-שלבי</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          פתח את אפליקציית האימות שלך והזן את הקוד המוצג
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium">
          קוד אימות
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          dir="ltr"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-center text-sm tracking-widest outline-none focus:ring-2"
        />
      </div>

      <button
        onClick={handleVerify}
        disabled={loading || code.length !== 6}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? 'מאמת...' : 'אמת'}
      </button>
    </div>
  );
}
