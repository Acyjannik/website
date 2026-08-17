-- ACYJANNIK V17.7 — Pet Perks + Expanded Shop
-- Run once AFTER V17.6.
-- Perks are server-side, charge based and can be won from the wheel / mystery boxes.

create table if not exists public.club_pet_perk_catalog (
  perk_key text primary key,
  name text not null,
  icon text not null default '✨',
  detail text not null default '',
  effect_key text not null,
  max_charges integer not null default 3,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.club_pet_user_perks (
  user_id uuid not null references auth.users(id) on delete cascade,
  perk_key text not null references public.club_pet_perk_catalog(perk_key) on delete cascade,
  charges integer not null default 0 check(charges >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id, perk_key)
);

alter table public.club_pet_perk_catalog enable row level security;
alter table public.club_pet_user_perks enable row level security;
drop policy if exists "pet perk catalog read" on public.club_pet_perk_catalog;
create policy "pet perk catalog read" on public.club_pet_perk_catalog for select to authenticated using(enabled=true);
drop policy if exists "own pet perks read" on public.club_pet_user_perks;
create policy "own pet perks read" on public.club_pet_user_perks for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.club_pet_user_perks from authenticated;

insert into public.club_pet_perk_catalog(perk_key,name,icon,detail,effect_key,max_charges,sort_order) values
('cuddle_charm','Kuschel-Charm','💜','Streicheln gibt +5 zusätzliche Laune.','cuddle',5,10),
('energy_saver','Energie-Sparer','⚡','Spielen kostet 5 Energie weniger.','energy',4,20),
('xp_charm','XP-Charm','✨','Pflegeaktionen geben +3 zusätzliche Pflege-XP.','xp',5,30),
('snack_magnet','Snack-Magnet','🍪','Snack Hunt bringt mindestens 1 Snack zusätzlich.','snacks',3,40),
('coin_magnet','Coin-Magnet','🪙','Minigames bringen +10 AC Coins.','coins',3,50),
('wheel_luck','Lucky Charm','🍀','Dein nächster Dreh hat bessere Chancen auf einen Pet-Reward oder Perk.','wheel',2,60),
('hunger_guard','Futter-Boost','🍖','Deine nächste Fütterung gibt +10 zusätzlichen Hunger.','food',3,70)
on conflict(perk_key) do update set name=excluded.name,icon=excluded.icon,detail=excluded.detail,effect_key=excluded.effect_key,max_charges=excluded.max_charges,enabled=true,sort_order=excluded.sort_order;

-- More compact, meaningful shop inventory. Existing items remain untouched.
insert into public.club_pet_items(item_key,name,icon,item_type,detail,cost,hunger,happiness,energy,xp,sort_order) values
('super_snack','Super-Snack','🍪','food','Mehr Hunger als der normale Snack, ohne Luxuspreis.',18,25,2,0,0,15),
('mood_cookie','Mood-Cookie','🍰','food','Kleiner Energieschub für die Laune.',28,10,25,5,1,25),
('energy_orb','Energy-Orb','🔋','boost','Starker Energieschub für müde Begleiter.',45,0,0,40,1,55),
('laser_toy','Laser-Spielzeug','🔴','toy','Bringt richtig Bewegung in die Bude.',50,0,30,-2,3,75),
('rainbow_food','Rainbow-Futter','🌈','food','Seltene Mischung mit Hunger, Laune und Energie.',65,40,20,10,5,85),
('pet_biscuit','ACY Keks','🍪','food','Kleiner Allrounder für zwischendurch.',22,20,10,0,0,90),
('comfort_blanket','Kuscheldecke','🧸','toy','Ein besonders gemütliches Spielzeug.',55,0,35,10,4,95)
on conflict(item_key) do update set name=excluded.name,icon=excluded.icon,detail=excluded.detail,cost=excluded.cost,hunger=excluded.hunger,happiness=excluded.happiness,energy=excluded.energy,xp=excluded.xp,enabled=true,sort_order=excluded.sort_order;

create or replace function public.grant_pet_perk(p_user uuid, p_perk_key text, p_charges integer default 1)
returns void language plpgsql security definer set search_path=public as $$
declare cap integer;
begin
  select max_charges into cap from public.club_pet_perk_catalog where perk_key=p_perk_key and enabled;
  if cap is null then raise exception 'Unbekannter Pet-Perk.'; end if;
  insert into public.club_pet_user_perks(user_id,perk_key,charges,updated_at)
  values(p_user,p_perk_key,least(cap,greatest(1,p_charges)),now())
  on conflict(user_id,perk_key) do update set charges=least(cap,club_pet_user_perks.charges+greatest(1,p_charges)),updated_at=now();
end $$;

create or replace function public.consume_pet_perk(p_perk_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare ok boolean:=false;
begin
  if auth.uid() is null then return false; end if;
  update public.club_pet_user_perks
     set charges=charges-1,updated_at=now()
   where user_id=auth.uid() and perk_key=p_perk_key and charges>0;
  ok:=found;
  return ok;
end $$;

create or replace function public.get_pet_life_hub() returns jsonb
language plpgsql security definer set search_path=public as $$
declare p jsonb; coins int; today date; items jsonb; shop jsonb; archives jsonb; perks jsonb; feed_count int; play_count int; pet_count int; groom_count int; sleep_count int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  p:=public.get_club_pet();
  select coalesce(ac_coins,0) into coins from public.profiles where id=auth.uid();
  today:=(now() at time zone 'Europe/Berlin')::date;
  select coalesce(jsonb_agg(jsonb_build_object('key',i.item_key,'name',i.name,'icon',i.icon,'detail',i.detail,'quantity',inv.quantity,'item_type',i.item_type,'hunger',i.hunger,'happiness',i.happiness,'energy',i.energy,'xp',i.xp) order by i.sort_order),'[]'::jsonb)
    into items from public.club_pet_inventory inv join public.club_pet_items i on i.id=inv.item_id where inv.user_id=auth.uid() and inv.quantity>0 and i.enabled;
  select coalesce(jsonb_agg(jsonb_build_object('key',item_key,'name',name,'icon',icon,'detail',detail,'cost',cost,'hunger',hunger,'happiness',happiness,'energy',energy,'xp',xp,'item_type',item_type) order by sort_order),'[]'::jsonb)
    into shop from public.club_pet_items where enabled and cost>0;
  select coalesce(jsonb_agg(jsonb_build_object('key',c.perk_key,'name',c.name,'icon',c.icon,'detail',c.detail,'charges',u.charges,'max_charges',c.max_charges,'effect_key',c.effect_key) order by c.sort_order),'[]'::jsonb)
    into perks from public.club_pet_user_perks u join public.club_pet_perk_catalog c on c.perk_key=u.perk_key where u.user_id=auth.uid() and u.charges>0 and c.enabled;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'species',a.species,'species_label',case a.species when 'cat' then 'Katze' when 'dog' then 'Hund' when 'fox' then 'Fuchs' when 'axolotl' then 'Axolotl' when 'dragon' then 'Drache' when 'unicorn' then 'Einhorn' when 'penguin' then 'Pinguin' when 'panda' then 'Panda' when 'bunny' then 'Hase' when 'koala' then 'Koala' when 'hamster' then 'Hamster' when 'turtle' then 'Schildkröte' when 'owl' then 'Eule' when 'frog' then 'Frosch' when 'bee' then 'Biene' else 'Begleiter' end,'name',a.name,'pet_xp',a.pet_xp,'level',case when a.pet_xp>=10000 then 10 when a.pet_xp>=6500 then 9 when a.pet_xp>=4250 then 8 when a.pet_xp>=2750 then 7 when a.pet_xp>=1750 then 6 when a.pet_xp>=1000 then 5 when a.pet_xp>=500 then 4 when a.pet_xp>=250 then 3 when a.pet_xp>=100 then 2 else 1 end,'archived_at',a.archived_at) order by a.archived_at desc),'[]'::jsonb)
    into archives from public.club_pet_archive a where a.user_id=auth.uid();
  select count(*) filter(where activity_key='feed'),count(*) filter(where activity_key='play'),count(*) filter(where activity_key='pet'),count(*) filter(where activity_key='groom'),count(*) filter(where activity_key='sleep')
    into feed_count,play_count,pet_count,groom_count,sleep_count from public.club_pet_activity_log where user_id=auth.uid() and activity_date=today;
  return jsonb_build_object(
    'pet',p,'ac_coins',coins,'inventory',items,'shop',shop,'perks',perks,'archives',archives,
    'daily_supply_claimed',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='daily_supply' and activity_date=today),
    'limits',jsonb_build_object('feed',jsonb_build_object('remaining',greatest(0,3-feed_count)),'play',jsonb_build_object('remaining',greatest(0,2-play_count)),'pet',jsonb_build_object('remaining',greatest(0,3-pet_count)),'groom',jsonb_build_object('remaining',greatest(0,1-groom_count)),'sleep',jsonb_build_object('remaining',greatest(0,1-sleep_count))),
    'games',jsonb_build_object('snack_hunt',jsonb_build_object('used',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='snack_hunt' and activity_date=today)),'lucky_paw',jsonb_build_object('used',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='lucky_paw' and activity_date=today)))
  );
