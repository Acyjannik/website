-- ACYJANNIK V17.6 — Pet Archive, Species Talents, Wheel Integration
-- Run once in Supabase SQL Editor AFTER V17.5.

-- 1) Archive storage. The active pet stays in club_pets; archived pets are kept safely here.
create table if not exists public.club_pet_archive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species text not null,
  name text not null,
  hunger integer not null default 100,
  happiness integer not null default 100,
  energy integer not null default 100,
  pet_xp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  archived_at timestamptz not null default now()
);
alter table public.club_pet_archive enable row level security;
drop policy if exists "members can read own pet archive" on public.club_pet_archive;
create policy "members can read own pet archive" on public.club_pet_archive for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.club_pet_archive from authenticated;
create index if not exists club_pet_archive_user_archived_idx on public.club_pet_archive(user_id,archived_at desc);

-- 2) Species talent catalog. This is the server-side source of truth.
create or replace function public.get_pet_species_profile(p_species text)
returns jsonb language plpgsql immutable security invoker set search_path=public as $$
begin
  return case p_species
    when 'cat' then jsonb_build_object('key','cozy','icon','💜','title','Kuschelbonus','description','Streicheln gibt +15 Laune statt +10.')
    when 'dog' then jsonb_build_object('key','playful','icon','🎾','title','Spieltrieb','description','Spielen gibt +35 Laune statt +25 und kostet 13 Energie.')
    when 'fox' then jsonb_build_object('key','clever','icon','🦊','title','Schlaukopf','description','Minigames geben 25% mehr AC Coins.')
    when 'axolotl' then jsonb_build_object('key','regeneration','icon','💧','title','Regeneration','description','Hunger, Laune und Energie sinken langsamer.')
    when 'dragon' then jsonb_build_object('key','feast','icon','🔥','title','Feuerhunger','description','Futter gibt 15% mehr Hunger.')
    when 'unicorn' then jsonb_build_object('key','lucky','icon','🦄','title','Glückskind','description','Bessere Chancen auf seltene Pet-Rewards bei Glücksrad und Mystery Box.')
    when 'penguin' then jsonb_build_object('key','ice_calm','icon','❄️','title','Eiskalt','description','Energie sinkt besonders langsam.')
    when 'panda' then jsonb_build_object('key','snacker','icon','🍪','title','Snackfreund','description','Futter gibt zusätzlich +5 Laune.')
    when 'bunny' then jsonb_build_object('key','quick','icon','🐇','title','Flink','description','Snack Hunt kann einen zusätzlichen Snack finden.')
    when 'koala' then jsonb_build_object('key','sleepy','icon','😴','title','Schlafprofi','description','Schlafen gibt +45 Energie statt +30.')
    when 'hamster' then jsonb_build_object('key','hoarder','icon','🐹','title','Sammler','description','Tagesvorrat gibt einen zusätzlichen Snack.')
    when 'turtle' then jsonb_build_object('key','shell','icon','🐢','title','Schildkrötenpanzer','description','Alle drei Pflegewerte sinken deutlich langsamer.')
    when 'owl' then jsonb_build_object('key','wise','icon','🦉','title','Wachsam','description','Lucky Paw hat bessere Belohnungschancen.')
    when 'frog' then jsonb_build_object('key','cheerful','icon','🐸','title','Quirlige Laune','description','Streicheln gibt +15 Laune und +1 Pflege-XP.')
    when 'bee' then jsonb_build_object('key','busy','icon','🐝','title','Fleißig','description','Erfolgreiche Pflegeaktionen geben +6 Pflege-XP statt +5.')
    else jsonb_build_object('key','basic','icon','🐾','title','Begleiter','description','Ein treuer ACY Begleiter.')
  end;
end $$;

-- 3) Archive helper. Keeps the current pet exactly as it is.
create or replace function public.archive_club_pet()
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.club_pets%rowtype; aid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select * into p from public.club_pets where user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'Kein aktives Tier vorhanden.'; end if;
  insert into public.club_pet_archive(user_id,species,name,hunger,happiness,energy,pet_xp,created_at,updated_at,last_interaction_at)
  values(p.user_id,p.species,p.name,p.hunger,p.happiness,p.energy,p.pet_xp,p.created_at,p.updated_at,p.last_interaction_at)
  returning id into aid;
  delete from public.club_pets where user_id=auth.uid();
  return jsonb_build_object('ok',true,'archive_id',aid,'message',p.name||' wurde archiviert. 🐾');
