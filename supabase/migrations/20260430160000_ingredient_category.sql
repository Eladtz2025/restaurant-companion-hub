-- Add category column to ingredients table
ALTER TABLE public.ingredients
  ADD COLUMN category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('produce', 'meat', 'fish', 'dairy', 'dry', 'alcohol', 'other'));