end $$;

-- Species-aware care + perk effects.
create or replace function public.club_pet_action(p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.club_pets%rowtype; elapsed numeric; h int;ha int;e int; xp_gain int:=5; lim int; today date:=(now() at time zone 'Europe/Berlin')::date; result jsonb; max_daily int; play_happy int:=25; play_cost int:=15; pet_happy int:=10; sleep_energy int:=30; perk_used boolean:=false;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_action not in('feed','play','pet','groom','sleep') then raise exception 'Ungültige Pet-Aktion.'; end if;
  select * into p from public.club_pets where user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':pet:'||p_action,0));
  elapsed:=greatest(0,extract(epoch from(now()-p.last_interaction_at))/3600.0);
  h:=greatest(0,p.hunger-floor(elapsed*(case when p.species in('axolotl','turtle') then .7 else 1 end))::int);
  ha:=greatest(0,p.happiness-floor(elapsed*(case when p.species in('axolotl','turtle') then .35 else .5 end))::int);
  e:=greatest(0,p.energy-floor(elapsed*(case when p.species='penguin' then .22 when p.species in('axolotl','turtle') then .35 else .5 end))::int);
  max_daily:=case p_action when 'feed' then 3 when 'play' then 2 when 'pet' then 3 when 'groom' then 1 when 'sleep' then 1 end;
  select count(*) into lim from public.club_pet_activity_log where user_id=auth.uid() and activity_key=p_action and activity_date=today;
  if lim>=max_daily then raise exception 'Für heute ist dieses Pflege-Limit erreicht.'; end if;
  if p.species='dog' and p_action='play' then play_happy:=35; play_cost:=13; end if;
  if p.species='cat' and p_action='pet' then pet_happy:=15; elsif p.species='frog' and p_action='pet' then pet_happy:=15; end if;
  if p.species='koala' and p_action='sleep' then sleep_energy:=45; end if;
  if p.species='bee' then xp_gain:=6; end if;
  if p.species='frog' and p_action='pet' then xp_gain:=xp_gain+1; end if;
  if p_action='feed' then raise exception 'Füttern erfolgt über die Futterauswahl.'; end if;
  if p_action='play' then
    if consume_pet_perk('energy_saver') then play_cost:=greatest(5,play_cost-5); perk_used:=true; end if;
    if e<play_cost then raise exception 'Dein Tier ist zu müde zum Spielen.'; end if;
    ha:=least(100,ha+play_happy); e:=greatest(0,e-play_cost); h:=greatest(0,h-8);
  elsif p_action='pet' then
    if consume_pet_perk('cuddle_charm') then pet_happy:=pet_happy+5; perk_used:=true; end if;
    ha:=least(100,ha+pet_happy);
  elsif p_action='groom' then ha:=least(100,ha+15); e:=least(100,e+10);
  elsif p_action='sleep' then e:=least(100,e+sleep_energy); h:=greatest(0,h-3); end if;
  if consume_pet_perk('xp_charm') then xp_gain:=xp_gain+3; perk_used:=true; end if;
  insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),p_action,today,jsonb_build_object('xp',xp_gain,'species',p.species,'perk_used',perk_used));
  update public.club_pets set hunger=h,happiness=ha,energy=e,pet_xp=pet_xp+xp_gain,updated_at=now(),last_interaction_at=now() where user_id=auth.uid();
  perform public.award_club_xp(auth.uid(),'pet_care_'||current_date::text,5);
  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'last_interaction_at',last_interaction_at,'species_trait',public.get_pet_species_profile(species)) into result from public.club_pets where user_id=auth.uid();
  return result;
