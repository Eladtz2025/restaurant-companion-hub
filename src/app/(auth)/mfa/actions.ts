'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function enrollMFAAction() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

  if (error) {
    return { error: 'שגיאה בהפעלת אימות דו-שלבי. נסה שוב.' };
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMFAAction(factorId: string, code: string) {
  const supabase = await createServerSupabaseClient();

  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError) {
    return { error: 'שגיאה ביצירת אתגר MFA. נסה שוב.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    return { error: 'קוד שגוי. נסה שוב.' };
  }

  return { success: true };
}

export async function challengeMFAAction(factorId: string, code: string) {
  const supabase = await createServerSupabaseClient();

  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError) {
    return { error: 'שגיאה ביצירת אתגר. נסה שוב.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    return { error: 'קוד שגוי. נסה שוב.' };
  }

  return { success: true };
}
