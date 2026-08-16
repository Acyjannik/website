-- ACY CLUB V9.5 — richer daily/weekly quest rotation
-- Run once after the base club_quests.sql.

create or replace function public.get_my_quests()
returns jsonb
language sql
security definer
set search_path=public
as $$
select jsonb_build_object(
 'daily',jsonb_build_array(
  jsonb_build_object('key','daily_login','title','Tages-Check-in','description','Hole deinen Daily Streak-Bonus ab.','icon','🔥','target',1,'reward_xp',20),
  jsonb_build_object('key','daily_pet','title','Pet-Pflege','description','Führe heute eine Pet-Aktion aus.','icon','🐾','target',1,'reward_xp',25),
  jsonb_build_object('key','daily_social','title','Community-Moment','description','Schreibe einem Mitglied eine Nachricht.','icon','💬','target',1,'reward_xp',30),
  jsonb_build_object('key','daily_poll','title','Community Stimme','description','Stimme bei der aktuellen Umfrage ab.','icon','🗳️','target',1,'reward_xp',15)
 ),
 'weekly',jsonb_build_array(
  jsonb_build_object('key','weekly_wheel','title','Glücksrad-Woche','description','Drehe diese Woche mindestens 3-mal.','icon','🎡','target',3,'reward_xp',100),
  jsonb_build_object('key','weekly_social','title','Community-Netzwerk','description','Schließe diese Woche 2 Freundschaften.','icon','👥','target',2,'reward_xp',125),
  jsonb_build_object('key','weekly_games','title','Game Explorer','description','Entdecke diese Woche 3 verschiedene Games über Discord.','icon','🎮','target',3,'reward_xp',150),
  jsonb_build_object('key','weekly_event','title','Community dabei','description','Nimm diese Woche an mindestens 1 Event teil.','icon','📅','target',1,'reward_xp',150)
 ),
 'periods',jsonb_build_object('daily',current_date,'weekly',date_trunc('week',current_date)::date)
);
$$;

create or replace function public.increment_quest(
  p_quest_key text,
  p_period_start date,
  p_increment integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  target integer;
  new_progress integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  target:=case p_quest_key
    when 'daily_login' then 1
    when 'daily_pet' then 1
    when 'daily_social' then 1
    when 'daily_poll' then 1
    when 'weekly_wheel' then 3
    when 'weekly_social' then 2
    when 'weekly_games' then 3
    when 'weekly_event' then 1
    else 999999
  end;

  insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
  values(auth.uid(),p_quest_key,p_period_start,greatest(0,p_increment))
  on conflict(user_id,quest_key,period_start)
  do update set
    progress=least(target,public.club_quest_progress.progress+greatest(0,p_increment)),
    updated_at=now()
  returning progress into new_progress;

  return jsonb_build_object('ok',true,'progress',new_progress,'target',target,'completed',new_progress>=target);
end;
$$;

-- Sync a data-derived weekly Game Explorer quest without trusting the browser.
create or replace function public.sync_weekly_game_quest()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  period date;
  unique_games integer;
  new_progress integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  period:=date_trunc('week',current_date)::date;

  select count(distinct game_id)::int
    into unique_games
  from public.club_game_presence_log
  where user_id=auth.uid()
    and online=true
    and detected_at >= period::timestamptz;

  insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
  values(auth.uid(),'weekly_games',period,least(unique_games,3))
  on conflict(user_id,quest_key,period)
  do update set
    progress=greatest(public.club_quest_progress.progress,least(unique_games,3)),
    updated_at=now()
  returning progress into new_progress;

  return jsonb_build_object('ok',true,'progress',new_progress,'target',3,'completed',new_progress>=3);
end;
$$;

revoke all on function public.sync_weekly_game_quest() from public;
grant execute on function public.sync_weekly_game_quest() to authenticated;

-- Make sure the new quest keys are available to claim.
-- Existing claim_quest remains safe, but its target mapping must know the new keys.
create or replace function public.claim_quest(
  p_quest_key text,
  p_period_start date,
  p_reward_xp integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  row public.club_quest_progress%rowtype;
  target integer;
  xp_total integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  target:=case p_quest_key
    when 'daily_login' then 1
    when 'daily_pet' then 1
    when 'daily_social' then 1
    when 'daily_poll' then 1
    when 'weekly_wheel' then 3
    when 'weekly_social' then 2
    when 'weekly_games' then 3
    when 'weekly_event' then 1
    else 999999
  end;

  select * into row
  from public.club_quest_progress
  where user_id=auth.uid()
    and quest_key=p_quest_key
    and period_start=p_period_start
  for update;

  if row.user_id is null or row.claimed or row.progress<target
    then raise exception 'Quest noch nicht erfüllt.'; end if;

  update public.club_quest_progress
    set claimed=true,updated_at=now()
    where user_id=auth.uid()
      and quest_key=p_quest_key
      and period_start=p_period_start;

  update public.profiles
    set xp=greatest(0,coalesce(xp,0)+greatest(0,p_reward_xp)),
        updated_at=now()
    where id=auth.uid()
    returning xp into xp_total;

  return jsonb_build_object(
    'ok',true,
    'claimed',true,
    'reward_xp',greatest(0,p_reward_xp),
    'total_xp',xp_total
  );
end;
$$;
