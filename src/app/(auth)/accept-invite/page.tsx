'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

const schema = z
  .object({
    password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
    confirmPassword: z.string().min(1, 'אשר את הסיסמה'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'הסיסמאות אינן תואמות',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setServerError('שגיאה בהגדרת הסיסמה. נסה שוב.');
    } else {
      router.push('/');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">ברוך הבא לצוות!</h1>
        <p className="text-muted-foreground mt-1 text-sm">הגדר סיסמה כדי להתחיל</p>
      </div>

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
          סיסמה
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
        {isSubmitting ? 'שומר...' : 'הגדר סיסמה והתחל'}
      </button>
    </form>
  );
}