end $$;

-- 4) Switching is safe: active pet is archived first, selected archive is restored.
create or replace function public.switch_to_archived_club_pet(p_archive_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oldp public.club_pets%rowtype; a public.club_pet_archive%rowtype; newp jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select * into a from public.club_pet_archive where id=p_archive_id and user_id=auth.uid() for update;
  if a.id is null then raise exception 'Archiviertes Tier nicht gefunden.'; end if;
  select * into oldp from public.club_pets where user_id=auth.uid() for update;
  if oldp.user_id is not null then
    insert into public.club_pet_archive(user_id,species,name,hunger,happiness,energy,pet_xp,created_at,updated_at,last_interaction_at)
    values(oldp.user_id,oldp.species,oldp.name,oldp.hunger,oldp.happiness,oldp.energy,oldp.pet_xp,oldp.created_at,oldp.updated_at,oldp.last_interaction_at);
    delete from public.club_pets where user_id=auth.uid();
  end if;
  insert into public.club_pets(user_id,species,name,hunger,happiness,energy,pet_xp,created_at,updated_at,last_interaction_at)
  values(a.user_id,a.species,a.name,a.hunger,a.happiness,a.energy,a.pet_xp,a.created_at,now(),a.last_interaction_at)
  on conflict(user_id) do update set species=excluded.species,name=excluded.name,hunger=excluded.hunger,happiness=excluded.happiness,energy=excluded.energy,pet_xp=excluded.pet_xp,updated_at=now(),last_interaction_at=excluded.last_interaction_at;
  delete from public.club_pet_archive where id=a.id;
  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'created_at',created_at,'updated_at',updated_at,'last_interaction_at',last_interaction_at,'species_trait',public.get_pet_species_profile(species)) into newp from public.club_pets where user_id=auth.uid();
  return jsonb_build_object('ok',true,'pet',newp,'message',a.name||' ist jetzt dein aktiver Begleiter. 🐾','hub',public.get_pet_life_hub());
end $$;

-- 5) Existing "Wechseln" action becomes archive-safe. No old pet is silently destroyed.
create or replace function public.replace_club_pet(p_species text,p_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oldp public.club_pets%rowtype; normalized_name text; result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_species not in ('cat','dog','fox','axolotl','dragon','unicorn','penguin','panda','bunny','koala','hamster','turtle','owl','frog','bee') then raise exception 'Ungültige Tierart.'; end if;
  normalized_name:=btrim(p_name); if char_length(normalized_name)<2 or char_length(normalized_name)>18 then raise exception 'Der Tiername muss 2 bis 18 Zeichen lang sein.'; end if;
  select * into oldp from public.club_pets where user_id=auth.uid() for update;
  if oldp.user_id is not null then
    insert into public.club_pet_archive(user_id,species,name,hunger,happiness,energy,pet_xp,created_at,updated_at,last_interaction_at)
    values(oldp.user_id,oldp.species,oldp.name,oldp.hunger,oldp.happiness,oldp.energy,oldp.pet_xp,oldp.created_at,oldp.updated_at,oldp.last_interaction_at);
  end if;
  insert into public.club_pets(user_id,species,name,hunger,happiness,energy,pet_xp) values(auth.uid(),p_species,normalized_name,100,100,100,0)
  on conflict(user_id) do update set species=excluded.species,name=excluded.name,hunger=100,happiness=100,energy=100,pet_xp=0,updated_at=now(),last_interaction_at=now();
  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'created_at',created_at,'updated_at',updated_at,'last_interaction_at',last_interaction_at,'species_trait',public.get_pet_species_profile(species)) into result from public.club_pets where user_id=auth.uid();
  return result;
end $$;

