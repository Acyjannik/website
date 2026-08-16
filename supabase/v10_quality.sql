-- ACY CLUB V10.0 — Quality, Rotation, Moderation & Push preferences

-- ------------------------------------------------------------
-- Push master preference
-- ------------------------------------------------------------
alter table public.club_notification_preferences
  add column if not exists push_enabled boolean not null default false;

update public.club_notification_preferences
set push_enabled = coalesce(push_enabled, false)
where true;

-- ------------------------------------------------------------
-- Quest catalog + rotating quests
-- ------------------------------------------------------------
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
('daily_social','daily','social','Community-Moment','Schreibe einem Mitglied eine Nachricht.','💬',1,30),
('daily_poll','daily','community','Community Stimme','Stimme bei der aktuellen Umfrage ab.','🗳️',1,15),
('daily_profile','daily','profile','Profil-Check','Besuche heute dein Clubprofil.','🪪',1,10),
('daily_game','daily','games','Game Spotter','Setze für heute ein aktuelles Game.','🎮',1,20),
('daily_streak','daily','streak','Serie halten','Hole deinen Tagesbonus ab.','⚡',1,25),
('daily_friend','daily','social','Kontakt pflegen','Öffne ein anderes Mitgliedsprofil.','👀',1,10),
('weekly_wheel','weekly','rewards','Glücksrad-Woche','Drehe diese Woche mindestens 3-mal.','🎡',3,100),
('weekly_social','weekly','social','Community-Netzwerk','Schließe diese Woche 2 Freundschaften.','👥',2,125),
('weekly_games','weekly','games','Game Explorer','Entdecke diese Woche 3 verschiedene Games über Discord.','🎮',3,150),
('weekly_event','weekly','events','Community dabei','Nimm diese Woche an mindestens 1 Event teil.','📅',1,150),
('weekly_chat','weekly','social','Chat-Stammgast','Schreibe diese Woche 5 Nachrichten im ACY Chat.','💜',5,100),
('weekly_pet','weekly','pet','Pet-Freund','Führe an 4 verschiedenen Tagen Pet-Pflege durch.','🐾',4,100),
('weekly_vote','weekly','community','Community Stimme','Stimme diese Woche bei 2 Votes ab.','🗳️',2,90)
on conflict(quest_key) do update set
  cadence=excluded.cadence,category=excluded.category,title=excluded.title,description=excluded.description,icon=excluded.icon,target=excluded.target,reward_xp=excluded.reward_xp,enabled=true;

create or replace function public.get_my_quests()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  daily jsonb;
  weekly jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select coalesce(jsonb_agg(to_jsonb(q) - 'enabled' order by md5(auth.uid()::text||current_date::text||q.quest_key) desc),'[]'::jsonb)
    into daily
  from (
    select quest_key,cadence,category,title,description,icon,target,reward_xp
    from public.club_quest_catalog
    where enabled and cadence='daily'
    order by md5(auth.uid()::text||current_date::text||quest_key) desc
    limit 4
  ) q;

  select coalesce(jsonb_agg(to_jsonb(q) - 'enabled' order by md5(auth.uid()::text||date_trunc('week',current_date)::date::text||q.quest_key) desc),'[]'::jsonb)
    into weekly
  from (
    select quest_key,cadence,category,title,description,icon,target,reward_xp
    from public.club_quest_catalog
    where enabled and cadence='weekly'
    order by md5(auth.uid()::text||date_trunc('week',current_date)::date::text||quest_key) desc
    limit 4
  ) q;

  return jsonb_build_object(
    'daily',daily,
    'weekly',weekly,
    'periods',jsonb_build_object('daily',current_date,'weekly',date_trunc('week',current_date)::date)
  );
end;
$$;

create or replace function public.increment_quest(p_quest_key text,p_period_start date,p_increment integer default 1)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  q record;
  new_progress integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select * into q from public.club_quest_catalog where quest_key=p_quest_key and enabled=true limit 1;
  if q.quest_key is null then raise exception 'Unbekannte Quest.'; end if;
  if q.cadence='daily' and p_period_start<>current_date then raise exception 'Quest-Zeitraum abgelaufen.'; end if;
  if q.cadence='weekly' and p_period_start<>date_trunc('week',current_date)::date then raise exception 'Quest-Zeitraum abgelaufen.'; end if;

  insert into public.club_quest_progress(user_id,quest_key,period_start,progress)
  values(auth.uid(),p_quest_key,p_period_start,greatest(0,p_increment))
  on conflict(user_id,quest_key,period_start)
  do update set progress=least(q.target,public.club_quest_progress.progress+greatest(0,p_increment)),updated_at=now()
  returning progress into new_progress;

  return jsonb_build_object('ok',true,'progress',new_progress,'target',q.target,'completed',new_progress>=q.target);
end;
$$;

create or replace function public.claim_quest(p_quest_key text,p_period_start date,p_reward_xp integer default 0)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  q record;
  row public.club_quest_progress%rowtype;
  xp_total integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select * into q from public.club_quest_catalog where quest_key=p_quest_key and enabled=true limit 1;
  if q.quest_key is null then raise exception 'Unbekannte Quest.'; end if;
  select * into row from public.club_quest_progress
   where user_id=auth.uid() and quest_key=p_quest_key and period_start=p_period_start for update;
  if row.user_id is null or row.claimed or row.progress<q.target then raise exception 'Quest noch nicht erfüllt.'; end if;

  update public.club_quest_progress set claimed=true,updated_at=now()
   where user_id=auth.uid() and quest_key=p_quest_key and period_start=p_period_start;

  update public.profiles set xp=greatest(0,coalesce(xp,0)+q.reward_xp),updated_at=now()
   where id=auth.uid() returning xp into xp_total;

  return jsonb_build_object('ok',true,'claimed',true,'reward_xp',q.reward_xp,'total_xp',xp_total);
end;
$$;

revoke all on function public.get_my_quests() from public;
revoke all on function public.increment_quest(text,date,integer) from public;
revoke all on function public.claim_quest(text,date,integer) from public;
grant execute on function public.get_my_quests() to authenticated;
grant execute on function public.increment_quest(text,date,integer) to authenticated;
grant execute on function public.claim_quest(text,date,integer) to authenticated;

-- ------------------------------------------------------------
-- Community reports
-- ------------------------------------------------------------
create table if not exists public.club_reports (
  id bigint generated by default as identity primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  target_type text not null default 'member',
  target_id text,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewed','ignored','warned','escalated')),
  moderator_note text,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_club_reports_open on public.club_reports(status,created_at desc);
create index if not exists idx_club_reports_target on public.club_reports(target_user_id,created_at desc);
alter table public.club_reports enable row level security;
drop policy if exists "members create reports" on public.club_reports;
create policy "members create reports" on public.club_reports for insert to authenticated with check (reporter_id=auth.uid());
drop policy if exists "members read own reports" on public.club_reports;
create policy "members read own reports" on public.club_reports for select to authenticated using (reporter_id=auth.uid());

-- Moderators may manage chat bans and delete chat messages.
drop policy if exists "mods manage chat bans" on public.club_chat_bans;
create policy "mods manage chat bans" on public.club_chat_bans for all to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()) or exists(select 1 from public.club_moderators m where m.user_id=auth.uid()))
with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()) or exists(select 1 from public.club_moderators m where m.user_id=auth.uid()));
drop policy if exists "mods can moderate chat" on public.club_chat_messages;
create policy "mods can moderate chat" on public.club_chat_messages for delete to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()) or exists(select 1 from public.club_moderators m where m.user_id=auth.uid()));
