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
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

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
    'last_interaction_at', last_interaction_at
  )
  into result
  from public.club_pets
  where user_id = auth.uid();

  return result;
end;
$$;

revoke all on function public.get_club_pet() from public;
grant execute on function public.get_club_pet() to authenticated;

-- Keep direct table writes locked down.
revoke insert, update, delete on public.club_pets from authenticated;
grant select on public.club_pets to authenticated;
