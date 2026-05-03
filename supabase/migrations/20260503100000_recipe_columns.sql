-- Phase 3.1: Add columns to existing tables
-- menu_items: recipe_id FK
-- recipes:    image_url, instructions_md, video_url

-- ============================================================
-- a. menu_items.recipe_id
-- ============================================================

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_recipe
  ON public.menu_items(recipe_id)
  WHERE recipe_id IS NOT NULL;

-- ============================================================
-- b. recipes extended columns
-- ============================================================

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS image_url      TEXT,
  ADD COLUMN IF NOT EXISTS instructions_md TEXT,
  ADD COLUMN IF NOT EXISTS video_url      TEXT;

-- Rollback:
-- ALTER TABLE public.recipes DROP COLUMN IF EXISTS video_url, DROP COLUMN IF EXISTS instructions_md, DROP COLUMN IF EXISTS image_url;
-- ALTER TABLE public.menu_items DROP COLUMN IF EXISTS recipe_id;
