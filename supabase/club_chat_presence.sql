-- ACY CLUB — LIVE CHAT PRESENCE
-- Run after the existing supabase/club_chat.sql migration.

create table if not exists public.club_chat_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.club_chat_presence enable row level security;

drop policy if exists "authenticated can read chat presence" on public.club_chat_presence;
create policy "authenticated can read chat presence"
on public.club_chat_presence
for select to authenticated using (true);

drop policy if exists "members can insert own chat presence" on public.club_chat_presence;
create policy "members can insert own chat presence"
on public.club_chat_presence
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "members can update own chat presence" on public.club_chat_presence;
create policy "members can update own chat presence"
on public.club_chat_presence
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_club_chat_presence_last_seen
  on public.club_chat_presence(last_seen_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_chat_presence'
  ) then
    alter publication supabase_realtime add table public.club_chat_presence;
  end if;
end $$;
