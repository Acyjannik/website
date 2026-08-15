-- ACY CLUB AVATARS (V2.8.2)
-- Run this entire script in Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('club-avatars', 'club-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "members can upload own club avatar" on storage.objects;
create policy "members can upload own club avatar"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "members can update own club avatar" on storage.objects;
create policy "members can update own club avatar"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "members can delete own club avatar" on storage.objects;
create policy "members can delete own club avatar"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'club-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "public can view club avatars" on storage.objects;
create policy "public can view club avatars"
on storage.objects
as permissive
for select
to public
using (bucket_id = 'club-avatars');
