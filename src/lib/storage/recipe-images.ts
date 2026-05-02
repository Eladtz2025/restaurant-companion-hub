'use server';

/**
 * Recipe image storage helpers.
 *
 * NOTE: This is a stub. Backend wiring (Supabase Storage bucket + policies)
 * is owned by the orchestrator phase. These functions throw at runtime until
 * the bucket is provisioned and the implementation is filled in.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

const BUCKET = 'recipe-images';

export async function uploadRecipeImage(
  tenantId: string,
  recipeId: string,
  file: File,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${tenantId}/${recipeId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteRecipeImage(
  tenantId: string,
  recipeId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const prefix = `${tenantId}/${recipeId}`;
  const { data: list, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(prefix);
  if (listErr) throw new Error(listErr.message);
  if (!list || list.length === 0) return;

  const paths = list.map((f) => `${prefix}/${f.name}`);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
