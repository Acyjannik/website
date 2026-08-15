-- ACY CLUB AVATARS
-- Run once in Supabase SQL Editor after club_members.sql.
-- This creates a dedicated public bucket for member avatars and limits uploads to each user's folder.

insert into storage.buckets (id, name, public)
values ('club-avatars', 'club-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "members can upload own club avatar" on storage.objects;
create policy "members can upload own club avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members can update own club avatar" on storage.objects;
create policy "members can update own club avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members can delete own club avatar" on storage.objects;
create policy "members can delete own club avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
