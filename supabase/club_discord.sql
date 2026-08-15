-- ACY CLUB DISCORD LINK
-- Run once in Supabase SQL Editor after club_members.sql / club_progression.sql.

alter table public.profiles
  add column if not exists discord_connected boolean not null default false;

-- Keep the field member-controlled only through their own profile row.
-- Existing profiles remain false until the user completes the OAuth linking flow.
