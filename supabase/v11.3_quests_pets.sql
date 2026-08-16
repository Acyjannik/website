

-- V11.3.1: passive pet stats are applied when loading the pet
create or replace function public.get_club_pet()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.club_pets%rowtype;
  elapsed_hours numeric;
  hunger_now integer;
  happiness_now integer;
  energy_now integer;
  hours_to_zero numeric;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select * into p
  from public.club_pets
  where user_id=auth.uid()
  for update;

  if p.user_id is null then return null; end if;

  elapsed_hours := greatest(
    0,
    extract(epoch from (now()-coalesce(p.last_interaction_at,p.updated_at,p.created_at)))/3600.0
  );

  hunger_now := greatest(0,p.hunger-floor(elapsed_hours*1.0)::integer);
  happiness_now := greatest(0,p.happiness-floor(elapsed_hours*0.5)::integer);
  energy_now := least(100,greatest(0,p.energy+floor(elapsed_hours*1.5)::integer));

  -- Death checks the care bars only. Energy regenerates and therefore cannot kill the pet.
  hours_to_zero := least(
    p.hunger/1.0,
    p.happiness/0.5,
    999999.0
  );

  if elapsed_hours >= hours_to_zero + 72 then
    delete from public.club_pets where user_id=auth.uid();
    return jsonb_build_object(
      '_died',true,
      'name',p.name,
      'species',p.species,
      'reason','Ein Pflegewert war 72 Stunden lang auf 0.'
    );
  end if;

  update public.club_pets
  set hunger=hunger_now,
      happiness=happiness_now,
      energy=energy_now,
      updated_at=now()
  where user_id=auth.uid();

  return jsonb_build_object(
    'user_id',p.user_id,
    'species',p.species,
    'name',p.name,
    'hunger',hunger_now,
    'happiness',happiness_now,
    'energy',energy_now,
    'pet_xp',coalesce(p.pet_xp,0),
    'created_at',p.created_at,
    'updated_at',now(),
    'last_interaction_at',p.last_interaction_at
  );
end;
$$;

revoke all on function public.get_club_pet() from public;
grant execute on function public.get_club_pet() to authenticated;
