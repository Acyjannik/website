-- ACY CLUB V11.3.3 — Pet + Friends + Quest Repair
-- Standalone repair migration. Safe to run after the existing ACY tables exist.

-- ============================================================
-- 1) QUEST CATALOG + PROGRESS
-- ============================================================
create table if not exists public.club_quest_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_key text not null,
  period_start date not null,
  progress integer not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,quest_key,period_start)
);

alter table public.club_quest_progress enable row level security;
drop policy if exists "members read own quest progress" on public.club_quest_progress;
create policy "members read own quest progress"
on public.club_quest_progress for select to authenticated
using(user_id=auth.uid());

create or replace function public.get_my_quests()
returns jsonb
language sql
security definer
set search_path=public
as $$
select jsonb_build_object(
 'daily',jsonb_build_array(
  jsonb_build_object('key','daily_login','title','Tages-Check-in','description','Komm heute in den ACY Club.','icon','🔥','target',1,'reward_xp',20),
  jsonb_build_object('key','daily_pet','title','Pet-Pflege','description','Führe heute mindestens eine Pet-Aktion aus.','icon','🐾','target',1,'reward_xp',25),
  jsonb_build_object('key','daily_social','title','Community-Moment','description','Schreibe heute mindestens einem Mitglied eine Nachricht.','icon','💬','target',1,'reward_xp',30),
  jsonb_build_object('key','daily_poll','title','Community Stimme','description','Stimme bei der aktuellen Umfrage ab.','icon','🗳️','target',1,'reward_xp',15)
 ),
 'weekly',jsonb_build_array(
  jsonb_build_object('key','weekly_wheel','title','Glücksrad-Woche','description','Drehe diese Woche mindestens 3-mal.','icon','🎡','target',3,'reward_xp',100),
  jsonb_build_object('key','weekly_social','title','Kontakte pflegen','description','Nimm diese Woche mindestens zweimal Kontakt zu Mitgliedern auf.','icon','👥','target',2,'reward_xp',125),
  jsonb_build_object('key','weekly_games','title','Gamespotter','description','Entdecke diese Woche 3 verschiedene Games über Discord.','icon','🎮','target',3,'reward_xp',150),
  jsonb_build_object('key','weekly_event','title','Community dabei','description','Nimm diese Woche an mindestens einem Event teil.','icon','📅','target',1,'reward_xp',150)
 ),
 'periods',jsonb_build_object('daily',current_date,'weekly',date_trunc('week',current_date)::date)
);
$$;

