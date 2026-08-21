alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','admin'));
alter table public.profiles add column if not exists account_status text not null default 'active' check (account_status in ('active','comment_restricted','post_restricted','banned'));

drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
revoke insert, update, delete on public.profiles from authenticated, anon;

create schema if not exists private;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin' and account_status='active');
$$;

create or replace function private.can_create_post()
returns boolean language sql stable security definer set search_path = public
as $$
  select private.is_admin() or exists (select 1 from public.profiles where id=(select auth.uid()) and account_status='active');
$$;

create or replace function private.can_create_comment()
returns boolean language sql stable security definer set search_path = public
as $$
  select private.is_admin() or exists (select 1 from public.profiles where id=(select auth.uid()) and account_status in ('active','post_restricted'));
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_create_post() to authenticated;
grant execute on function private.can_create_comment() to authenticated;

revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.can_create_post() from public, anon, authenticated;
revoke execute on function public.can_create_comment() from public, anon, authenticated;

drop policy if exists "authenticated users create own posts" on public.posts;
create policy "authenticated users create own posts"
on public.posts for insert to authenticated
with check ((select auth.uid())=author_id and private.can_create_post());

drop policy if exists "authenticated users create own comments" on public.comments;
create policy "authenticated users create own comments"
on public.comments for insert to authenticated
with check ((select auth.uid())=author_id and private.can_create_comment());

drop policy if exists "admins can delete any post" on public.posts;
create policy "admins can delete any post"
on public.posts for delete to authenticated using (private.is_admin());

drop policy if exists "admins can delete any comment" on public.comments;
create policy "admins can delete any comment"
on public.comments for delete to authenticated using (private.is_admin());

drop function if exists public.is_admin();
drop function if exists public.can_create_post();
drop function if exists public.can_create_comment();