end $$;

-- Species-aware food use + food perk.
create or replace function public.use_pet_item(p_item_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.club_pets%rowtype; item public.club_pet_items%rowtype; inv public.club_pet_inventory%rowtype; result jsonb; today date:=(now() at time zone 'Europe/Berlin')::date; feed_count int; elapsed numeric; h int; ha int; e int; xp_gain int:=0; msg text; hunger_bonus numeric:=1; food_bonus int:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':item:'||p_item_key,0));
  select * into p from public.club_pets where user_id=auth.uid() for update; if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  select * into item from public.club_pet_items where item_key=p_item_key and enabled; if item.id is null then raise exception 'Dieses Pet-Item gibt es nicht.'; end if;
  select * into inv from public.club_pet_inventory where user_id=auth.uid() and item_id=item.id for update; if coalesce(inv.quantity,0)<1 then raise exception 'Du hast dieses Item nicht auf Vorrat.'; end if;
  elapsed:=greatest(0,extract(epoch from(now()-p.last_interaction_at))/3600.0); h:=greatest(0,p.hunger-floor(elapsed*1)::int); ha:=greatest(0,p.happiness-floor(elapsed*.5)::int); e:=greatest(0,p.energy-floor(elapsed*.5)::int);
  if item.item_type='food' then
    select count(*) into feed_count from public.club_pet_activity_log where user_id=auth.uid() and activity_key='feed' and activity_date=today; if feed_count>=3 then raise exception 'Für heute sind alle 3 Fütterungen aufgebraucht.'; end if;
    if p.species='dragon' then hunger_bonus:=1.15; end if;
    if consume_pet_perk('hunger_guard') then food_bonus:=10; end if;
    h:=least(100,h+round(item.hunger*hunger_bonus)+food_bonus); ha:=least(100,ha+item.happiness+case when p.species='panda' then 5 else 0 end); e:=least(100,e+item.energy); xp_gain:=greatest(1,item.xp);
    insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),'feed',today,jsonb_build_object('item_key',item.item_key,'species',p.species,'perk_used',food_bonus>0));
    msg:=format('%s %s verwendet. +%s Hunger.',item.icon,item.name,round(item.hunger*hunger_bonus)+food_bonus);
  elsif item.item_type='boost' then e:=least(100,e+item.energy); xp_gain:=greatest(1,item.xp); insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),'item_use',today,jsonb_build_object('item_key',item.item_key)); msg:=format('%s %s verwendet. +%s Energie.',item.icon,item.name,item.energy);
  else ha:=least(100,ha+item.happiness); e:=greatest(0,e+item.energy); xp_gain:=greatest(1,item.xp); insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),'item_use',today,jsonb_build_object('item_key',item.item_key)); msg:=format('%s %s benutzt. +%s Laune.',item.icon,item.name,item.happiness); end if;
  update public.club_pet_inventory set quantity=quantity-1,updated_at=now() where user_id=auth.uid() and item_id=item.id;
  update public.club_pets set hunger=h,happiness=ha,energy=e,pet_xp=pet_xp+xp_gain,updated_at=now(),last_interaction_at=now() where user_id=auth.uid();
  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'last_interaction_at',last_interaction_at,'species_trait',public.get_pet_species_profile(species)) into p from public.club_pets where user_id=auth.uid();
  return jsonb_build_object('ok',true,'message',msg,'pet',p,'hub',public.get_pet_life_hub());