-- 6) get_club_pet now exposes the talent and species-specific decay.
create or replace function public.get_club_pet() returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.club_pets%rowtype; elapsed numeric; h int; ha int; e int; mult_h numeric:=1; mult_ha numeric:=1; mult_e numeric:=1; trait jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select * into p from public.club_pets where user_id=auth.uid(); if p.user_id is null then return null; end if;
  trait:=public.get_pet_species_profile(p.species);
  if p.species='axolotl' then mult_h:=.70; mult_ha:=.70; mult_e:=.70; elsif p.species='penguin' then mult_e:=.45; elsif p.species='turtle' then mult_h:=.55; mult_ha:=.55; mult_e:=.55; end if;
  elapsed:=greatest(0,extract(epoch from(now()-p.last_interaction_at))/3600.0);
  h:=greatest(0,p.hunger-floor(elapsed*1*mult_h)::int); ha:=greatest(0,p.happiness-floor(elapsed*.5*mult_ha)::int); e:=greatest(0,p.energy-floor(elapsed*.5*mult_e)::int);
  return jsonb_build_object('user_id',p.user_id,'species',p.species,'name',p.name,'hunger',h,'happiness',ha,'energy',e,'pet_xp',p.pet_xp,'created_at',p.created_at,'updated_at',p.updated_at,'last_interaction_at',p.last_interaction_at,'species_trait',trait);
end $$;

-- 7) Pet hub includes archive and trait. Inventory remains user-level by design.
create or replace function public.get_pet_life_hub() returns jsonb
language plpgsql security definer set search_path=public as $$
declare p jsonb; coins int; today date; items jsonb; shop jsonb; archives jsonb; feed_count int; play_count int; pet_count int; groom_count int; sleep_count int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; p:=public.get_club_pet(); select coalesce(ac_coins,0) into coins from public.profiles where id=auth.uid(); today:=(now() at time zone 'Europe/Berlin')::date;
  select coalesce(jsonb_agg(jsonb_build_object('key',i.item_key,'name',i.name,'icon',i.icon,'detail',i.detail,'quantity',inv.quantity,'item_type',i.item_type,'hunger',i.hunger,'happiness',i.happiness,'energy',i.energy,'xp',i.xp) order by i.sort_order),'[]'::jsonb) into items from public.club_pet_inventory inv join public.club_pet_items i on i.id=inv.item_id where inv.user_id=auth.uid() and inv.quantity>0 and i.enabled;
  select coalesce(jsonb_agg(jsonb_build_object('key',item_key,'name',name,'icon',icon,'detail',detail,'cost',cost,'hunger',hunger,'happiness',happiness,'energy',energy,'xp',xp,'item_type',item_type) order by sort_order),'[]'::jsonb) into shop from public.club_pet_items where enabled and cost>0;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'species',a.species,'species_label',case a.species when 'cat' then 'Katze' when 'dog' then 'Hund' when 'fox' then 'Fuchs' when 'axolotl' then 'Axolotl' when 'dragon' then 'Drache' when 'unicorn' then 'Einhorn' when 'penguin' then 'Pinguin' when 'panda' then 'Panda' when 'bunny' then 'Hase' when 'koala' then 'Koala' when 'hamster' then 'Hamster' when 'turtle' then 'Schildkröte' when 'owl' then 'Eule' when 'frog' then 'Frosch' when 'bee' then 'Biene' else 'Begleiter' end,'name',a.name,'pet_xp',a.pet_xp,'level',case when a.pet_xp>=10000 then 10 when a.pet_xp>=6500 then 9 when a.pet_xp>=4250 then 8 when a.pet_xp>=2750 then 7 when a.pet_xp>=1750 then 6 when a.pet_xp>=1000 then 5 when a.pet_xp>=500 then 4 when a.pet_xp>=250 then 3 when a.pet_xp>=100 then 2 else 1 end,'archived_at',a.archived_at) order by a.archived_at desc),'[]'::jsonb) into archives from public.club_pet_archive a where a.user_id=auth.uid();
  select count(*) filter(where activity_key='feed'),count(*) filter(where activity_key='play'),count(*) filter(where activity_key='pet'),count(*) filter(where activity_key='groom'),count(*) filter(where activity_key='sleep') into feed_count,play_count,pet_count,groom_count,sleep_count from public.club_pet_activity_log where user_id=auth.uid() and activity_date=today;
  return jsonb_build_object('pet',p,'ac_coins',coins,'inventory',items,'shop',shop,'archives',archives,'daily_supply_claimed',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='daily_supply' and activity_date=today),'limits',jsonb_build_object('feed',jsonb_build_object('remaining',greatest(0,3-feed_count)),'play',jsonb_build_object('remaining',greatest(0,2-play_count)),'pet',jsonb_build_object('remaining',greatest(0,3-pet_count)),'groom',jsonb_build_object('remaining',greatest(0,1-groom_count)),'sleep',jsonb_build_object('remaining',greatest(0,1-sleep_count))),'games',jsonb_build_object('snack_hunt',jsonb_build_object('used',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='snack_hunt' and activity_date=today)),'lucky_paw',jsonb_build_object('used',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='lucky_paw' and activity_date=today))));
