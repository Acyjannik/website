-- ACY CLUB V9.0 — Automatic Game Discovery
alter table public.games
  add column if not exists twitch_game_id text,
  add column if not exists igdb_id text,
  add column if not exists discovered_source text default 'manual',
  add column if not exists discovered_at timestamptz;

create unique index if not exists uq_games_twitch_game_id
  on public.games(twitch_game_id)
  where twitch_game_id is not null;

create index if not exists idx_games_discovered_source
  on public.games(discovered_source);

-- Keep the homepage curated by sort_order. Auto-discovered games get a high
-- sort order and featured=false, so they appear in the Club catalog but not
-- in the three-card homepage section.
