DO $$
DECLARE
  v_user_id UUID := '40148836-5f56-4691-8d63-4baea88a286c';
  v_tenant_id UUID;
BEGIN
  INSERT INTO public.tenants (name, slug)
    VALUES ('המסעדה שלי', 'my-restaurant')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_tenant_id;

  INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'owner')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
END $$;