end $$;

-- 8) Species-aware care actions.
create or replace function public.club_pet_action(p_action text) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.club_pets%rowtype; elapsed numeric; h int;ha int;e int; xp_gain int:=5; lim int; today date:=(now() at time zone 'Europe/Berlin')::date; result jsonb; max_daily int; play_happy int:=25; play_cost int:=15; pet_happy int:=10; sleep_energy int:=30;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; if p_action not in('feed','play','pet','groom','sleep') then raise exception 'Ungültige Pet-Aktion.'; end if;
  select * into p from public.club_pets where user_id=auth.uid() for update; if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':pet:'||p_action,0));
  elapsed:=greatest(0,extract(epoch from(now()-p.last_interaction_at))/3600.0);
  h:=greatest(0,p.hunger-floor(elapsed*(case when p.species in('axolotl','turtle') then .7 else 1 end))::int); ha:=greatest(0,p.happiness-floor(elapsed*(case when p.species in('axolotl','turtle') then .35 else .5 end))::int); e:=greatest(0,p.energy-floor(elapsed*(case when p.species='penguin' then .22 when p.species in('axolotl','turtle') then .35 else .5 end))::int);
  max_daily:=case p_action when 'feed' then 3 when 'play' then 2 when 'pet' then 3 when 'groom' then 1 when 'sleep' then 1 end;
  select count(*) into lim from public.club_pet_activity_log where user_id=auth.uid() and activity_key=p_action and activity_date=today; if lim>=max_daily then raise exception 'Für heute ist dieses Pflege-Limit erreicht.'; end if;
  if p.species='dog' and p_action='play' then play_happy:=35; play_cost:=13; end if;
  if p.species='cat' and p_action='pet' then pet_happy:=15; elsif p.species='frog' and p_action='pet' then pet_happy:=15; end if;
  if p.species='koala' and p_action='sleep' then sleep_energy:=45; end if;
  if p.species='bee' then xp_gain:=6; end if;
  if p.species='frog' and p_action='pet' then xp_gain:=xp_gain+1; end if;
  if p_action='feed' then raise exception 'Füttern erfolgt über die Futterauswahl.'; end if;
  if p_action='play' then if e<play_cost then raise exception 'Dein Tier ist zu müde zum Spielen.'; end if; ha:=least(100,ha+play_happy); e:=greatest(0,e-play_cost); h:=greatest(0,h-8);
  elsif p_action='pet' then ha:=least(100,ha+pet_happy);
  elsif p_action='groom' then ha:=least(100,ha+15); e:=least(100,e+10);
  elsif p_action='sleep' then e:=least(100,e+sleep_energy); h:=greatest(0,h-3); end if;
  insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),p_action,today,jsonb_build_object('xp',xp_gain,'species',p.species));
  update public.club_pets set hunger=h,happiness=ha,energy=e,pet_xp=pet_xp+xp_gain,updated_at=now(),last_interaction_at=now() where user_id=auth.uid();
  perform public.award_club_xp(auth.uid(),'pet_care_'||current_date::text,5);
  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'last_interaction_at',last_interaction_at,'species_trait',public.get_pet_species_profile(species)) into result from public.club_pets where user_id=auth.uid(); return result;