end $$;

-- Minigames now also consume their relevant perk charges.
create or replace function public.play_pet_minigame(p_game text) returns jsonb language plpgsql security definer set search_path=public as $$
declare today date:=(now() at time zone 'Europe/Berlin')::date; key text; roll numeric:=random(); reward int:=0; coins int:=0; iid uuid; label text; species text; perk_bonus int:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; if p_game not in('snack_hunt','lucky_paw') then raise exception 'Unbekanntes Minigame.'; end if;
  select p.species into species from public.club_pets p where p.user_id=auth.uid(); if species is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':game:'||p_game,0));
  if exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key=p_game and activity_date=today) then raise exception 'Dieses Minigame kannst du heute nicht noch einmal spielen.'; end if;
  if p_game='snack_hunt' then reward:=case when roll<.08 then 5 when roll<.35 then 3 else 1 end; coins:=case when roll<.12 then 15 else 5 end; if species in('bunny','hamster') then reward:=reward+1; end if; if consume_pet_perk('snack_magnet') then perk_bonus:=1; reward:=reward+perk_bonus; end if; key:='snack'; label:=format('+%s Snacks · +%s AC Coins',reward,coins);
  else reward:=case when roll<.06 then 3 when roll<.30 then 2 else 1 end; coins:=case when roll<.10 then 50 else 12 end; if species='owl' and roll<.40 then reward:=reward+1; end if; key:='snack'; label:=format('+%s Snacks · +%s AC Coins',reward,coins); end if;
  if species='fox' and p_game='snack_hunt' then coins:=round(coins*1.25); end if;
  if consume_pet_perk('coin_magnet') then coins:=coins+10; end if;
  insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata) values(auth.uid(),p_game,today,jsonb_build_object('roll',roll,'species',species));
  select id into iid from public.club_pet_items where item_key=key;
  insert into public.club_pet_inventory(user_id,item_id,quantity) values(auth.uid(),iid,reward) on conflict(user_id,item_id) do update set quantity=club_pet_inventory.quantity+excluded.quantity,updated_at=now();
  update public.profiles set ac_coins=coalesce(ac_coins,0)+coins,updated_at=now() where id=auth.uid();
  return jsonb_build_object('ok',true,'reward_label',label,'hub',public.get_pet_life_hub());
