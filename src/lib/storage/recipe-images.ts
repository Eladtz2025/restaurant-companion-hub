'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

const BUCKET = 'recipe-images';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadRecipeImage(
  tenantId: string,
  recipeId: string,
  file: File,
): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) throw new Error('קובץ גדול מדי — מקסימום 5MB');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('סוג קובץ לא נתמך — JPG, PNG, WebP בלבד');

  const ext = file.type.split('/')[1] ?? 'jpg';
  const path = `${tenantId}/${recipeId}/${Date.now()}.${ext}`;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteRecipeImage(tenantId: string, recipeId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: files } = await supabase.storage.from(BUCKET).list(`${tenantId}/${recipeId}`);

  if (!files || files.length === 0) return;

  const paths = files.map((f) => `${tenantId}/${recipeId}/${f.name}`);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
