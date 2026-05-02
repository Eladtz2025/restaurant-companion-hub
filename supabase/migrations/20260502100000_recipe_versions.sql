CREATE TABLE recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot_data JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version)
);
CREATE INDEX idx_recipe_versions_recipe ON recipe_versions(recipe_id);
ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can read recipe versions"
  ON recipe_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.tenant_id = recipe_versions.tenant_id
    AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "tenant members can insert recipe versions"
  ON recipe_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.tenant_id = recipe_versions.tenant_id
    AND memberships.user_id = auth.uid()
  ));

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS current_version INT NOT NULL DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instructions_md TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS video_url TEXT;
