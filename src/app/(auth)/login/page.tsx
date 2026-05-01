'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('נדרש מייל תקין'),
  password: z.string().min(1, 'נדרשת סיסמה'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError('אימייל או סיסמה שגויים');
      return;
    }

    const next = searchParams.get('next') ?? '/';
    window.location.assign(next);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">כניסה למערכת</h1>

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          {...register('password')}
          className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
        <Link
          href="/reset-password"
          className="text-muted-foreground hover:text-foreground mt-0.5 self-start text-xs"
        >
          שכחת סיסמה?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {isSubmitting ? 'מתחבר...' : 'התחבר'}
      </button>

      <p className="text-muted-foreground text-center text-sm">
        אין לך חשבון?{' '}
        <Link href="/signup" className="text-foreground font-medium hover:underline">
          הירשם
        </Link>
      </p>
    </form>
  );
}
