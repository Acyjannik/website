-- ACY CLUB V18.0 — Quest reliability and server-owned rewards
-- Run once in the Supabase SQL Editor after V17.9.
-- This is required because V17.9 replaced the progress-aware quest reader
-- with a static catalog and accepted a reward amount from the browser.

create table if not exists public.club_quest_catalog (
  quest_key text primary key,
  cadence text not null check (cadence in ('daily','weekly')),
  category text not null default 'community',
  title text not null,
  description text not null,
  icon text not null default '🎯',
  target integer not null check (target > 0),
  reward_xp integer not null check (reward_xp >= 0),
  enabled boolean not null default true
);

insert into public.club_quest_catalog(quest_key,cadence,category,title,description,icon,target,reward_xp) values
 ('daily_login','daily','streak','Tages-Check-in','Hole deinen täglichen Check-in ab.','🔥',1,20),
 ('daily_pet','daily','pet','Pet-Pflege','Führe heute eine Pet-Aktion aus.','🐾',1,25),
 ('daily_pet_training','daily','pet','Pet-Training','Trainiere deinen Begleiter heute 2-mal.','💪',2,30),
 ('daily_social','daily','social','Community-Moment','Schreibe einem Mitglied eine Nachricht.','💬',1,30),
 ('daily_poll','daily','community','Community Stimme','Stimme bei der aktuellen Umfrage ab.','🗳️',1,15),
 ('daily_profile','daily','profile','Profil-Check','Vervollständige dein Clubprofil.','🪪',1,10),
 ('daily_game','daily','games','Game Spotter','Setze heute ein aktuelles Game.','🎮',1,20),
 ('daily_streak','daily','streak','Serie halten','Hole deinen Tagesbonus ab.','⚡',1,25),
 ('daily_friend','daily','social','Kontakt pflegen','Öffne ein anderes Mitgliedsprofil.','👀',1,10),
 ('weekly_wheel','weekly','rewards','Glücksrad-Woche','Drehe diese Woche mindestens 3-mal.','🎡',3,100),
 ('weekly_pet_adventure','weekly','pet','Pet-Abenteuer','Gehe diese Woche 3-mal auf Erkundungstour.','🗺️',3,100),
 ('weekly_pet_games','weekly','pet','Pet-Spielzeit','Spiele diese Woche 3 Pet-Minigames.','🎯',3,100),
 ('weekly_social','weekly','social','Community-Netzwerk','Schließe diese Woche 2 Freundschaften.','👥',2,125),
 ('weekly_games','weekly','games','Game Explorer','Entdecke diese Woche 3 verschiedene Games.','🎮',3,150),
 ('weekly_event','weekly','events','Community dabei','Nimm diese Woche an mindestens einem Event teil.','📅',1,150),
 ('weekly_chat','weekly','social','Chat-Stammgast','Schreibe diese Woche 5 Nachrichten im Club-Chat.','💜',5,100),
 ('weekly_pet','weekly','pet','Pet-Freund','Sei an 4 Tagen für dein Pet da.','🐾',4,100),
 ('weekly_vote','weekly','community','Community Stimme','Stimme diese Woche bei 2 Votes ab.','🗳️',2,90)
on conflict(quest_key) do update set
 cadence=excluded.cadence,category=excluded.category,title=excluded.title,
 description=excluded.description,icon=excluded.icon,target=excluded.target,
 reward_xp=excluded.reward_xp,enabled=true;

create or replace function public.get_my_quests()
returns jsonb language plpgsql security definer set search_path=public as $$
declare daily_period date:=current_date; weekly_period date:=date_trunc('week',current_date)::date; daily jsonb; weekly jsonb;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.quest_key),'[]'::jsonb) into daily from (
   select c.quest_key,c.cadence,c.category,c.title,c.description,c.icon,c.target,c.reward_xp,
          coalesce(p.progress,0) progress,coalesce(p.claimed,false) claimed
   from public.club_quest_catalog c left join public.club_quest_progress p
     on p.user_id=auth.uid() and p.quest_key=c.quest_key and p.period_start=daily_period
   where c.enabled and c.cadence='daily'
 ) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.quest_key),'[]'::jsonb) into weekly from (
   select c.quest_key,c.cadence,c.category,c.title,c.description,c.icon,c.target,c.reward_xp,
          coalesce(p.progress,0) progress,coalesce(p.claimed,false) claimed
   from public.club_quest_catalog c left join public.club_quest_progress p
     on p.user_id=auth.uid() and p.quest_key=c.quest_key and p.period_start=weekly_period
   where c.enabled and c.cadence='weekly'
 ) q;
 return jsonb_build_object('daily',daily,'weekly',weekly,'periods',jsonb_build_object('daily',daily_period,'weekly',weekly_period));
