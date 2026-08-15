-- ACY CLUB V7.0 - NOTIFICATION PREFERENCES
create table if not exists public.club_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  email_votes boolean not null default false,
  email_events boolean not null default false,
  email_news boolean not null default false,
  email_live boolean not null default false,
  email_achievements boolean not null default false,
  email_direct_messages boolean not null default false,
  email_spotlight boolean not null default false,
  email_rewards boolean not null default false,
  email_pet boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.club_notification_preferences enable row level security;

drop policy if exists "read own notification preferences" on public.club_notification_preferences;
create policy "read own notification preferences"
on public.club_notification_preferences
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "insert own notification preferences" on public.club_notification_preferences;
create policy "insert own notification preferences"
on public.club_notification_preferences
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "update own notification preferences" on public.club_notification_preferences;
create policy "update own notification preferences"
on public.club_notification_preferences
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_notification_preferences on auth.users;
create trigger trg_ensure_notification_preferences
after insert on auth.users
for each row execute function public.ensure_notification_preferences();

insert into public.club_notification_preferences(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.get_my_notification_preferences()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(to_jsonb(p), '{}'::jsonb)
  from public.club_notification_preferences p
  where p.user_id = auth.uid();
$$;

create or replace function public.save_my_notification_preferences(
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_email_votes boolean,
  p_email_events boolean,
  p_email_news boolean,
  p_email_live boolean,
  p_email_achievements boolean,
  p_email_direct_messages boolean,
  p_email_spotlight boolean,
  p_email_rewards boolean,
  p_email_pet boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  insert into public.club_notification_preferences(
    user_id, in_app_enabled, email_enabled,
    email_votes, email_events, email_news, email_live,
    email_achievements, email_direct_messages, email_spotlight,
    email_rewards, email_pet, updated_at
  )
  values (
    auth.uid(), p_in_app_enabled, p_email_enabled,
    p_email_votes, p_email_events, p_email_news, p_email_live,
    p_email_achievements, p_email_direct_messages, p_email_spotlight,
    p_email_rewards, p_email_pet, now()
  )
  on conflict (user_id) do update set
    in_app_enabled = excluded.in_app_enabled,
    email_enabled = excluded.email_enabled,
    email_votes = excluded.email_votes,
    email_events = excluded.email_events,
    email_news = excluded.email_news,
    email_live = excluded.email_live,
    email_achievements = excluded.email_achievements,
    email_direct_messages = excluded.email_direct_messages,
    email_spotlight = excluded.email_spotlight,
    email_rewards = excluded.email_rewards,
    email_pet = excluded.email_pet,
    updated_at = now();

  return public.get_my_notification_preferences();
end;
$$;

revoke all on function public.get_my_notification_preferences() from public;
revoke all on function public.save_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public;

grant execute on function public.get_my_notification_preferences() to authenticated;
grant execute on function public.save_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
