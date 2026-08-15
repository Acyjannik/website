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
