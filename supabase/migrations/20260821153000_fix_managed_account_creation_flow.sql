-- Keep managed-account profile writes behind a service-role-only RPC.
-- The Edge Function must not write directly to public.profiles because the
-- service_role table grants are intentionally locked down.
create or replace function public.admin_insert_managed_profile(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, account_status)
  values (p_user_id, btrim(p_display_name), 'user', 'active')
  on conflict (id) do update
  set display_name = excluded.display_name,
      role = 'user',
      account_status = 'active';
end;
$$;

revoke all on function public.admin_insert_managed_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_insert_managed_profile(uuid, text) to service_role;