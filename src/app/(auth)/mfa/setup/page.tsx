'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { enrollMFAAction, verifyMFAAction } from '../actions';

type EnrollData = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function MFASetupPage() {
  const router = useRouter();
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);

  useEffect(() => {
    enrollMFAAction().then((result) => {
      setEnrolling(false);
      if ('error' in result) {
        setError(result.error ?? 'שגיאה לא ידועה');
      } else {
        setEnrollData(result as EnrollData);
      }
    });
  }, []);

  async function handleVerify() {
    if (!enrollData || code.length !== 6) return;
    setLoading(true);
    setError(null);
    const result = await verifyMFAAction(enrollData.factorId, code);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push('/');
    }
  }

  if (enrolling) {
    return <p className="text-muted-foreground text-sm">טוען...</p>;
  }

  if (!enrollData) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">שגיאה</h1>
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">הגדרת אימות דו-שלבי</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          סרוק את קוד ה-QR עם אפליקציית האימות שלך (Google Authenticator, Authy וכו׳)
        </p>
      </div>

      <div className="flex justify-center">
        <Image
          src={enrollData.qrCode}
          alt="QR code for MFA setup"
          width={200}
          height={200}
          className="rounded-md border"
          unoptimized
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">קוד ידני (אם לא ניתן לסרוק):</p>
        <code className="bg-muted rounded px-2 py-1 text-xs break-all" dir="ltr">
          {enrollData.secret}
        </code>
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
          הזן קוד אימות (6 ספרות)
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          dir="ltr"
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
        {loading ? 'מאמת...' : 'אמת ופעל'}
      </button>
    </div>
  );
}
