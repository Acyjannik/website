-- ACY CLUB V8.1.4 — Dedicated online presence
create table if not exists public.club_online_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.club_online_presence enable row level security;

drop policy if exists "online presence select" on public.club_online_presence;
create policy "online presence select"
on public.club_online_presence for select to anon, authenticated
using (true);

drop policy if exists "online presence insert own" on public.club_online_presence;
create policy "online presence insert own"
on public.club_online_presence for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "online presence update own" on public.club_online_presence;
create policy "online presence update own"
on public.club_online_presence for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "online presence delete own" on public.club_online_presence;
create policy "online presence delete own"
on public.club_online_presence for delete to authenticated
using (auth.uid() = user_id);

create index if not exists idx_club_online_presence_updated
on public.club_online_presence(updated_at desc);
