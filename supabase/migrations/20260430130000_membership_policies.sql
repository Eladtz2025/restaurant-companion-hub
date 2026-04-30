-- Extended RLS policies for memberships table.
-- Owners can invite (INSERT), update roles (UPDATE), and remove members (DELETE).

-- Allow owners to view all members in their tenants.
create policy "memberships_select_tenant_owner"
  on public.memberships
  for select
  using (
    public.user_role_in(tenant_id) = 'owner'
  );

-- Allow managers to view all members in their tenants.
create policy "memberships_select_tenant_manager"
  on public.memberships
  for select
  using (
    public.user_role_in(tenant_id) = 'manager'
  );

-- Only owners can insert new memberships.
create policy "memberships_insert_owner"
  on public.memberships
  for insert
  with check (
    public.user_role_in(tenant_id) = 'owner'
  );

-- Only owners can change a member's role.
create policy "memberships_update_owner"
  on public.memberships
  for update
  using (
    public.user_role_in(tenant_id) = 'owner'
  )
  with check (
    public.user_role_in(tenant_id) = 'owner'
  );

-- Owners can remove members, but cannot remove themselves (last-owner guard handled in app layer).
create policy "memberships_delete_owner"
  on public.memberships
  for delete
  using (
    public.user_role_in(tenant_id) = 'owner'
    and user_id <> auth.uid()
  );

-- Rollback:
-- drop policy "memberships_select_tenant_owner" on public.memberships;
-- drop policy "memberships_select_tenant_manager" on public.memberships;
-- drop policy "memberships_insert_owner" on public.memberships;
-- drop policy "memberships_update_owner" on public.memberships;
-- drop policy "memberships_delete_owner" on public.memberships;
