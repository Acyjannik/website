-- ACY V11.5 — Notification cleanup
-- No schema change is required. The API uses service-role DELETE,
-- while individual deletes use the existing member UPDATE/DELETE path.
-- If your current Supabase policy set blocks member DELETE, run this once:

drop policy if exists "members can delete own notifications" on public.club_notifications;
create policy "members can delete own notifications"
on public.club_notifications
for delete
to authenticated
using (user_id = auth.uid());