end $$;

-- 9) Species-aware food use. Food is still limited to 3 feedings/day.
create or replace function public.use_pet_item(p_item_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.club_pets%rowtype; item public.club_pet_items%rowtype; inv public.club_pet_inventory%rowtype; result jsonb; today date:=(now() at time zone 'Europe/Berlin')::date; feed_count int; elapsed numeric; h int; ha int; e int; xp_gain int:=0; msg text; hunger_bonus numeric:=1;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':item:'||p_item_key,0));
  select * into p from public.club_pets where user_id=auth.uid() for update; if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  select * into item from public.club_pet_items where item_key=p_item_key and enabled; if item.id is null then raise exception 'Dieses Pet-Item gibt es nicht.'; end if;
  select * into inv from public.club_pet_inventory where user_id=auth.uid() and item_id=item.id for update; if coalesce(inv.quantity,0)<1 then raise exception 'Du hast dieses Item nicht auf Vorrat.'; end if;
  elapsed:=greatest(0,extract(epoch from(now()-p.last_interaction_at))/3600.0); h:=greatest(0,p.hunger-floor(elapsed*1)::int); ha:=greatest(0,p.happiness-floor(elapsed*.5)::int); e:=greatest(0,p.energy-floor(elapsed*.5)::int);
  if item.item_type='food' then
    select count(*) into feed_count from public.club_pet_activity_log where user_id=auth.uid() and activity_key='feed' and activity_date=today; if feed_count>=3 then raise exception 'Für heute sind alle 3 Fütterungen aufgebraucht.'; end if;
    if p.species='dragon' then hunger_bonus:=1.15; end if; h:=least(100,h+round(item.hunger*hunger_bonus)); ha:=least(100,ha+item.happiness+case when p.species='panda' then 5 else 0 end); e:=least(100,e+item.energy); xp_gain:=greatest(1,item.xp);
    insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),'feed',today,jsonb_build_object('item_key',item.item_key,'species',p.species)); msg:=format('%s %s verwendet. +%s Hunger.',item.icon,item.name,round(item.hunger*hunger_bonus));
  elsif item.item_type='boost' then e:=least(100,e+item.energy); xp_gain:=greatest(1,item.xp); insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),'item_use',today,jsonb_build_object('item_key',item.item_key)); msg:=format('%s %s verwendet. +%s Energie.',item.icon,item.name,item.energy);
  else ha:=least(100,ha+item.happiness); e:=greatest(0,e+item.energy); xp_gain:=greatest(1,item.xp); insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),'item_use',today,jsonb_build_object('item_key',item.item_key)); msg:=format('%s %s benutzt. +%s Laune.',item.icon,item.name,item.happiness); end if;
  update public.club_pet_inventory set quantity=quantity-1,updated_at=now() where user_id=auth.uid() and item_id=item.id;
  update public.club_pets set hunger=h,happiness=ha,energy=e,pet_xp=pet_xp+xp_gain,updated_at=now(),last_interaction_at=now() where user_id=auth.uid();
  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'last_interaction_at',last_interaction_at,'species_trait',public.get_pet_species_profile(species)) into p;
  return jsonb_build_object('ok',true,'message',msg,'pet',p,'hub',public.get_pet_life_hub());
end $$;

