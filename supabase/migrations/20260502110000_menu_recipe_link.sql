ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_recipe ON menu_items(recipe_id) WHERE recipe_id IS NOT NULL;
