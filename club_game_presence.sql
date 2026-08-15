-- V6.1 Community Games / "Was spielt die Community?"
-- Uses the existing public.games catalog. No new game catalog table is required.

create table if not exists public.club_game_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index if not exists club_game_presence_game_id_idx
  on public.club_game_presence(game_id);

alter table public.club_game_presence enable row level security;

drop policy if exists "club_game_presence_select" on public.club_game_presence;
create policy "club_game_presence_select"
  on public.club_game_presence
  for select
  to anon, authenticated
  using (true);

drop policy if exists "club_game_presence_insert_own" on public.club_game_presence;
create policy "club_game_presence_insert_own"
  on public.club_game_presence
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "club_game_presence_update_own" on public.club_game_presence;
create policy "club_game_presence_update_own"
  on public.club_game_presence
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "club_game_presence_delete_own" on public.club_game_presence;
create policy "club_game_presence_delete_own"
  on public.club_game_presence
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Public aggregate: only counts and game metadata are exposed.
-- No member IDs or personal profile data are returned.
drop view if exists public.club_game_activity;
create view public.club_game_activity
with (security_invoker = true) as
select
  g.id,
  g.name,
  g.tag,
  g.image_url,
  g.description,
  count(p.user_id)::int as member_count
from public.games g
left join public.club_game_presence p on p.game_id = g.id
where coalesce(g.enabled, true) = true
group by g.id, g.name, g.tag, g.image_url, g.description
order by count(p.user_id) desc, g.name asc;

grant select on public.club_game_activity to anon, authenticated;
