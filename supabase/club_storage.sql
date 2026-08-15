-- Run after the general site-media bucket setup.
-- This allows authenticated members to upload/update only their own avatar path.

drop policy if exists "members can upload own avatar" on storage.objects;
create policy "members can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-media'
  and name like 'avatars/' || auth.uid()::text || '.%'
);

drop policy if exists "members can update own avatar" on storage.objects;
create policy "members can update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-media'
  and name like 'avatars/' || auth.uid()::text || '.%'
)
with check (
  bucket_id = 'site-media'
  and name like 'avatars/' || auth.uid()::text || '.%'
);
