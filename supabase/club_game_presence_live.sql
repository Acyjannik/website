-- ACY CLUB V9.2 — Live community game ranking
-- A presence is considered live only if it was refreshed within the last 5 minutes.
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
  count(p.user_id)::int as member_count
from public.games g
left join public.club_game_presence p
  on p.game_id = g.id
  and p.updated_at >= now() - interval '5 minutes'
where coalesce(g.enabled, true) = true
group by g.id, g.name, g.tag, g.image_url, g.description, g.discovered_at, g.discovered_source
having count(p.user_id) > 0
order by count(p.user_id) desc, g.name asc;

grant select on public.club_game_activity to anon, authenticated;
