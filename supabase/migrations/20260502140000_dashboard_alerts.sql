create table if not exists public.alert_rules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  metric       text not null,
  threshold    numeric(10,4) not null,
  operator     text not null check (operator in ('lt','gt','lte','gte')),
  severity     text not null default 'warning' check (severity in ('info','warning','critical')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.alerts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  rule_id         uuid references public.alert_rules(id) on delete set null,
  metric          text not null,
  value           numeric(10,4) not null,
  threshold       numeric(10,4) not null,
  severity        text not null,
  message         text not null,
  acknowledged    boolean not null default false,
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  fired_at        timestamptz not null default now(),
  date            date not null,
  created_at      timestamptz not null default now()
);

create index if not exists alert_rules_tenant on public.alert_rules(tenant_id);
create index if not exists alerts_tenant_date on public.alerts(tenant_id, date);
create index if not exists alerts_tenant_acknowledged on public.alerts(tenant_id, acknowledged);

alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;

create policy "alert_rules_select_member"
  on public.alert_rules for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "alert_rules_insert_manager"
  on public.alert_rules for insert
  with check (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "alert_rules_update_manager"
  on public.alert_rules for update
  using (public.user_role_in(tenant_id) in ('owner', 'manager'))
  with check (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "alert_rules_delete_manager"
  on public.alert_rules for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));

create policy "alerts_select_member"
  on public.alerts for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "alerts_insert_member"
  on public.alerts for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "alerts_update_member"
  on public.alerts for update
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "alerts_delete_manager"
  on public.alerts for delete
  using (public.user_role_in(tenant_id) in ('owner', 'manager'));