end $$;

create or replace function public.increment_quest(p_quest_key text,p_period_start date,p_increment integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.club_quest_catalog%rowtype; new_progress integer; safe_increment integer;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
 select * into q from public.club_quest_catalog where quest_key=p_quest_key and enabled;
 if q.quest_key is null then raise exception 'Unbekannte Quest.'; end if;
 if (q.cadence='daily' and p_period_start<>current_date) or (q.cadence='weekly' and p_period_start<>date_trunc('week',current_date)::date) then raise exception 'Quest-Zeitraum abgelaufen.'; end if;
 safe_increment:=least(q.target,greatest(1,coalesce(p_increment,1)));
 insert into public.club_quest_progress(user_id,quest_key,period_start,progress) values(auth.uid(),q.quest_key,p_period_start,safe_increment)
 on conflict(user_id,quest_key,period_start) do update set progress=least(q.target,public.club_quest_progress.progress+safe_increment),updated_at=now()
 returning progress into new_progress;
 return jsonb_build_object('ok',true,'progress',new_progress,'target',q.target,'completed',new_progress>=q.target);
end $$;

-- p_reward_xp remains optional only so older clients still resolve the RPC.
-- It is intentionally ignored: the catalog is the only reward authority.
create or replace function public.claim_quest(p_quest_key text,p_period_start date,p_reward_xp integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.club_quest_catalog%rowtype; row public.club_quest_progress%rowtype; xp_total integer;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
 select * into q from public.club_quest_catalog where quest_key=p_quest_key and enabled;
 if q.quest_key is null then raise exception 'Unbekannte Quest.'; end if;
 if (q.cadence='daily' and p_period_start<>current_date) or (q.cadence='weekly' and p_period_start<>date_trunc('week',current_date)::date) then raise exception 'Quest-Zeitraum abgelaufen.'; end if;
 select * into row from public.club_quest_progress where user_id=auth.uid() and quest_key=q.quest_key and period_start=p_period_start for update;
 if row.user_id is null or row.claimed or row.progress<q.target then raise exception 'Quest noch nicht erfüllt.'; end if;
 update public.club_quest_progress set claimed=true,updated_at=now() where user_id=auth.uid() and quest_key=q.quest_key and period_start=p_period_start;
 update public.profiles set xp=greatest(0,coalesce(xp,0)+q.reward_xp),updated_at=now() where id=auth.uid() returning xp into xp_total;
 return jsonb_build_object('ok',true,'claimed',true,'reward_xp',q.reward_xp,'total_xp',xp_total);
end $$;

create or replace function public.sync_weekly_pet_quest()
returns jsonb language plpgsql security definer set search_path=public as $$
declare period date:=date_trunc('week',current_date)::date; q public.club_quest_catalog%rowtype; active_days integer; new_progress integer;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
 select * into q from public.club_quest_catalog where quest_key='weekly_pet' and enabled;
 if q.quest_key is null then return jsonb_build_object('ok',true,'skipped',true); end if;
 select count(distinct activity_date)::integer into active_days from public.club_pet_activity_log
  where user_id=auth.uid() and activity_date>=period and activity_key in ('feed','play','pet','groom','sleep','train','explore');
 insert into public.club_quest_progress(user_id,quest_key,period_start,progress) values(auth.uid(),q.quest_key,period,least(active_days,q.target))
 on conflict(user_id,quest_key,period_start) do update set progress=greatest(public.club_quest_progress.progress,least(active_days,q.target)),updated_at=now()
 returning progress into new_progress;
 return jsonb_build_object('ok',true,'progress',new_progress,'target',q.target,'completed',new_progress>=q.target);
end $$;

revoke all on function public.get_my_quests() from public;
revoke all on function public.increment_quest(text,date,integer) from public;
revoke all on function public.claim_quest(text,date,integer) from public;
revoke all on function public.sync_weekly_pet_quest() from public;
grant execute on function public.get_my_quests() to authenticated;
grant execute on function public.increment_quest(text,date,integer) to authenticated;
grant execute on function public.claim_quest(text,date,integer) to authenticated;
grant execute on function public.sync_weekly_pet_quest() to authenticated;
