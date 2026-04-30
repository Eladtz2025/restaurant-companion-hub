-- Add pkg_qty to ingredients: how many units per package (e.g. eggs: pkg_qty = 12).
-- NULL means "not a package item" or pkg_qty is unknown.

ALTER TABLE public.ingredients
  ADD COLUMN pkg_qty NUMERIC CHECK (pkg_qty IS NULL OR pkg_qty > 0);
