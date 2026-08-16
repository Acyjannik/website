-- ACY V11.8 — Pet Pflege-XP fix
-- Run once in Supabase SQL Editor.
-- Every successful feed/play/pet action now grants +5 Pflege-XP.
-- The separate Club-XP reward remains limited to once per calendar day.

create or replace function public.club_pet_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.club_pets%rowtype;
  now_ts timestamptz := now();
  elapsed_hours numeric;
  new_hunger integer;
  new_happiness integer;
  new_energy integer;
  new_pet_xp integer;
  daily_awarded boolean := false;
  hours_to_zero numeric;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_action not in ('feed','play','pet') then raise exception 'Ungültige Aktion.'; end if;

  select * into p from public.club_pets where user_id = auth.uid() for update;
  if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;

  elapsed_hours := greatest(0, extract(epoch from (now_ts - p.last_interaction_at)) / 3600.0);
  hours_to_zero := least(p.hunger / 1.0, p.happiness / 0.5, p.energy / 0.5);

  if elapsed_hours >= hours_to_zero + 72 then
    delete from public.club_pets where user_id = auth.uid();
    raise exception 'Dein Tier ist gestorben, weil ein Pflegewert 72 Stunden lang auf 0 war.';
  end if;

  new_hunger := greatest(0, p.hunger - floor(elapsed_hours * 1.0)::integer);
  new_happiness := greatest(0, p.happiness - floor(elapsed_hours * 0.5)::integer);
  new_energy := greatest(0, p.energy - floor(elapsed_hours * 0.5)::integer);

  if p_action = 'feed' and p.last_interaction_at > now_ts - interval '30 minutes' then
    raise exception 'Dein Tier hat gerade gefressen. Warte ein wenig, bevor du wieder fütterst.';
  elsif p_action = 'play' and p.last_interaction_at > now_ts - interval '45 minutes' then
    raise exception 'Dein Tier braucht nach dem Spielen eine Pause.';
  elsif p_action = 'pet' and p.last_interaction_at > now_ts - interval '15 minutes' then
    raise exception 'Dein Tier genießt die Streicheleinheiten noch.';
  end if;

  if p_action = 'feed' then
    new_hunger := least(100, new_hunger + 35);
    new_happiness := least(100, new_happiness + 5);
  elsif p_action = 'play' then
    if new_energy < 15 then raise exception 'Dein Tier ist zu müde zum Spielen.'; end if;
    new_happiness := least(100, new_happiness + 25);
    new_energy := greatest(0, new_energy - 15);
    new_hunger := greatest(0, new_hunger - 10);
  elsif p_action = 'pet' then
    new_happiness := least(100, new_happiness + 10);
  end if;

  new_pet_xp := coalesce(p.pet_xp, 0) + 5;

  insert into public.club_pet_daily_actions(user_id, action_date)
  values (auth.uid(), current_date)
  on conflict (user_id, action_date) do nothing;

  if found then
    daily_awarded := true;
    perform public.award_club_xp(auth.uid(), 'pet_care_' || current_date::text, 5);
  end if;

  update public.club_pets
  set hunger = new_hunger, happiness = new_happiness, energy = new_energy,
      pet_xp = new_pet_xp, updated_at = now_ts, last_interaction_at = now_ts
  where user_id = auth.uid();

  select jsonb_build_object(
    'user_id', user_id, 'species', species, 'name', name,
    'hunger', hunger, 'happiness', happiness, 'energy', energy,
    'pet_xp', pet_xp, 'created_at', created_at, 'updated_at', updated_at,
    'last_interaction_at', last_interaction_at, 'daily_xp_awarded', daily_awarded
  ) into result
  from public.club_pets where user_id = auth.uid();

  return result;
end;
$$;

revoke all on function public.club_pet_action(text) from public;
grant execute on function public.club_pet_action(text) to authenticated;