-- 10) Species-aware mini-games.
create or replace function public.play_pet_minigame(p_game text) returns jsonb language plpgsql security definer set search_path=public as $$
declare today date:=(now() at time zone 'Europe/Berlin')::date; key text; roll numeric:=random(); reward int:=1; coins int:=0; iid uuid; label text; species text; bonus int:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; if p_game not in('snack_hunt','lucky_paw') then raise exception 'Unbekanntes Minigame.'; end if;
  select p.species into species from public.club_pets p where p.user_id=auth.uid(); if species is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':game:'||p_game,0)); if exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key=p_game and activity_date=today) then raise exception 'Dieses Minigame kannst du heute nicht noch einmal spielen.'; end if;
  if p_game='snack_hunt' then reward:=case when roll<.08 then 5 when roll<.35 then 3 else 1 end; coins:=case when roll<.12 then 15 else 5 end; if species in('bunny','hamster') then reward:=reward+1; end if; key:='snack'; label:=format('+%s Snacks · +%s AC Coins',reward,coins);
  else reward:=case when roll<.06 then 3 when roll<.30 then 2 else 1 end; coins:=case when roll<.10 then 50 else 12 end; if species='owl' and roll<.40 then reward:=reward+1; end if; if species='fox' then coins:=round(coins*1.25); end if; key:='snack'; label:=format('+%s Snacks · +%s AC Coins',reward,coins); end if;
  if species='fox' and p_game='snack_hunt' then coins:=round(coins*1.25); label:=format('+%s Snacks · +%s AC Coins',reward,coins); end if;
  insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),p_game,today,jsonb_build_object('roll',roll,'species',species)); select id into iid from public.club_pet_items where item_key=key;
  insert into public.club_pet_inventory(user_id,item_id,quantity) values(auth.uid(),iid,reward) on conflict(user_id,item_id) do update set quantity=club_pet_inventory.quantity+excluded.quantity,updated_at=now(); update public.profiles set ac_coins=coalesce(ac_coins,0)+coins,updated_at=now() where id=auth.uid(); return jsonb_build_object('ok',true,'reward_label',label,'hub',public.get_pet_life_hub());
end $$;

-- 11) Mystery Box: unicorns have a better rare-roll chance.
create or replace function public.open_pet_mystery_box() returns jsonb language plpgsql security definer set search_path=public as $$
declare bid uuid; invqty int; roll numeric:=random(); rewardkey text; qty int; coins int:=0; iid uuid; label text; species text; rare_cut numeric:=.93;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; select species into species from public.club_pets where user_id=auth.uid(); select id into bid from public.club_pet_items where item_key='mystery_box'; select quantity into invqty from public.club_pet_inventory where user_id=auth.uid() and item_id=bid for update; if coalesce(invqty,0)<1 then raise exception 'Du hast keine Mystery Box.'; end if;
  if species='unicorn' then rare_cut:=.88; end if; update public.club_pet_inventory set quantity=quantity-1,updated_at=now() where user_id=auth.uid() and item_id=bid;
  if roll<.55 then rewardkey:='snack';qty:=3;label:='+3 Snacks'; elsif roll<.78 then rewardkey:='treat';qty:=2;label:='+2 Leckerlis'; elsif roll<rare_cut then rewardkey:='premium_food';qty:=1;label:='+1 Premium-Futter'; else coins:=100;label:='+100 AC Coins'; end if;
  if rewardkey is not null then select id into iid from public.club_pet_items where item_key=rewardkey; insert into public.club_pet_inventory(user_id,item_id,quantity) values(auth.uid(),iid,qty) on conflict(user_id,item_id) do update set quantity=club_pet_inventory.quantity+excluded.quantity,updated_at=now(); end if; if coins>0 then update public.profiles set ac_coins=coalesce(ac_coins,0)+coins,updated_at=now() where id=auth.uid(); end if;
  return jsonb_build_object('ok',true,'reward_label',label,'hub',public.get_pet_life_hub());
end $$;

