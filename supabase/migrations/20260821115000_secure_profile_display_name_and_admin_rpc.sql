-- Secure self-service display-name updates and admin RPC execution rights.
-- Authorization fields on profiles remain protected from client-side updates.

drop policy if exists "Users can update own display name" on public.profiles;
revoke update on table public.profiles from authenticated;

create or replace function public.set_my_display_name(p_display_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 32 then
    raise exception 'Display name must be 1-32 characters';
  end if;
  update public.profiles
     set display_name = v_name
   where id = auth.uid();
  return found;
end;
$$;

revoke all on function public.set_my_display_name(text) from public;
grant execute on function public.set_my_display_name(text) to authenticated;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