end $$;

-- Mystery boxes can now occasionally contain a perk.
create or replace function public.open_pet_mystery_box() returns jsonb language plpgsql security definer set search_path=public as $$
declare bid uuid; invqty int; roll numeric:=random(); rewardkey text; qty int; coins int:=0; iid uuid; label text; species text; rare_cut numeric:=.93; perkkey text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if; select species into species from public.club_pets where user_id=auth.uid(); select id into bid from public.club_pet_items where item_key='mystery_box'; select quantity into invqty from public.club_pet_inventory where user_id=auth.uid() and item_id=bid for update; if coalesce(invqty,0)<1 then raise exception 'Du hast keine Mystery Box.'; end if;
  if species='unicorn' then rare_cut:=.88; end if;
  update public.club_pet_inventory set quantity=quantity-1,updated_at=now() where user_id=auth.uid() and item_id=bid;
  if roll<.07 then perkkey:=case when random()<.35 then 'wheel_luck' when random()<.55 then 'cuddle_charm' when random()<.75 then 'coin_magnet' when random()<.90 then 'snack_magnet' else 'xp_charm' end; perform public.grant_pet_perk(auth.uid(),perkkey,1); select icon||' '||name into label from public.club_pet_perk_catalog where perk_key=perkkey;
  elsif roll<.55 then rewardkey:='snack';qty:=3;label:='+3 Snacks'; elsif roll<.78 then rewardkey:='treat';qty:=2;label:='+2 Leckerlis'; elsif roll<rare_cut then rewardkey:='premium_food';qty:=1;label:='+1 Premium-Futter'; else coins:=100;label:='+100 AC Coins'; end if;
  if rewardkey is not null then select id into iid from public.club_pet_items where item_key=rewardkey; insert into public.club_pet_inventory(user_id,item_id,quantity) values(auth.uid(),iid,qty) on conflict(user_id,item_id) do update set quantity=club_pet_inventory.quantity+excluded.quantity,updated_at=now(); end if;
  if coins>0 then update public.profiles set ac_coins=coalesce(ac_coins,0)+coins,updated_at=now(); end if;
  return jsonb_build_object('ok',true,'reward_label',coalesce(label,'Pet-Reward'),'hub',public.get_pet_life_hub());
end $$;

