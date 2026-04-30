'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { resetPasswordAction, updatePasswordAction } from '../login/actions';

// ── Step 1: request reset link ────────────────────────────────────────────────

const requestSchema = z.object({
  email: z.string().email('נדרש מייל תקין'),
});
type RequestValues = z.infer<typeof requestSchema>;

function RequestResetForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });

  async function onSubmit(values: RequestValues) {
    setServerError(null);
    const formData = new FormData();
    formData.set('email', values.email);
    const result = await resetPasswordAction(formData);
    if (result?.error) {
      setServerError(result.error);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">בדוק את תיבת הדואר שלך</h1>
        <p className="text-muted-foreground text-sm">
          שלחנו אליך קישור לאיפוס הסיסמה. הקישור תקף ל-60 דקות.
        </p>
        <Link href="/login" className="text-sm font-medium hover:underline">
          חזרה לכניסה
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">שכחת סיסמה?</h1>
      <p className="text-muted-foreground text-sm">הזן את האימייל שלך ונשלח לך קישור לאיפוס.</p>

      {serverError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          {...register('email')}
          className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {isSubmitting ? 'שולח...' : 'שלח קישור לאיפוס'}
      </button>

      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground text-center text-sm"
      >
        חזרה לכניסה
      </Link>
    </form>
  );
}

// ── Step 2: set new password (arrived via email link) ─────────────────────────

const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
    confirmPassword: z.string().min(1, 'אשר את הסיסמה'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'הסיסמאות אינן תואמות',
    path: ['confirmPassword'],
  });
type NewPasswordValues = z.infer<typeof newPasswordSchema>;

function UpdatePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) });

  async function onSubmit(values: NewPasswordValues) {
    setServerError(null);
    const formData = new FormData();
    formData.set('password', values.password);
    const result = await updatePasswordAction(formData);
    if (result?.error) setServerError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">הגדרת סיסמה חדשה</h1>

      {serverError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          סיסמה חדשה
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          {...register('password')}
          className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          אימות סיסמה
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          {...register('confirmPassword')}
          className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {isSubmitting ? 'שומר...' : 'שמור סיסמה'}
      </button>
    </form>
  );
}

// ── Router: pick step based on query params set by Supabase email link ────────

function ResetPasswordRouter() {
  const params = useSearchParams();
  // Supabase sets `type=recovery` in the URL after the user clicks the email link.
  const isRecovery = params.get('type') === 'recovery';
  return isRecovery ? <UpdatePasswordForm /> : <RequestResetForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm">טוען...</div>}>
      <ResetPasswordRouter />
    </Suspense>
  );
}
