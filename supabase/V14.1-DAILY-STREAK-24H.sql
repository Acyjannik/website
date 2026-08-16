-- ACY CLUB V14.1 — Daily Streak with a real 24-hour cooldown
-- Re-run this file after deployment. Existing rows are backfilled from updated_at.
create table if not exists public.club_daily_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_checkin_date date,
  last_checkin_at timestamptz,
  total_checkins integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.club_daily_streaks add column if not exists last_checkin_at timestamptz;

-- Older versions only stored the calendar date. updated_at is written on every claim,
-- so it gives existing members a useful timestamp for the new 24h cooldown.
update public.club_daily_streaks
set last_checkin_at=updated_at
where last_checkin_date is not null and last_checkin_at is null;

alter table public.club_daily_streaks enable row level security;

drop policy if exists "members read own daily streak" on public.club_daily_streaks;
create policy "members read own daily streak"
on public.club_daily_streaks for select to authenticated
using (user_id = auth.uid());

create or replace function public.claim_daily_streak()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  row public.club_daily_streaks%rowtype;
  now_ts timestamptz := now();
  new_streak integer;
  reward_xp integer;
  xp_total integer;
  new_achievement text := null;
  next_claim_at timestamptz;
  cooldown_remaining integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select * into row
  from public.club_daily_streaks
  where user_id=auth.uid()
  for update;

  if row.user_id is null then
    insert into public.club_daily_streaks(
      user_id,current_streak,best_streak,last_checkin_date,last_checkin_at,total_checkins
    )
    values(auth.uid(),1,1,now_ts::date,now_ts,1)
    returning * into row;
    new_streak := 1;
  elsif row.last_checkin_at is not null and now_ts < row.last_checkin_at + interval '24 hours' then
    next_claim_at := row.last_checkin_at + interval '24 hours';
    cooldown_remaining := greatest(0,ceil(extract(epoch from (next_claim_at-now_ts)))::integer);
    return jsonb_build_object(
      'ok',true,
      'claimed',false,
      'current_streak',row.current_streak,
      'best_streak',row.best_streak,
      'total_checkins',row.total_checkins,
      'last_checkin_date',row.last_checkin_date,
      'last_checkin_at',row.last_checkin_at,
      'next_claim_at',next_claim_at,
      'cooldown_remaining_seconds',cooldown_remaining,
      'reward_xp',0,
      'new_achievement',null
    );
  else
    -- The streak continues when the next check-in happens within 48h of the previous one.
    -- The first 24h are a cooldown; the following 24h are the grace period to keep the streak.
    if row.last_checkin_at is not null and now_ts <= row.last_checkin_at + interval '48 hours' then
      new_streak := row.current_streak + 1;
    else
      new_streak := 1;
    end if;

    update public.club_daily_streaks
    set current_streak=new_streak,
        best_streak=greatest(best_streak,new_streak),
        last_checkin_date=now_ts::date,
        last_checkin_at=now_ts,
        total_checkins=total_checkins+1,
        updated_at=now_ts
    where user_id=auth.uid()
    returning * into row;
  end if;

  reward_xp := case
    when new_streak >= 30 then 100
    when new_streak >= 14 then 75
    when new_streak >= 7 then 50
    when new_streak >= 3 then 35
    else 25
  end;

  update public.profiles
  set xp=greatest(0,coalesce(xp,0)+reward_xp),updated_at=now_ts
  where id=auth.uid()
  returning xp into xp_total;

  if new_streak >= 3 then
    insert into public.club_achievements(user_id,achievement_key)
    values(auth.uid(),'streak_3')
    on conflict do nothing;
    if found then new_achievement := 'streak_3'; end if;
  end if;
  if new_streak >= 7 then
    insert into public.club_achievements(user_id,achievement_key)
    values(auth.uid(),'streak_7')
    on conflict do nothing;
    if found then new_achievement := 'streak_7'; end if;
  end if;
  if new_streak >= 14 then
    insert into public.club_achievements(user_id,achievement_key)
    values(auth.uid(),'streak_14')
    on conflict do nothing;
    if found then new_achievement := 'streak_14'; end if;
  end if;
  if new_streak >= 30 then
    insert into public.club_achievements(user_id,achievement_key)
    values(auth.uid(),'streak_30')
    on conflict do nothing;
    if found then new_achievement := 'streak_30'; end if;
  end if;

  next_claim_at := now_ts + interval '24 hours';
  return jsonb_build_object(
    'ok',true,
    'claimed',true,
    'current_streak',row.current_streak,
    'best_streak',row.best_streak,
    'total_checkins',row.total_checkins,
    'last_checkin_date',row.last_checkin_date,
    'last_checkin_at',row.last_checkin_at,
    'next_claim_at',next_claim_at,
    'cooldown_remaining_seconds',86400,
    'reward_xp',reward_xp,
    'total_xp',xp_total,
    'new_achievement',new_achievement
  );
end;
$$;

revoke all on function public.claim_daily_streak() from public;
grant execute on function public.claim_daily_streak() to authenticated;