-- 12) Wheel now feeds the Pet ecosystem too. Existing XP/extra-spin rewards stay intact.
create or replace function public.spin_club_wheel() returns jsonb language plpgsql security definer set search_path=public as $$
declare last_spin timestamptz; roll numeric; reward_key text; reward_label text; item_name text; item_icon text; reward_value int:=0; new_xp int; reward_class text; available_tokens int:=0; consumed_token boolean:=false; v_reset timestamptz; pet_species text; iid uuid; qty int:=0; pet_item_key text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select coalesce(wheel_spin_tokens,0),wheel_reset_at into available_tokens,v_reset from public.profiles where id=auth.uid();
  if v_reset is not null then select max(created_at) into last_spin from public.club_wheel_spins where user_id=auth.uid() and created_at>v_reset; else select max(created_at) into last_spin from public.club_wheel_spins where user_id=auth.uid(); end if;
  if last_spin is not null and last_spin>now()-interval '24 hours' then if available_tokens>0 then update public.profiles set wheel_spin_tokens=wheel_spin_tokens-1,updated_at=now() where id=auth.uid() and wheel_spin_tokens>0; consumed_token:=found; if not consumed_token then raise exception 'Dein Extra-Dreh konnte nicht verwendet werden.'; end if; else return jsonb_build_object('ok',false,'cooldown',true,'next_free_at',last_spin+interval '24 hours','spin_tokens',available_tokens); end if; end if;
  select species into pet_species from public.club_pets where user_id=auth.uid(); roll:=random();
  if roll<.25 then reward_key:='xp_25'; reward_label:='+25 XP'; reward_value:=25; reward_class:='xp'; elsif roll<.43 then reward_key:='xp_50'; reward_label:='+50 XP'; reward_value:=50; reward_class:='xp'; elsif roll<.58 then reward_key:='xp_100'; reward_label:='+100 XP'; reward_value:=100; reward_class:='xp'; elsif roll<.68 then reward_key:='xp_250'; reward_label:='+250 XP'; reward_value:=250; reward_class:='xp'; elsif roll<.77 then reward_key:='pet_item'; reward_class:='pet_item'; if pet_species in('hamster','bunny') then pet_item_key:='snack';qty:=3; elsif pet_species='dragon' then pet_item_key:='favorite_food';qty:=1; elsif pet_species='unicorn' then pet_item_key:='mystery_box';qty:=1; else pet_item_key:=case when random()<.55 then 'snack' when random()<.80 then 'treat' else 'premium_food' end;qty:=1; end if; select name,icon into item_name,item_icon from public.club_pet_items where item_key=pet_item_key; reward_label:=coalesce(item_icon,'🎁')||' '||coalesce(item_name,'Pet-Item')||' ×'||qty; elsif roll<.86 then reward_key:='pet_care'; reward_label:='🐾 Pet-Bonus'; reward_class:='pet'; elsif roll<.94 then reward_key:='extra_spin'; reward_label:='🎡 Extra Dreh'; reward_value:=1; reward_class:='spin'; else reward_key:='twitch_reward'; reward_label:='💜 Twitch-Reward'; reward_class:='twitch'; end if;
  if reward_class='xp' then update public.profiles set xp=greatest(0,coalesce(xp,0)+reward_value),updated_at=now() where id=auth.uid() returning xp into new_xp; elsif reward_class='spin' then update public.profiles set wheel_spin_tokens=coalesce(wheel_spin_tokens,0)+1,updated_at=now() where id=auth.uid(); elsif reward_class='pet_item' and pet_item_key is not null then select id into iid from public.club_pet_items where item_key=pet_item_key; insert into public.club_pet_inventory(user_id,item_id,quantity) values(auth.uid(),iid,qty) on conflict(user_id,item_id) do update set quantity=club_pet_inventory.quantity+excluded.quantity,updated_at=now(); elsif reward_class='pet' then update public.club_pets set happiness=least(100,coalesce(happiness,0)+10),energy=least(100,coalesce(energy,0)+10),updated_at=now() where user_id=auth.uid(); end if;
  insert into public.club_wheel_spins(user_id,reward_key,reward_label,reward_value) values(auth.uid(),reward_key,reward_label,reward_value);
  select coalesce(wheel_spin_tokens,0) into available_tokens from public.profiles where id=auth.uid();
  return jsonb_build_object('ok',true,'reward_key',reward_key,'reward_label',reward_label,'reward_value',reward_value,'reward_class',reward_class,'total_xp',new_xp,'spin_tokens',available_tokens,'consumed_token',consumed_token,'next_free_at',now()+interval '24 hours');
end $$;

revoke all on function public.get_pet_species_profile(text) from public; grant execute on function public.get_pet_species_profile(text) to authenticated;
revoke all on function public.archive_club_pet() from public; grant execute on function public.archive_club_pet() to authenticated;
revoke all on function public.switch_to_archived_club_pet(uuid) from public; grant execute on function public.switch_to_archived_club_pet(uuid) to authenticated;
