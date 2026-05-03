REVOKE EXECUTE ON FUNCTION public.user_tenant_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_role_in(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role_in(UUID) TO authenticated;