-- JWT custom claims hook: embed tenant_id and role in every access token.
-- Registered in config.toml as [auth.hook.custom_access_token].

create or replace function auth.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = auth, public
as $$
declare
  v_user_id   uuid;
  v_tenant_id uuid;
  v_role      text;
  v_claims    jsonb;
begin
  v_user_id := (event ->> 'user_id')::uuid;

  -- Look up the user's primary tenant membership.
  -- If the user belongs to multiple tenants, this returns the first one
  -- (oldest by created_at). The client can force a re-issue via token refresh
  -- after switching tenant context (future: pass tenant_id hint in the event).
  select tm.tenant_id, tm.role
    into v_tenant_id, v_role
    from public.tenant_members tm
   where tm.user_id = v_user_id
   order by tm.created_at
   limit 1;

  v_claims := event -> 'claims';

  if v_tenant_id is not null then
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role));
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Grant execute to the supabase_auth_admin role used by the GoTrue process.
grant execute
  on function auth.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke execute
  on function auth.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- Rollback: drop function auth.custom_access_token_hook(jsonb);
