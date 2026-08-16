-- ACY V12.7: Repair profile linkage for existing Auth users.
-- Run once in Supabase SQL Editor.

create or replace function public.ensure_my_profile()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  base_username text;
  candidate text;
  suffix integer := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    return true;
  end if;

  base_username := lower(coalesce(auth.jwt()->'user_metadata'->>'username', 'member_' || substr(replace(uid::text, '-', ''), 1, 8)));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '_', 'g');
  base_username := left(base_username, 24);
  if length(base_username) < 3 then
    base_username := 'member_' || substr(replace(uid::text, '-', ''), 1, 8);
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(base_username, greatest(1, 24 - length(suffix::text) - 1)) || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    uid,
    candidate,
    coalesce(auth.jwt()->'user_metadata'->>'display_name', auth.jwt()->'user_metadata'->>'username', 'ACY Member')
  )
  on conflict (id) do nothing;

  return true;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

-- Repair all existing Auth users that are missing a profile row.
insert into public.profiles (id, username, display_name)
select
  u.id,
  lower(coalesce(nullif(regexp_replace(left(u.raw_user_meta_data->>'username',24), '[^a-z0-9_]', '_', 'g'), ''), 'member_' || substr(replace(u.id::text, '-', ''), 1, 8))),
  coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'username', 'ACY Member')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