create or replace function public.increment_quest_for_user(
  p_user_id uuid,
  p_quest_key text,
  p_period_start date,
  p_increment integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare target integer; new_progress integer;
begin
  target:=case p_quest_key
    when 'daily_login' then 1 when 'daily_pet' then 1 when 'daily_social' then 1
    when 'daily_poll' then 1 when 'weekly_wheel' then 3 when 'weekly_social' then 2
    when 'weekly_games' then 3 when 'weekly_event' then 1 else 999999 end;

  insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
  values(p_user_id,p_quest_key,p_period_start,greatest(0,p_increment))
  on conflict(user_id,quest_key,period_start)
  do update set
    progress=least(target,public.club_quest_progress.progress+greatest(0,p_increment)),
    updated_at=now();

  select progress into new_progress
  from public.club_quest_progress
  where user_id=p_user_id and quest_key=p_quest_key and period_start=p_period_start;

  return jsonb_build_object('ok',true,'progress',new_progress,'target',target,'completed',new_progress>=target);
end;
$$;

revoke all on function public.increment_quest_for_user(uuid,text,date,integer) from public;
grant execute on function public.increment_quest_for_user(uuid,text,date,integer) to service_role;

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
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  return public.increment_quest_for_user(auth.uid(),p_quest_key,p_period_start,p_increment);
end;
$$;

revoke all on function public.increment_quest(text,date,integer) from public;
grant execute on function public.increment_quest(text,date,integer) to authenticated;

create or replace function public.sync_weekly_game_quest()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare period date; unique_games integer; new_progress integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  period:=date_trunc('week',current_date)::date;
  select count(distinct game_id)::int into unique_games
  from public.club_game_presence_log
  where user_id=auth.uid() and detected_at>=period::timestamptz and game_id is not null;

  insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
  values(auth.uid(),'weekly_games',period,least(unique_games,3))
  on conflict(user_id,quest_key,period_start)
  do update set progress=greatest(public.club_quest_progress.progress,least(unique_games,3)),updated_at=now()
  returning progress into new_progress;

  return jsonb_build_object('ok',true,'progress',new_progress,'target',3,'completed',new_progress>=3);
end;
$$;

revoke all on function public.sync_weekly_game_quest() from public;
grant execute on function public.sync_weekly_game_quest() to authenticated;

-- Direct message -> daily/weekly social quest.
create or replace function public.quest_on_direct_message()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.increment_quest_for_user(new.sender_id,'daily_social',current_date,1);
  perform public.increment_quest_for_user(new.sender_id,'weekly_social',date_trunc('week',current_date)::date,1);
  return new;
end;
$$;

drop trigger if exists trg_quest_on_direct_message on public.club_direct_messages;
create trigger trg_quest_on_direct_message
after insert on public.club_direct_messages
for each row execute function public.quest_on_direct_message();

-- Accepted friend request -> weekly social quest for both sides.
create or replace function public.quest_on_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='accepted' and (tg_op='INSERT' or old.status is distinct from 'accepted') then
    perform public.increment_quest_for_user(new.requester_id,'weekly_social',date_trunc('week',current_date)::date,1);
    perform public.increment_quest_for_user(new.addressee_id,'weekly_social',date_trunc('week',current_date)::date,1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quest_on_friend_accepted on public.club_friend_requests;
create trigger trg_quest_on_friend_accepted
after insert or update of status on public.club_friend_requests
for each row execute function public.quest_on_friend_accepted();

-- ============================================================
-- 2) PETS: independent cooldowns, visible care XP, energy regen
-- ============================================================
alter table public.club_pets add column if not exists last_feed_at timestamptz;
alter table public.club_pets add column if not exists last_play_at timestamptz;
alter table public.club_pets add column if not exists last_pet_at timestamptz;

alter table public.club_pet_daily_actions add column if not exists action_count integer not null default 0;

create or replace function public.get_club_pet()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.club_pets%rowtype;
  elapsed_hours numeric;
  hunger_now integer; happiness_now integer; energy_now integer;
  hours_to_zero numeric;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select * into p from public.club_pets where user_id=auth.uid() for update;
  if p.user_id is null then return null; end if;

  elapsed_hours:=greatest(0,extract(epoch from (now()-coalesce(p.last_interaction_at,p.updated_at,p.created_at)))/3600.0);
  hunger_now:=greatest(0,p.hunger-floor(elapsed_hours*1.0)::integer);
  happiness_now:=greatest(0,p.happiness-floor(elapsed_hours*0.5)::integer);
  energy_now:=least(100,greatest(0,p.energy+floor(elapsed_hours*1.5)::integer));

  hours_to_zero:=least(p.hunger/1.0,p.happiness/0.5,999999.0);
  if elapsed_hours>=hours_to_zero+72 then
    delete from public.club_pets where user_id=auth.uid();
    return jsonb_build_object('_died',true,'name',p.name,'species',p.species,'reason','Ein Pflegewert war 72 Stunden lang auf 0.');
  end if;

  update public.club_pets
  set hunger=hunger_now,happiness=happiness_now,energy=energy_now,updated_at=now()
  where user_id=auth.uid();

  return jsonb_build_object(
    'user_id',p.user_id,'species',p.species,'name',p.name,
    'hunger',hunger_now,'happiness',happiness_now,'energy',energy_now,
    'pet_xp',coalesce(p.pet_xp,0),'created_at',p.created_at,'updated_at',now(),
    'last_interaction_at',p.last_interaction_at
  );
end;
$$;

revoke all on function public.get_club_pet() from public;
grant execute on function public.get_club_pet() to authenticated;

create or replace function public.club_pet_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.club_pets%rowtype;
  action_row public.club_pet_daily_actions%rowtype;
  now_ts timestamptz:=now();
  elapsed_hours numeric;
  new_hunger integer; new_happiness integer; new_energy integer;
  care_xp_awarded integer:=0; club_xp_awarded boolean:=false;
  result jsonb;
  previous_action_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_action not in ('feed','play','pet') then raise exception 'Ungültige Aktion.'; end if;

  select * into p from public.club_pets where user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;

  elapsed_hours:=greatest(0,extract(epoch from (now()-coalesce(p.last_interaction_at,p.updated_at,p.created_at)))/3600.0);
  new_hunger:=greatest(0,p.hunger-floor(elapsed_hours*1.0)::integer);
  new_happiness:=greatest(0,p.happiness-floor(elapsed_hours*0.5)::integer);
  new_energy:=least(100,greatest(0,p.energy+floor(elapsed_hours*1.5)::integer));

  previous_action_at:=case
    when p_action='feed' then p.last_feed_at
    when p_action='play' then p.last_play_at
    else p.last_pet_at
  end;

  if previous_action_at is not null then
    if p_action='feed' and previous_action_at>now_ts-interval '30 minutes' then
      raise exception 'Dein Tier hat gerade gefressen. Warte noch ein wenig.';
    elsif p_action='play' and previous_action_at>now_ts-interval '30 minutes' then
      raise exception 'Dein Tier braucht nach dem Spielen eine Pause.';
    elsif p_action='pet' and previous_action_at>now_ts-interval '5 minutes' then
      raise exception 'Dein Tier genießt die Streicheleinheiten noch.';
    end if;
  end if;

  if p_action='feed' then
    new_hunger:=least(100,new_hunger+35);
    new_happiness:=least(100,new_happiness+5);
    new_energy:=least(100,new_energy+5);
  elsif p_action='play' then
    if new_energy<15 then raise exception 'Dein Tier ist zu müde zum Spielen. Lass es etwas Energie regenerieren.'; end if;
    new_happiness:=least(100,new_happiness+25);
    new_energy:=greatest(0,new_energy-15);
    new_hunger:=greatest(0,new_hunger-10);
  else
    new_happiness:=least(100,new_happiness+10);
    new_energy:=least(100,new_energy+5);
  end if;

  select * into action_row
  from public.club_pet_daily_actions
  where user_id=auth.uid() and action_date=current_date
  for update;

  if action_row.user_id is null then
    insert into public.club_pet_daily_actions(user_id,action_date,action_count)
    values(auth.uid(),current_date,1);
    care_xp_awarded:=5;
    club_xp_awarded:=true;
    perform public.award_club_xp(auth.uid(),'pet_care_'||current_date::text,5);
  elsif coalesce(action_row.action_count,0)<4 then
    update public.club_pet_daily_actions
    set action_count=action_count+1
    where user_id=auth.uid() and action_date=current_date;
    care_xp_awarded:=5;
  end if;

  update public.club_pets
  set hunger=new_hunger,happiness=new_happiness,energy=new_energy,
      pet_xp=coalesce(p.pet_xp,0)+care_xp_awarded,
      updated_at=now_ts,last_interaction_at=now_ts,
      last_feed_at=case when p_action='feed' then now_ts else last_feed_at end,
      last_play_at=case when p_action='play' then now_ts else last_play_at end,
      last_pet_at=case when p_action='pet' then now_ts else last_pet_at end
  where user_id=auth.uid();

  select jsonb_build_object(
    'user_id',user_id,'species',species,'name',name,'hunger',hunger,
    'happiness',happiness,'energy',energy,'pet_xp',pet_xp,
    'created_at',created_at,'updated_at',updated_at,'last_interaction_at',last_interaction_at,
    'daily_xp_awarded',club_xp_awarded,
    'care_xp_awarded',care_xp_awarded,
    'care_actions_today',coalesce((select action_count from public.club_pet_daily_actions where user_id=auth.uid() and action_date=current_date),0)
  ) into result
  from public.club_pets where user_id=auth.uid();

  return result;
end;
$$;

revoke all on function public.club_pet_action(text) from public;
grant execute on function public.club_pet_action(text) to authenticated;

-- ============================================================
-- 3) FRIEND LIST REPAIR
-- ============================================================
create or replace function public.sync_my_friendships()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare pair record; changed_rows integer:=0; inserted_total integer:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  for pair in
    select requester_id,addressee_id
    from public.club_friend_requests
    where status='accepted'
      and (requester_id=auth.uid() or addressee_id=auth.uid())
  loop
    insert into public.club_friendships(user_id,friend_user_id)
    values(pair.requester_id,pair.addressee_id)
    on conflict do nothing;
    get diagnostics changed_rows=row_count;
    inserted_total:=inserted_total+changed_rows;

    insert into public.club_friendships(user_id,friend_user_id)
    values(pair.addressee_id,pair.requester_id)
    on conflict do nothing;
    get diagnostics changed_rows=row_count;
    inserted_total:=inserted_total+changed_rows;
  end loop;
  return inserted_total;
