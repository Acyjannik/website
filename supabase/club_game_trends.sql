-- ACY CLUB V9.3 — Game trends
drop view if exists public.club_game_activity;

create view public.club_game_activity
with (security_invoker = true) as
select
  g.id,
  g.name,
  g.tag,
  g.image_url,
  g.description,
  g.discovered_at,
  g.discovered_source,
  count(p.user_id)::int as member_count,
  coalesce((
    select count(*)
    from public.club_game_presence_log l
    where l.game_id = g.id
      and l.online = true
      and l.detected_at >= now() - interval '7 days'
  ),0)::int as sessions_7d,
  (
    select max(l.detected_at)
    from public.club_game_presence_log l
    where l.game_id = g.id
  ) as last_seen_at
from public.games g
left join public.club_game_presence p
  on p.game_id = g.id
  and p.updated_at >= now() - interval '5 minutes'
where coalesce(g.enabled, true) = true
group by g.id, g.name, g.tag, g.image_url, g.description, g.discovered_at, g.discovered_source
having count(p.user_id) > 0
order by count(p.user_id) desc, coalesce((
  select count(*)
  from public.club_game_presence_log l2
  where l2.game_id = g.id
    and l2.online = true
    and l2.detected_at >= now() - interval '7 days'
),0) desc, g.name asc;

grant select on public.club_game_activity to anon, authenticated;
