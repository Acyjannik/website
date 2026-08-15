-- ACY CLUB V7.3 — EVENT HUB
create table if not exists public.club_event_hub_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  twitch_sent boolean not null default false,
  discord_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.club_event_hub_log enable row level security;

drop policy if exists "admins can read event hub log" on public.club_event_hub_log;
create policy "admins can read event hub log"
on public.club_event_hub_log
for select to authenticated
using (exists (
  select 1 from public.admin_users a where a.user_id = auth.uid()
));

create index if not exists idx_club_event_hub_created
on public.club_event_hub_log(created_at desc);

create or replace function public.get_event_hub_log(p_limit integer default 25)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  from (
    select id,event_type,title,payload,twitch_sent,discord_sent,created_at
    from public.club_event_hub_log
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit,25),100))
  ) x;
$$;

revoke all on function public.get_event_hub_log(integer) from public;
grant execute on function public.get_event_hub_log(integer) to authenticated;
