-- ACY CLUB MEMBERS
-- Run once in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'member_' || substr(replace(new.id::text, '-', ''), 1, 8))),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'ACY Member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "members can read own profile" on public.profiles;
create policy "members can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "members can update own profile" on public.profiles;
create policy "members can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

alter table public.profiles
drop constraint if exists profiles_username_format;

alter table public.profiles
add constraint profiles_username_format
check (username ~ '^[a-z0-9_]{3,24}$');


-- Profile extensions for V2.6
alter table public.profiles
  add column if not exists bio text,
  add column if not exists xp integer not null default 0,
  add column if not exists badges text[] not null default '{}';

-- Ensure reasonable limits.
alter table public.profiles
  drop constraint if exists profiles_bio_length;

alter table public.profiles
  add constraint profiles_bio_length
  check (char_length(coalesce(bio, '')) <= 180);

alter table public.profiles
  drop constraint if exists profiles_xp_nonnegative;

alter table public.profiles
  add constraint profiles_xp_nonnegative
  check (xp >= 0);

-- A small default badge for existing members.
update public.profiles
set badges = array_append(badges, 'ACY Rookie')
where not ('ACY Rookie' = any(badges));
