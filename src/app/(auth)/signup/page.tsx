'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { signupAction } from '../login/actions';

const schema = z
  .object({
    fullName: z.string().min(2, 'נדרש שם מלא (לפחות 2 תווים)'),
    email: z.string().email('נדרש מייל תקין'),
    password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
    confirmPassword: z.string().min(1, 'אשר את הסיסמה'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'הסיסמאות אינן תואמות',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const formData = new FormData();
    formData.set('email', values.email);
    formData.set('password', values.password);
    formData.set('fullName', values.fullName);
    const result = await signupAction(formData);
    if (result?.error) setServerError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">יצירת חשבון</h1>

      {serverError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium">
          שם מלא
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          {...register('fullName')}
          className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
      </div>

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
        {isSubmitting ? 'נרשם...' : 'הירשם'}
      </button>

      <p className="text-muted-foreground text-center text-sm">
        כבר יש לך חשבון?{' '}
        <Link href="/login" className="text-foreground font-medium hover:underline">
          כניסה
        </Link>
      </p>
    </form>
  );
}
