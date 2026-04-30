'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'אימייל או סיסמה שגויים' };
  }

  redirect('/');
}

export async function signupAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'כתובת האימייל כבר רשומה במערכת' };
    }
    return { error: 'שגיאה ביצירת החשבון. נסה שוב.' };
  }

  redirect('/onboarding');
}

export async function resetPasswordAction(formData: FormData) {
  const email = formData.get('email') as string;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/reset-password`,
  });

  if (error) {
    return { error: 'שגיאה בשליחת הדואר. בדוק את כתובת האימייל ונסה שוב.' };
  }

  return { success: true };
}

export async function updatePasswordAction(formData: FormData) {
  const password = formData.get('password') as string;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: 'שגיאה בעדכון הסיסמה. נסה שוב.' };
  }

  redirect('/');
}
