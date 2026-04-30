-- a. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- b. tenants table (no tenant_id, no RLS — this IS the tenant table)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- c. memberships table
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'chef', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_memberships_user_id ON public.memberships (user_id);
CREATE INDEX idx_memberships_tenant_id ON public.memberships (tenant_id);

-- d. Helper function: user_tenant_ids()
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
$$;

-- e. Helper function: user_role_in(uuid)
CREATE OR REPLACE FUNCTION public.user_role_in(p_tenant_id UUID)
  RETURNS TEXT
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT role
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
$$;

-- f. _audit_log table
CREATE TABLE public._audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants (id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_id ON public._audit_log (tenant_id);
CREATE INDEX idx_audit_log_created_at ON public._audit_log (created_at);

-- g. Trigger function: set_updated_at()
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_set_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- h. Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- tenants: users can SELECT tenants they are a member of
CREATE POLICY "tenants_select_own"
  ON public.tenants
  FOR SELECT
  USING (id IN (SELECT public.user_tenant_ids()));

-- memberships: users can SELECT their own memberships
CREATE POLICY "memberships_select_own"
  ON public.memberships
  FOR SELECT
  USING (user_id = auth.uid());
