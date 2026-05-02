create table if not exists public.manager_overrides (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  entity_type    text not null check (entity_type in ('prep_task')),
  entity_id      uuid not null,
  field          text not null,          -- e.g. 'qty_required'
  original_value jsonb not null,         -- the value before override
  override_value jsonb not null,         -- the new value
  reason         text,
  overridden_by  uuid not null references auth.users(id),
  reverted       boolean not null default false,
  reverted_by    uuid references auth.users(id),
  reverted_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists manager_overrides_entity on public.manager_overrides(entity_type, entity_id);
create index if not exists manager_overrides_tenant on public.manager_overrides(tenant_id, created_at desc);

alter table public.manager_overrides enable row level security;

create policy "manager_overrides_select_member"
  on public.manager_overrides for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "manager_overrides_insert_manager"
  on public.manager_overrides for insert
  with check (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "manager_overrides_update_manager"
  on public.manager_overrides for update
  using (public.user_role_in(tenant_id) in ('owner', 'manager'))
  with check (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "manager_overrides_delete_manager"
  on public.manager_overrides for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));
