-- ACY CLUB V10.4.2 — Allow moderators to manage community polls.
-- Run once in Supabase SQL Editor.

alter table public.club_polls enable row level security;
alter table public.club_poll_options enable row level security;
alter table public.club_poll_votes enable row level security;

drop policy if exists "admins manage polls" on public.club_polls;
drop policy if exists "admins and mods manage polls" on public.club_polls;
create policy "admins and mods manage polls"
on public.club_polls for all
to authenticated
using (
  exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  or exists (select 1 from public.club_moderators m where m.user_id = auth.uid())
)
with check (
  exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  or exists (select 1 from public.club_moderators m where m.user_id = auth.uid())
);

drop policy if exists "admins manage poll options" on public.club_poll_options;
drop policy if exists "admins and mods manage poll options" on public.club_poll_options;
create policy "admins and mods manage poll options"
on public.club_poll_options for all
to authenticated
using (
  exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  or exists (select 1 from public.club_moderators m where m.user_id = auth.uid())
)
with check (
  exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  or exists (select 1 from public.club_moderators m where m.user_id = auth.uid())
);

-- Keep voting protected separately; admins may still manage votes.
drop policy if exists "admins manage poll votes" on public.club_poll_votes;
create policy "admins manage poll votes"
on public.club_poll_votes for all
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
