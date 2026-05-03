-- Phase 3.1: Storage buckets for recipe images and checklist signatures

-- ============================================================
-- a. recipe-images bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "recipe_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-images');

CREATE POLICY "recipe_images_insert_member"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "recipe_images_delete_owner"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recipe-images'
    AND auth.uid() = owner
  );

-- ============================================================
-- b. checklist-signatures bucket (private)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-signatures',
  'checklist-signatures',
  false,
  1048576,  -- 1 MB
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "signatures_select_member"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-signatures'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "signatures_insert_member"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-signatures'
    AND auth.role() = 'authenticated'
  );

-- Rollback:
-- DELETE FROM storage.buckets WHERE id IN ('recipe-images', 'checklist-signatures');
