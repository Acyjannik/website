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
create policy "members read own quest progress" on public.club_quest_progress for select to authenticated using(user_id=auth.uid());

create or replace function public.get_my_quests() returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object(
 'daily',jsonb_build_array(
  jsonb_build_object('key','daily_login','title','Tages-Check-in','description','Hole deinen Daily Streak-Bonus ab.','icon','🔥','target',1,'reward_xp',20),
  jsonb_build_object('key','daily_pet','title','Pet-Pflege','description','Führe heute eine Pet-Aktion aus.','icon','🐾','target',1,'reward_xp',25),
  jsonb_build_object('key','daily_social','title','Community-Moment','description','Schreibe einem Mitglied eine Nachricht.','icon','💬','target',1,'reward_xp',30)
 ),
 'weekly',jsonb_build_array(
  jsonb_build_object('key','weekly_wheel','title','Glücksrad-Woche','description','Drehe diese Woche mindestens 3-mal.','icon','🎡','target',3,'reward_xp',100),
  jsonb_build_object('key','weekly_social','title','Community-Netzwerk','description','Schließe diese Woche 2 Freundschaften.','icon','👥','target',2,'reward_xp',125)
 ),
 'periods',jsonb_build_object('daily',current_date,'weekly',date_trunc('week',current_date)::date)
); $$;

create or replace function public.increment_quest(p_quest_key text,p_period_start date,p_increment integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target integer; new_progress integer;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
 target:=case p_quest_key when 'daily_login' then 1 when 'daily_pet' then 1 when 'daily_social' then 1 when 'weekly_wheel' then 3 when 'weekly_social' then 2 else 999999 end;
 insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
 values(auth.uid(),p_quest_key,p_period_start,greatest(0,p_increment))
 on conflict(user_id,quest_key,period_start) do update set progress=least(target,public.club_quest_progress.progress+greatest(0,p_increment)),updated_at=now()
 returning progress into new_progress;
 return jsonb_build_object('ok',true,'progress',new_progress,'target',target,'completed',new_progress>=target);
end; $$;

create or replace function public.claim_quest(p_quest_key text,p_period_start date,p_reward_xp integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare row public.club_quest_progress%rowtype; target integer; xp_total integer;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
 target:=case p_quest_key when 'daily_login' then 1 when 'daily_pet' then 1 when 'daily_social' then 1 when 'weekly_wheel' then 3 when 'weekly_social' then 2 else 999999 end;
 select * into row from public.club_quest_progress where user_id=auth.uid() and quest_key=p_quest_key and period_start=p_period_start for update;
 if row.user_id is null or row.claimed or row.progress<target then raise exception 'Quest noch nicht erfüllt.'; end if;
 update public.club_quest_progress set claimed=true,updated_at=now() where user_id=auth.uid() and quest_key=p_quest_key and period_start=p_period_start;
 update public.profiles set xp=greatest(0,coalesce(xp,0)+greatest(0,p_reward_xp)),updated_at=now() where id=auth.uid() returning xp into xp_total;
 return jsonb_build_object('ok',true,'claimed',true,'reward_xp',greatest(0,p_reward_xp),'total_xp',xp_total);
end; $$;

revoke all on function public.get_my_quests() from public;
revoke all on function public.increment_quest(text,date,integer) from public;
revoke all on function public.claim_quest(text,date,integer) from public;
grant execute on function public.get_my_quests() to authenticated;
grant execute on function public.increment_quest(text,date,integer) to authenticated;
grant execute on function public.claim_quest(text,date,integer) to authenticated;
