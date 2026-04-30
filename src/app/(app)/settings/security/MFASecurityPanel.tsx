'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Props = { mfaEnabled: boolean };

export function MFASecurityPanel({ mfaEnabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDisable() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((f) => f.status === 'verified');
    if (!factor) {
      setLoading(false);
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setLoading(false);
    if (unenrollError) {
      setError('שגיאה בביטול האימות הדו-שלבי. נסה שוב.');
    } else {
      setEnabled(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">אימות דו-שלבי (TOTP)</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {enabled
              ? 'האימות הדו-שלבי פעיל. כניסתך מוגנת ברמה גבוהה.'
              : 'הפעל אימות דו-שלבי כדי לאבטח את החשבון שלך.'}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
          }`}
        >
          {enabled ? 'פעיל' : 'לא פעיל'}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {error}
        </div>
      )}

      {!enabled && (
        <Link
          href="/mfa/setup"
          className="bg-primary text-primary-foreground inline-flex justify-center rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          הפעל אימות דו-שלבי
        </Link>
      )}

      {enabled && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex justify-center rounded-md border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
        >
          בטל אימות דו-שלבי
        </button>
      )}

      {enabled && showConfirm && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-md border p-4">
          <p className="text-sm font-medium">האם לבטל את האימות הדו-שלבי?</p>
          <p className="text-muted-foreground text-xs">
            ביטול האימות הדו-שלבי יחשוף את חשבונך לסיכון גבוה יותר.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDisable}
              disabled={loading}
              className="bg-destructive text-destructive-foreground rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-60"
            >
              {loading ? 'מבטל...' : 'בטל'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-md border px-4 py-1.5 text-sm font-medium"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
