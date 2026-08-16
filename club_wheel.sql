-- ACY CLUB V7.7 — Glücksrad
create table if not exists public.club_wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,
  reward_label text not null,
  reward_value integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.club_wheel_spins enable row level security;

-- Extra Dreh: separate token balance so a won extra spin bypasses the daily cooldown.
alter table public.profiles add column if not exists wheel_spin_tokens integer not null default 0;


drop policy if exists "members can read own wheel spins" on public.club_wheel_spins;
create policy "members can read own wheel spins"
on public.club_wheel_spins for select to authenticated
using (user_id = auth.uid());

create index if not exists idx_club_wheel_spins_user_created
on public.club_wheel_spins(user_id, created_at desc);

create or replace function public.spin_club_wheel()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  last_spin timestamptz;
  roll numeric;
  reward_key text;
  reward_label text;
  reward_value integer := 0;
  next_free_at timestamptz;
  new_xp integer;
  reward_class text;
  available_tokens integer := 0;
  consumed_token boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  -- A user can always spend an Extra-Dreh token, even during the 24h cooldown.
  select coalesce(wheel_spin_tokens,0)
  into available_tokens
  from public.profiles
  where id = auth.uid();

  select max(created_at) into last_spin
  from public.club_wheel_spins
  where user_id = auth.uid();

  if last_spin is not null and last_spin > now() - interval '24 hours' then
    if available_tokens > 0 then
      update public.profiles
      set wheel_spin_tokens = wheel_spin_tokens - 1,
          updated_at = now()
      where id = auth.uid() and wheel_spin_tokens > 0;
      consumed_token := found;

      if not consumed_token then
        raise exception 'Dein Extra-Dreh konnte nicht verwendet werden.';
      end if;
    else
      return jsonb_build_object(
        'ok',false,
        'cooldown',true,
        'next_free_at',last_spin + interval '24 hours',
        'spin_tokens',available_tokens
      );
    end if;
  end if;

  roll := random();

  if roll < 0.30 then
    reward_key := 'xp_25'; reward_label := '+25 XP'; reward_value := 25; reward_class := 'xp';
  elsif roll < 0.53 then
    reward_key := 'xp_50'; reward_label := '+50 XP'; reward_value := 50; reward_class := 'xp';
  elsif roll < 0.70 then
    reward_key := 'xp_100'; reward_label := '+100 XP'; reward_value := 100; reward_class := 'xp';
  elsif roll < 0.82 then
    reward_key := 'xp_250'; reward_label := '+250 XP'; reward_value := 250; reward_class := 'xp';
  elsif roll < 0.90 then
    reward_key := 'pet_care'; reward_label := '🐾 Pet-Bonus'; reward_value := 0; reward_class := 'pet';
  elsif roll < 0.96 then
    reward_key := 'extra_spin'; reward_label := '🎡 Extra Dreh'; reward_value := 1; reward_class := 'spin';
  else
    reward_key := 'twitch_reward'; reward_label := '💜 Twitch-Reward'; reward_value := 0; reward_class := 'twitch';
  end if;

  if reward_class = 'xp' then
    update public.profiles
    set xp = greatest(0, coalesce(xp,0) + reward_value),
        updated_at = now()
    where id = auth.uid()
    returning xp into new_xp;

    if new_xp is null then
      raise exception 'Profil konnte nicht aktualisiert werden.';
    end if;
  end if;

  if reward_class = 'spin' then
    update public.profiles
    set wheel_spin_tokens = coalesce(wheel_spin_tokens,0) + 1,
        updated_at = now()
    where id = auth.uid();
  end if;

  insert into public.club_wheel_spins(user_id,reward_key,reward_label,reward_value)
  values(auth.uid(),reward_key,reward_label,reward_value);

  if reward_class = 'pet' then
    update public.club_pets
    set happiness = least(100,coalesce(happiness,0)+10),
        energy = least(100,coalesce(energy,0)+10),
        updated_at = now()
    where user_id = auth.uid();
  end if;

  select coalesce(wheel_spin_tokens,0)
  into available_tokens
  from public.profiles
  where id = auth.uid();

  return jsonb_build_object(
    'ok',true,
    'reward_key',reward_key,
    'reward_label',reward_label,
    'reward_value',reward_value,
    'reward_class',reward_class,
    'total_xp',new_xp,
    'spin_tokens',available_tokens,
    'consumed_token',consumed_token,
    'next_free_at',now()+interval '24 hours'
  );
end;
$$;

revoke all on function public.spin_club_wheel() from public;
grant execute on function public.spin_club_wheel() to authenticated;
