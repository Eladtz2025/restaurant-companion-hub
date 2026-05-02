create table if not exists public.checklists (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  shift      text not null check (shift in ('morning','afternoon','evening','night')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  text         text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.checklist_completions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  checklist_id    uuid not null references public.checklists(id) on delete cascade,
  completion_date date not null,
  completed_by    uuid references auth.users(id),
  signature_url   text,
  completed_items jsonb not null default '[]',
  notes           text,
  status          text not null default 'pending' check (status in ('pending','partial','completed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, checklist_id, completion_date)
);

create index if not exists checklists_tenant on public.checklists(tenant_id);
create index if not exists checklist_items_checklist on public.checklist_items(checklist_id);
create index if not exists checklist_completions_tenant_date on public.checklist_completions(tenant_id, completion_date);
create index if not exists checklist_completions_checklist on public.checklist_completions(checklist_id);

alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_completions enable row level security;

create policy "checklists_select_member"
  on public.checklists for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "checklists_insert_member"
  on public.checklists for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "checklists_update_member"
  on public.checklists for update
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "checklists_delete_manager"
  on public.checklists for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "checklist_items_select_member"
  on public.checklist_items for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "checklist_items_insert_member"
  on public.checklist_items for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "checklist_items_update_member"
  on public.checklist_items for update
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "checklist_items_delete_manager"
  on public.checklist_items for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "checklist_completions_select_member"
  on public.checklist_completions for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "checklist_completions_insert_member"
  on public.checklist_completions for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "checklist_completions_update_member"
  on public.checklist_completions for update
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "checklist_completions_delete_manager"
  on public.checklist_completions for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));

create trigger checklists_set_updated_at
  before update on public.checklists
  for each row execute function public.set_updated_at();

create trigger checklist_completions_set_updated_at
  before update on public.checklist_completions
  for each row execute function public.set_updated_at();
