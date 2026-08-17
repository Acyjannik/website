-- ACY CLUB V15.9 — Quest progress reliability
-- Run once in Supabase SQL Editor after V15.8.
-- The catalog remains the source of truth, while get_my_quests now returns the
-- user's current progress in the same response. This removes client-side races.

create or replace function public.get_my_quests()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  daily jsonb;
  weekly jsonb;
  daily_period date := current_date;
  weekly_period date := date_trunc('week',current_date)::date;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select coalesce(jsonb_agg(to_jsonb(q) - 'enabled' order by md5(auth.uid()::text||daily_period::text||q.quest_key) desc),'[]'::jsonb)
    into daily
  from (
    select c.quest_key,c.cadence,c.category,c.title,c.description,c.icon,c.target,c.reward_xp,
           coalesce(p.progress,0) as progress,
           coalesce(p.claimed,false) as claimed
    from public.club_quest_catalog c
    left join public.club_quest_progress p
      on p.user_id=auth.uid()
     and p.quest_key=c.quest_key
     and p.period_start=daily_period
    where c.enabled and c.cadence='daily'
    order by md5(auth.uid()::text||daily_period::text||c.quest_key) desc
    limit 4
  ) q;

  select coalesce(jsonb_agg(to_jsonb(q) - 'enabled' order by md5(auth.uid()::text||weekly_period::text||q.quest_key) desc),'[]'::jsonb)
    into weekly
  from (
    select c.quest_key,c.cadence,c.category,c.title,c.description,c.icon,c.target,c.reward_xp,
           coalesce(p.progress,0) as progress,
           coalesce(p.claimed,false) as claimed
    from public.club_quest_catalog c
    left join public.club_quest_progress p
      on p.user_id=auth.uid()
     and p.quest_key=c.quest_key
     and p.period_start=weekly_period
    where c.enabled and c.cadence='weekly'
    order by md5(auth.uid()::text||weekly_period::text||c.quest_key) desc
    limit 4
  ) q;

  return jsonb_build_object(
    'daily',daily,
    'weekly',weekly,
    'periods',jsonb_build_object('daily',daily_period,'weekly',weekly_period)
  );
end;
$$;

grant execute on function public.get_my_quests() to authenticated;
