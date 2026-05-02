import { createServerSupabaseClient } from '@/lib/supabase/server';

const BUCKET = 'signatures';
const MAX_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export async function uploadSignature(
  tenantId: string,
  completionId: string,
  file: File,
): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error('Signature file too large (max 1MB)');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type');

  const ext = file.type.split('/')[1];
  const path = `${tenantId}/${completionId}.${ext}`;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