end;
$$;

revoke all on function public.sync_my_friendships() from public;
grant execute on function public.sync_my_friendships() to authenticated;

create or replace function public.get_my_social_connections()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  perform public.sync_my_friendships();

  select jsonb_build_object(
    'friends',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',f.friend_user_id,'username',p.username,'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),'online',coalesce(op.updated_at>now()-interval '5 minutes',false),
        'game_id',gp.game_id,'game_name',g.name,'last_seen',gp.updated_at
      ) order by p.display_name nulls last,p.username)
      from (
        select user_id,friend_user_id from public.club_friendships where user_id=auth.uid()
        union
        select requester_id,addressee_id from public.club_friend_requests where status='accepted' and requester_id=auth.uid()
        union
        select addressee_id,requester_id from public.club_friend_requests where status='accepted' and addressee_id=auth.uid()
      ) f
      join public.profiles p on p.id=f.friend_user_id
      left join public.club_game_presence gp on gp.user_id=f.friend_user_id
      left join public.club_online_presence op on op.user_id=f.friend_user_id
      left join public.games g on g.id=gp.game_id
      where not exists (
        select 1 from public.club_blocks b
        where (b.blocker_id=auth.uid() and b.blocked_user_id=f.friend_user_id)
           or (b.blocker_id=f.friend_user_id and b.blocked_user_id=auth.uid())
      )
    ),'[]'::jsonb),
    'incoming',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.requester_id,'username',p.username,'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),'created_at',r.created_at
      ) order by r.created_at desc)
      from public.club_friend_requests r join public.profiles p on p.id=r.requester_id
      where r.addressee_id=auth.uid() and r.status='pending'
    ),'[]'::jsonb),
    'outgoing',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.addressee_id,'username',p.username,'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),'created_at',r.created_at
      ) order by r.created_at desc)
      from public.club_friend_requests r join public.profiles p on p.id=r.addressee_id
      where r.requester_id=auth.uid() and r.status='pending'
    ),'[]'::jsonb),
    'blocked',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',b.blocked_user_id,'username',p.username,'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,'')
      ) order by p.display_name nulls last,p.username)
      from public.club_blocks b join public.profiles p on p.id=b.blocked_user_id
      where b.blocker_id=auth.uid()
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_my_social_connections() from public;
grant execute on function public.get_my_social_connections() to authenticated;

