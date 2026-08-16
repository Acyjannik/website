-- ACY CLUB V9.8 — Moderator roles
create table if not exists public.club_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.club_moderators enable row level security;

drop policy if exists "admins manage moderators" on public.club_moderators;
create policy "admins manage moderators"
on public.club_moderators
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id=auth.uid()));

drop policy if exists "moderators read own role" on public.club_moderators;
create policy "moderators read own role"
on public.club_moderators
for select to authenticated
using (user_id=auth.uid());

-- Helper used by server-side / serverless APIs.
create or replace function public.is_club_moderator(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.club_moderators m
    where m.user_id=p_user_id
  ) or exists(
    select 1 from public.admin_users a
    where a.user_id=p_user_id
  );
$$;

revoke all on function public.is_club_moderator(uuid) from public;
grant execute on function public.is_club_moderator(uuid) to authenticated;

-- Permission model:
-- Moderators can create/end polls, review community reports, moderate chat content,
-- and trigger community announcements.
-- Moderators cannot modify website content, games, rewards, XP, badges, members,
-- admins, moderator roles, SMTP, or other system settings.

-- Keep the existing Mod badge synchronized for currently assigned moderators.
insert into public.profiles (id, badges)
select m.user_id, array['Mod']::text[]
from public.club_moderators m
on conflict (id) do update
set badges = array(
  select distinct b
  from unnest(coalesce(public.profiles.badges, '{}'::text[])) b
  union all select 'Mod'
);

-- Views for the moderator dashboard.
create or replace view public.club_moderator_members
with (security_invoker=true) as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.xp,
  p.created_at,
  p.discord_connected,
  p.badges
from public.profiles p
where exists (
  select 1 from public.club_moderators m where m.user_id=auth.uid()
) or exists (
  select 1 from public.admin_users a where a.user_id=auth.uid()
);

grant select on public.club_moderator_members to authenticated;
