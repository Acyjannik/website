-- ACY CLUB V9.0 — Discord account mapping for presence sync
create table if not exists public.discord_presence_links (
  discord_user_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discord_presence_links enable row level security;

drop policy if exists "members read own discord link" on public.discord_presence_links;
create policy "members read own discord link"
on public.discord_presence_links for select to authenticated
using (user_id=auth.uid());

create index if not exists idx_discord_presence_links_user
on public.discord_presence_links(user_id);
