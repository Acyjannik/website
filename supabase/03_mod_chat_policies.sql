-- ACY V10.0.1 — Moderator chat policies
-- Run separately from the rest of the migration to minimize lock contention.
alter table public.club_chat_bans enable row level security;
drop policy if exists "mods manage chat bans" on public.club_chat_bans;
create policy "mods manage chat bans"
on public.club_chat_bans for all to authenticated
using (
  exists(select 1 from public.admin_users a where a.user_id=auth.uid())
  or exists(select 1 from public.club_moderators m where m.user_id=auth.uid())
)
with check (
  exists(select 1 from public.admin_users a where a.user_id=auth.uid())
  or exists(select 1 from public.club_moderators m where m.user_id=auth.uid())
);

drop policy if exists "mods can moderate chat" on public.club_chat_messages;
create policy "mods can moderate chat"
on public.club_chat_messages for delete to authenticated
using (
  exists(select 1 from public.admin_users a where a.user_id=auth.uid())
  or exists(select 1 from public.club_moderators m where m.user_id=auth.uid())
);
