-- ACY V11.5 — Expanded wheel + notification cleanup
-- Run once in Supabase SQL Editor.

-- Expanded wheel rewards.
insert into public.club_rewards
  (reward_key,name,description,icon,reward_type,reward_value,enabled,sort_order)
values
  ('xp_500','500 XP','500 zusätzliche Club-XP.','🪙','xp',500,true,45),
  ('xp_1000','1.000 XP','1.000 zusätzliche Club-XP.','👑','xp',1000,true,46),
  ('pet_boost_big','Pet-Mega-Boost','Großer Pflege-, Laune- und Energie-Boost.','💖','pet',2,true,51),
  ('extra_spin_2','2 Extra-Drehs','Zwei weitere Drehungen am ACY Glücksrad.','🎡','wheel_spin',2,true,61),
  ('xp_jackpot','XP-Jackpot','2.500 zusätzliche Club-XP.','🎰','xp',2500,true,41)
on conflict (reward_key) do update set
  name=excluded.name,description=excluded.description,icon=excluded.icon,
  reward_type=excluded.reward_type,reward_value=excluded.reward_value,
  enabled=excluded.enabled,sort_order=excluded.sort_order,updated_at=now();

-- Wheel reward logic with 12 outcomes.
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
  new_xp integer;
  reward_class text;
  available_tokens integer := 0;
  consumed_token boolean := false;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select coalesce(wheel_spin_tokens,0) into available_tokens
  from public.profiles where id=auth.uid();

  select max(created_at) into last_spin
  from public.club_wheel_spins where user_id=auth.uid();

  if last_spin is not null and last_spin > now()-interval '24 hours' then
    if available_tokens > 0 then
      update public.profiles
      set wheel_spin_tokens=wheel_spin_tokens-1,updated_at=now()
      where id=auth.uid() and wheel_spin_tokens>0;
      consumed_token:=found;
      if not consumed_token then raise exception 'Dein Extra-Dreh konnte nicht verwendet werden.'; end if;
    else
      return jsonb_build_object(
        'ok',false,'cooldown',true,
        'next_free_at',last_spin+interval '24 hours',
        'spin_tokens',available_tokens
      );
    end if;
  end if;

  roll:=random();

  if roll < 0.22 then
    reward_key:='xp_25'; reward_label:='+25 XP'; reward_value:=25; reward_class:='xp';
  elsif roll < 0.40 then
    reward_key:='xp_50'; reward_label:='+50 XP'; reward_value:=50; reward_class:='xp';
  elsif roll < 0.54 then
    reward_key:='xp_100'; reward_label:='+100 XP'; reward_value:=100; reward_class:='xp';
  elsif roll < 0.64 then
    reward_key:='xp_250'; reward_label:='+250 XP'; reward_value:=250; reward_class:='xp';
  elsif roll < 0.71 then
    reward_key:='xp_500'; reward_label:='+500 XP'; reward_value:=500; reward_class:='xp';
  elsif roll < 0.74 then
    reward_key:='xp_1000'; reward_label:='+1.000 XP'; reward_value:=1000; reward_class:='xp';
  elsif roll < 0.82 then
    reward_key:='pet_care'; reward_label:='🐾 Pet-Bonus'; reward_value:=0; reward_class:='pet';
  elsif roll < 0.85 then
    reward_key:='pet_boost_big'; reward_label:='💖 Pet-Mega-Boost'; reward_value:=0; reward_class:='pet_big';
  elsif roll < 0.92 then
    reward_key:='extra_spin'; reward_label:='🎡 Extra-Dreh'; reward_value:=1; reward_class:='spin';
  elsif roll < 0.94 then
    reward_key:='extra_spin_2'; reward_label:='🎡 2 Extra-Drehs'; reward_value:=2; reward_class:='spin';
  elsif roll < 0.98 then
    reward_key:='twitch_reward'; reward_label:='💜 Twitch-Reward'; reward_value:=0; reward_class:='twitch';
  else
    reward_key:='xp_jackpot'; reward_label:='🎰 +2.500 XP Jackpot'; reward_value:=2500; reward_class:='xp';
  end if;

  if reward_class='xp' then
    update public.profiles
    set xp=greatest(0,coalesce(xp,0)+reward_value),updated_at=now()
    where id=auth.uid()
    returning xp into new_xp;
    if new_xp is null then raise exception 'Profil konnte nicht aktualisiert werden.'; end if;
  end if;

  if reward_class='spin' then
    update public.profiles
    set wheel_spin_tokens=coalesce(wheel_spin_tokens,0)+greatest(1,reward_value),
        updated_at=now()
    where id=auth.uid();
  end if;

  insert into public.club_wheel_spins(user_id,reward_key,reward_label,reward_value)
  values(auth.uid(),reward_key,reward_label,reward_value);

  if reward_class='pet' then
    update public.club_pets
    set happiness=least(100,coalesce(happiness,0)+10),
        energy=least(100,coalesce(energy,0)+10),
        updated_at=now()
    where user_id=auth.uid();
  elsif reward_class='pet_big' then
    update public.club_pets
    set hunger=least(100,coalesce(hunger,0)+25),
        happiness=least(100,coalesce(happiness,0)+25),
        energy=least(100,coalesce(energy,0)+25),
        updated_at=now()
    where user_id=auth.uid();
  end if;

  select coalesce(wheel_spin_tokens,0) into available_tokens
  from public.profiles where id=auth.uid();

  return jsonb_build_object(
    'ok',true,'reward_key',reward_key,'reward_label',reward_label,
    'reward_value',reward_value,'reward_class',
    case when reward_class='pet_big' then 'pet' else reward_class end,
    'total_xp',new_xp,'spin_tokens',available_tokens,
    'consumed_token',consumed_token,'next_free_at',now()+interval '24 hours'
  );
end;
$$;

revoke all on function public.spin_club_wheel() from public;
grant execute on function public.spin_club_wheel() to authenticated;

-- Clean old notification pile for a specific user if needed:
-- Users can now delete individual notifications or all notifications from the UI.
