-- ACY CLUB V20 — Quest tracking audit fix
-- Pet-derived quests are authoritative from activity logs.
-- Weekly game progress is authoritative from distinct game presence logs.

create or replace function public.sync_pet_quests()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  daily_period date := (now() at time zone 'Europe/Berlin')::date;
  weekly_period date := date_trunc('week', (now() at time zone 'Europe/Berlin')::date)::date;
  pet_care_actions text[] := array['feed','play','pet','groom','sleep','train','explore'];
  daily_pet_progress integer := 0;
  daily_training_progress integer := 0;
  weekly_adventure_progress integer := 0;
  weekly_games_progress integer := 0;
  weekly_pet_progress integer := 0;
  target integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select case when exists (
    select 1 from public.club_pet_activity_log
    where user_id=auth.uid() and activity_date=daily_period and activity_key = any(pet_care_actions)
  ) then 1 else 0 end into daily_pet_progress;

  select least(coalesce(count(*),0)::integer, coalesce((select target from public.club_quest_catalog where quest_key='daily_pet_training' and enabled),2))
    into daily_training_progress
  from public.club_pet_activity_log
  where user_id=auth.uid() and activity_date=daily_period and activity_key='train';

  select least(coalesce(count(*),0)::integer, coalesce((select target from public.club_quest_catalog where quest_key='weekly_pet_adventure' and enabled),3))
    into weekly_adventure_progress
  from public.club_pet_activity_log
  where user_id=auth.uid() and activity_date>=weekly_period and activity_key='explore';

  select least(coalesce(count(*),0)::integer, coalesce((select target from public.club_quest_catalog where quest_key='weekly_pet_games' and enabled),3))
    into weekly_games_progress
  from public.club_pet_activity_log
  where user_id=auth.uid() and activity_date>=weekly_period and activity_key in ('snack_hunt','lucky_paw');

  select least(coalesce(count(distinct activity_date),0)::integer, coalesce((select target from public.club_quest_catalog where quest_key='weekly_pet' and enabled),4))
    into weekly_pet_progress
  from public.club_pet_activity_log
  where user_id=auth.uid() and activity_date>=weekly_period and activity_key = any(pet_care_actions);

  select target into target from public.club_quest_catalog where quest_key='daily_pet' and enabled;
  if target is not null then
    insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
    values(auth.uid(),'daily_pet',daily_period,least(daily_pet_progress,target))
    on conflict(user_id,quest_key,period_start) do update set
      progress=case when public.club_quest_progress.claimed then public.club_quest_progress.progress else least(target,daily_pet_progress) end,
      updated_at=now();
  end if;

  select target into target from public.club_quest_catalog where quest_key='daily_pet_training' and enabled;
  if target is not null then
    insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
    values(auth.uid(),'daily_pet_training',daily_period,least(daily_training_progress,target))
    on conflict(user_id,quest_key,period_start) do update set
      progress=case when public.club_quest_progress.claimed then public.club_quest_progress.progress else least(target,daily_training_progress) end,
      updated_at=now();
  end if;

  select target into target from public.club_quest_catalog where quest_key='weekly_pet_adventure' and enabled;
  if target is not null then
    insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
    values(auth.uid(),'weekly_pet_adventure',weekly_period,least(weekly_adventure_progress,target))
    on conflict(user_id,quest_key,period_start) do update set
      progress=case when public.club_quest_progress.claimed then public.club_quest_progress.progress else least(target,weekly_adventure_progress) end,
      updated_at=now();
  end if;

  select target into target from public.club_quest_catalog where quest_key='weekly_pet_games' and enabled;
  if target is not null then
    insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
    values(auth.uid(),'weekly_pet_games',weekly_period,least(weekly_games_progress,target))
    on conflict(user_id,quest_key,period_start) do update set
      progress=case when public.club_quest_progress.claimed then public.club_quest_progress.progress else least(target,weekly_games_progress) end,
      updated_at=now();
  end if;

  select target into target from public.club_quest_catalog where quest_key='weekly_pet' and enabled;
  if target is not null then
    insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
    values(auth.uid(),'weekly_pet',weekly_period,least(weekly_pet_progress,target))
    on conflict(user_id,quest_key,period_start) do update set
      progress=case when public.club_quest_progress.claimed then public.club_quest_progress.progress else least(target,weekly_pet_progress) end,
      updated_at=now();
  end if;

  return jsonb_build_object('ok',true,'daily_pet',daily_pet_progress,'daily_pet_training',daily_training_progress,'weekly_pet_adventure',weekly_adventure_progress,'weekly_pet_games',weekly_games_progress,'weekly_pet',weekly_pet_progress);
end;
$$;

grant execute on function public.sync_pet_quests() to authenticated;

create or replace function public.sync_weekly_game_quest()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  period date := date_trunc('week', current_date)::date;
  unique_games integer;
  new_progress integer;
  v_target integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select coalesce(count(distinct game_id),0)::int into unique_games
  from public.club_game_presence_log
  where user_id=auth.uid() and online=true and detected_at >= period::timestamptz;
  select c.target into v_target from public.club_quest_catalog c where c.quest_key='weekly_games' and c.enabled=true;
  v_target:=coalesce(v_target,3);
  insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
  values(auth.uid(),'weekly_games',period,least(unique_games,v_target))
  on conflict(user_id,quest_key,period_start)
  do update set progress=case when public.club_quest_progress.claimed then public.club_quest_progress.progress else least(unique_games,v_target) end,updated_at=now()
  returning progress into new_progress;
  return jsonb_build_object('ok',true,'progress',new_progress,'target',v_target,'completed',new_progress>=v_target);
end;
$$;

grant execute on function public.sync_weekly_game_quest() to authenticated;
