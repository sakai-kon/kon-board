alter table public.profiles
  add column if not exists display_name_custom boolean not null default false;

-- Existing profiles already represent a user's intentional profile state.
update public.profiles
set display_name_custom = true
where display_name is not null
  and btrim(display_name) <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, display_name_custom)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'user'), '@', 1),
      'user'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.set_my_display_name(p_display_name text)
returns boolean
language plpgsql
security definer
set search_path = 'public'
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
  set display_name = v_name,
      display_name_custom = true
  where id = auth.uid();

  return found;
end;
$$;

revoke all on function public.set_my_display_name(text) from public, anon;
grant execute on function public.set_my_display_name(text) to authenticated;
