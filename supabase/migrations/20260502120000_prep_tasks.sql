create table if not exists public.prep_tasks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  prep_date     date not null,
  qty_required  numeric(10,3) not null check (qty_required >= 0),
  qty_actual    numeric(10,3),
  unit          text not null,
  status        text not null default 'pending' check (status in ('pending','in_progress','done','skipped')),
  notes         text,
  assigned_to   uuid references auth.users(id),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, recipe_id, prep_date)
);

create index if not exists prep_tasks_tenant_date on public.prep_tasks(tenant_id, prep_date);
create index if not exists prep_tasks_recipe on public.prep_tasks(recipe_id);

alter table public.prep_tasks enable row level security;

create policy "prep_tasks_select_member"
  on public.prep_tasks for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "prep_tasks_insert_member"
  on public.prep_tasks for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "prep_tasks_update_member"
  on public.prep_tasks for update
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "prep_tasks_delete_manager"
  on public.prep_tasks for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));

create trigger prep_tasks_set_updated_at
  before update on public.prep_tasks
  for each row execute function public.set_updated_at();