-- The wheel can now award a real Pet-Perk. Lucky Charm improves this branch.
create or replace function public.spin_club_wheel() returns jsonb language plpgsql security definer set search_path=public as $$
declare last_spin timestamptz; roll numeric; reward_key text; reward_label text; item_name text; item_icon text; reward_value int:=0; new_xp int; reward_class text; available_tokens int:=0; consumed_token boolean:=false; v_reset timestamptz; pet_species text; iid uuid; qty int:=0; pet_item_key text; perkkey text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select coalesce(wheel_spin_tokens,0),wheel_reset_at into available_tokens,v_reset from public.profiles where id=auth.uid();
  if v_reset is not null then select max(created_at) into last_spin from public.club_wheel_spins where user_id=auth.uid() and created_at>v_reset; else select max(created_at) into last_spin from public.club_wheel_spins where user_id=auth.uid(); end if;
  if last_spin is not null and last_spin>now()-interval '24 hours' then if available_tokens>0 then update public.profiles set wheel_spin_tokens=wheel_spin_tokens-1,updated_at=now() where id=auth.uid() and wheel_spin_tokens>0; consumed_token:=found; if not consumed_token then raise exception 'Dein Extra-Dreh konnte nicht verwendet werden.'; end if; else return jsonb_build_object('ok',false,'cooldown',true,'next_free_at',last_spin+interval '24 hours','spin_tokens',available_tokens); end if; end if;
  select species into pet_species from public.club_pets where user_id=auth.uid();
  roll:=random();
  if consume_pet_perk('wheel_luck') then roll:=greatest(0,roll-.08); end if;
  if roll<.24 then reward_key:='xp_25'; reward_label:='+25 XP'; reward_value:=25; reward_class:='xp';
  elsif roll<.42 then reward_key:='xp_50'; reward_label:='+50 XP'; reward_value:=50; reward_class:='xp';
  elsif roll<.57 then reward_key:='xp_100'; reward_label:='+100 XP'; reward_value:=100; reward_class:='xp';
  elsif roll<.66 then reward_key:='xp_250'; reward_label:='+250 XP'; reward_value:=250; reward_class:='xp';
  elsif roll<.75 then reward_key:='pet_item'; reward_class:='pet_item'; if pet_species in('hamster','bunny') then pet_item_key:='snack';qty:=3; elsif pet_species='dragon' then pet_item_key:='favorite_food';qty:=1; elsif pet_species='unicorn' then pet_item_key:='mystery_box';qty:=1; else pet_item_key:=case when random()<.55 then 'snack' when random()<.80 then 'treat' else 'premium_food' end;qty:=1; end if; select name,icon into item_name,item_icon from public.club_pet_items where item_key=pet_item_key; reward_label:=coalesce(item_icon,'🎁')||' '||coalesce(item_name,'Pet-Item')||' ×'||qty;
  elsif roll<.82 then reward_key:='pet_perk'; reward_class:='perk'; perkkey:=case when random()<.25 then 'cuddle_charm' when random()<.45 then 'xp_charm' when random()<.65 then 'snack_magnet' when random()<.82 then 'coin_magnet' when random()<.94 then 'energy_saver' else 'wheel_luck' end; select icon||' '||name into reward_label from public.club_pet_perk_catalog where perk_key=perkkey;
  elsif roll<.88 then reward_key:='pet_care'; reward_label:='🐾 Pet-Bonus'; reward_class:='pet';
  elsif roll<.95 then reward_key:='extra_spin'; reward_label:='🎡 Extra Dreh'; reward_value:=1; reward_class:='spin';
  else reward_key:='twitch_reward'; reward_label:='💜 Twitch-Reward'; reward_class:='twitch'; end if;
  if reward_class='xp' then update public.profiles set xp=greatest(0,coalesce(xp,0)+reward_value),updated_at=now() where id=auth.uid() returning xp into new_xp;
  elsif reward_class='spin' then update public.profiles set wheel_spin_tokens=coalesce(wheel_spin_tokens,0)+1,updated_at=now() where id=auth.uid();
  elsif reward_class='pet_item' and pet_item_key is not null then select id into iid from public.club_pet_items where item_key=pet_item_key; insert into public.club_pet_inventory(user_id,item_id,quantity) values(auth.uid(),iid,qty) on conflict(user_id,item_id) do update set quantity=club_pet_inventory.quantity+excluded.quantity,updated_at=now();
  elsif reward_class='perk' and perkkey is not null then perform public.grant_pet_perk(auth.uid(),perkkey,1);
  elsif reward_class='pet' then update public.club_pets set happiness=least(100,coalesce(happiness,0)+10),energy=least(100,coalesce(energy,0)+10),updated_at=now() where user_id=auth.uid(); end if;
  insert into public.club_wheel_spins(user_id,reward_key,reward_label,reward_value) values(auth.uid(),reward_key,reward_label,reward_value);
  select coalesce(wheel_spin_tokens,0) into available_tokens from public.profiles where id=auth.uid();
  return jsonb_build_object('ok',true,'reward_key',reward_key,'reward_label',reward_label,'reward_value',reward_value,'reward_class',reward_class,'total_xp',new_xp,'spin_tokens',available_tokens,'consumed_token',consumed_token,'next_free_at',now()+interval '24 hours');
end $$;

revoke all on function public.get_pet_life_hub() from public;
revoke all on function public.grant_pet_perk(uuid,text,integer) from public;
revoke all on function public.consume_pet_perk(text) from public;
revoke all on function public.club_pet_action(text) from public;
revoke all on function public.use_pet_item(text) from public;
revoke all on function public.play_pet_minigame(text) from public;
revoke all on function public.open_pet_mystery_box() from public;
revoke all on function public.spin_club_wheel() from public;
grant execute on function public.get_pet_life_hub() to authenticated;
grant execute on function public.club_pet_action(text) to authenticated;
grant execute on function public.use_pet_item(text) to authenticated;
grant execute on function public.play_pet_minigame(text) to authenticated;
grant execute on function public.open_pet_mystery_box() to authenticated;
grant execute on function public.spin_club_wheel() to authenticated;
