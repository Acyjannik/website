-- ACY CLUB PETS / V6.4.4 REPAIR
-- Run this AFTER deploying V6.4.4.
-- It is safe to run more than once.

create table if not exists public.club_pets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  species text not null,
  name text not null,
  hunger integer not null default 100,
  happiness integer not null default 100,
  energy integer not null default 100,
  pet_xp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now()
);

alter table public.club_pets add column if not exists species text;
alter table public.club_pets add column if not exists name text;
alter table public.club_pets add column if not exists hunger integer default 100;
alter table public.club_pets add column if not exists happiness integer default 100;
alter table public.club_pets add column if not exists energy integer default 100;
alter table public.club_pets add column if not exists pet_xp integer default 0;
alter table public.club_pets add column if not exists created_at timestamptz default now();
alter table public.club_pets add column if not exists updated_at timestamptz default now();
alter table public.club_pets add column if not exists last_interaction_at timestamptz default now();

update public.club_pets
set species = coalesce(nullif(species,''), 'cat'),
    name = coalesce(nullif(name,''), 'ACY'),
    hunger = greatest(0, least(100, coalesce(hunger,100))),
    happiness = greatest(0, least(100, coalesce(happiness,100))),
    energy = greatest(0, least(100, coalesce(energy,100))),
    pet_xp = greatest(0, coalesce(pet_xp,0)),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now()),
    last_interaction_at = coalesce(last_interaction_at, now());

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.club_pets'::regclass
      and contype = 'c'
      and conname in ('club_pets_species_check','club_pets_name_check','club_pets_hunger_check',
                      'club_pets_happiness_check','club_pets_energy_check','club_pets_xp_check')
  loop
    execute format('alter table public.club_pets drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.club_pets
  add constraint club_pets_species_check check (
    species in ('cat','dog','fox','axolotl','dragon','unicorn','penguin','panda','bunny','koala','hamster','turtle','owl','frog','bee')
  ),
  add constraint club_pets_name_check check (char_length(trim(name)) between 2 and 18),
  add constraint club_pets_hunger_check check (hunger between 0 and 100),
  add constraint club_pets_happiness_check check (happiness between 0 and 100),
  add constraint club_pets_energy_check check (energy between 0 and 100),
  add constraint club_pets_xp_check check (pet_xp >= 0);

alter table public.club_pets enable row level security;

drop policy if exists "members can read own pet" on public.club_pets;
create policy "members can read own pet"
on public.club_pets for select
to authenticated
using (user_id = auth.uid());

-- This RPC deliberately reads only the caller's own pet.
-- The browser no longer depends on the table's SELECT policy for loading.
create or replace function public.get_club_pet()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.club_pets%rowtype;
  result jsonb;
  elapsed_hours numeric;
  hunger_now integer;
  happiness_now integer;
  energy_now integer;
  hours_to_zero numeric;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  select * into p
  from public.club_pets
  where user_id = auth.uid();

  if p.user_id is null then
    return null;
  end if;

  elapsed_hours := greatest(0, extract(epoch from (now() - p.last_interaction_at)) / 3600.0);

  hunger_now := greatest(0, p.hunger - floor(elapsed_hours * 3)::integer);
  happiness_now := greatest(0, p.happiness - floor(elapsed_hours * 2)::integer);
  energy_now := greatest(0, p.energy - floor(elapsed_hours * 2)::integer);

  -- Death only happens after a care bar has reached 0 and stayed there
  -- for 72 hours. Being offline for a short period is harmless.
  hours_to_zero := least(
    p.hunger / 3.0,
    p.happiness / 2.0,
    p.energy / 2.0
  );

  if elapsed_hours >= hours_to_zero + 72 then
    delete from public.club_pets where user_id = auth.uid();

    return jsonb_build_object(
      '_died', true,
      'name', p.name,
      'species', p.species,
      'reason', 'Ein Pflegewert war 72 Stunden lang auf 0.'
    );
  end if;

  return jsonb_build_object(
    'user_id', p.user_id,
    'species', p.species,
    'name', p.name,
    'hunger', hunger_now,
    'happiness', happiness_now,
    'energy', energy_now,
    'pet_xp', p.pet_xp,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'last_interaction_at', p.last_interaction_at
  );
end;
$$;

revoke all on function public.get_club_pet() from public;
grant execute on function public.get_club_pet() to authenticated;

-- Keep direct table writes locked down.
revoke insert, update, delete on public.club_pets from authenticated;
grant select on public.club_pets to authenticated;


-- V6.5 pet management: replace or release the current companion.
create or replace function public.replace_club_pet(
  p_species text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_species not in ('cat','dog','fox','axolotl','dragon','unicorn','penguin','panda','bunny','koala','hamster','turtle','owl','frog','bee') then
    raise exception 'Ungültige Tierart.';
  end if;

  normalized_name := btrim(p_name);
  if char_length(normalized_name) < 2 or char_length(normalized_name) > 18 then
    raise exception 'Der Tiername muss 2 bis 18 Zeichen lang sein.';
  end if;

  insert into public.club_pets(user_id, species, name, hunger, happiness, energy, pet_xp)
  values (auth.uid(), p_species, normalized_name, 100, 100, 100, 0)
  on conflict (user_id) do update
    set species = excluded.species,
        name = excluded.name,
        hunger = 100,
        happiness = 100,
        energy = 100,
        pet_xp = 0,
        updated_at = now(),
        last_interaction_at = now();

  select jsonb_build_object(
    'user_id', user_id, 'species', species, 'name', name,
    'hunger', hunger, 'happiness', happiness, 'energy', energy,
    'pet_xp', pet_xp, 'created_at', created_at,
    'updated_at', updated_at, 'last_interaction_at', last_interaction_at
  ) into result
  from public.club_pets
  where user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.release_club_pet()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  delete from public.club_pets where user_id = auth.uid();
end;
$$;

revoke all on function public.replace_club_pet(text,text) from public;
revoke all on function public.release_club_pet() from public;
grant execute on function public.replace_club_pet(text,text) to authenticated;
grant execute on function public.release_club_pet() to authenticated;


-- V6.5.1: death-aware pet actions

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

  select * into p
  from public.club_pets
  where user_id = auth.uid()
  for update;

  if p.user_id is null then
    raise exception 'Bitte zuerst ein Tier adoptieren.';
  end if;

  elapsed_hours := greatest(
    0,
    extract(epoch from (now_ts - p.last_interaction_at)) / 3600.0
  );

  -- Balanced decay:
  -- hunger -1/hour, happiness -0.5/hour, energy -0.5/hour.
  hours_to_zero := least(
    p.hunger / 1.0,
    p.happiness / 0.5,
    p.energy / 0.5
  );

  if elapsed_hours >= hours_to_zero + 72 then
    delete from public.club_pets where user_id = auth.uid();
    raise exception 'Dein Tier ist gestorben, weil ein Pflegewert 72 Stunden lang auf 0 war.';
  end if;

  new_hunger := greatest(0, p.hunger - floor(elapsed_hours * 1.0)::integer);
  new_happiness := greatest(0, p.happiness - floor(elapsed_hours * 0.5)::integer);
  new_energy := greatest(0, p.energy - floor(elapsed_hours * 0.5)::integer);

  -- Action cooldowns keep actions meaningful.
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
    if new_energy < 15 then
      raise exception 'Dein Tier ist zu müde zum Spielen.';
    end if;
    new_happiness := least(100, new_happiness + 25);
    new_energy := greatest(0, new_energy - 15);
    new_hunger := greatest(0, new_hunger - 10);
  elsif p_action = 'pet' then
    new_happiness := least(100, new_happiness + 10);
  end if;

  new_pet_xp := p.pet_xp;

  insert into public.club_pet_daily_actions(user_id, action_date)
  values (auth.uid(), current_date)
  on conflict (user_id, action_date) do nothing;

  if found then
    new_pet_xp := new_pet_xp + 5;
    daily_awarded := true;
    perform public.award_club_xp(
      auth.uid(),
      'pet_care_' || current_date::text,
      5
    );
  end if;

  update public.club_pets
  set hunger = new_hunger,
      happiness = new_happiness,
      energy = new_energy,
      pet_xp = new_pet_xp,
      updated_at = now_ts,
      last_interaction_at = now_ts
  where user_id = auth.uid();

  select jsonb_build_object(
    'user_id', user_id,
    'species', species,
    'name', name,
    'hunger', hunger,
    'happiness', happiness,
    'energy', energy,
    'pet_xp', pet_xp,
    'created_at', created_at,
    'updated_at', updated_at,
    'last_interaction_at', last_interaction_at,
    'daily_xp_awarded', daily_awarded
  ) into result
  from public.club_pets
  where user_id = auth.uid();

  return result;
end;
$$;

