-- ACYJANNIK V17.4 — Pet Life expansion
-- Food selection, meaningful food effects, item use and pet info support.

-- Inventory payload now contains type/effects so the UI can explain/use items correctly.
create or replace function public.get_pet_life_hub() returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  p jsonb; coins int; today date; items jsonb; shop jsonb;
  feed_count int; play_count int; pet_count int; groom_count int; sleep_count int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  p:=public.get_club_pet();
  select coalesce(ac_coins,0) into coins from public.profiles where id=auth.uid();
  today:=(now() at time zone 'Europe/Berlin')::date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',i.item_key,'name',i.name,'icon',i.icon,'detail',i.detail,'quantity',inv.quantity,
    'item_type',i.item_type,'hunger',i.hunger,'happiness',i.happiness,'energy',i.energy,'xp',i.xp
  ) order by i.sort_order),'[]'::jsonb)
  into items
  from public.club_pet_inventory inv
  join public.club_pet_items i on i.id=inv.item_id
  where inv.user_id=auth.uid() and inv.quantity>0 and i.enabled;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',item_key,'name',name,'icon',icon,'detail',detail,'cost',cost,
    'hunger',hunger,'happiness',happiness,'energy',energy,'xp',xp,'item_type',item_type
  ) order by sort_order),'[]'::jsonb)
  into shop
  from public.club_pet_items where enabled and cost>0;

  select count(*) filter(where activity_key='feed'),count(*) filter(where activity_key='play'),
         count(*) filter(where activity_key='pet'),count(*) filter(where activity_key='groom'),
         count(*) filter(where activity_key='sleep')
  into feed_count,play_count,pet_count,groom_count,sleep_count
  from public.club_pet_activity_log where user_id=auth.uid() and activity_date=today;

  return jsonb_build_object(
    'pet',p,'ac_coins',coins,'inventory',items,'shop',shop,
    'daily_supply_claimed',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='daily_supply' and activity_date=today),
    'limits',jsonb_build_object(
      'feed',jsonb_build_object('remaining',greatest(0,3-feed_count)),
      'play',jsonb_build_object('remaining',greatest(0,2-play_count)),
      'pet',jsonb_build_object('remaining',greatest(0,3-pet_count)),
      'groom',jsonb_build_object('remaining',greatest(0,1-groom_count)),
      'sleep',jsonb_build_object('remaining',greatest(0,1-sleep_count))
    ),
    'games',jsonb_build_object(
      'snack_hunt',jsonb_build_object('used',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='snack_hunt' and activity_date=today)),
      'lucky_paw',jsonb_build_object('used',exists(select 1 from public.club_pet_activity_log where user_id=auth.uid() and activity_key='lucky_paw' and activity_date=today))
    )
  );
end $$;

-- Use a specific inventory item. Food shares the normal 3x/day feeding limit,
-- while boosts/toys are inventory-driven and therefore have no artificial one-click limit.
create or replace function public.use_pet_item(p_item_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  p public.club_pets%rowtype;
  item public.club_pet_items%rowtype;
  inv public.club_pet_inventory%rowtype;
  today date:=(now() at time zone 'Europe/Berlin')::date;
  feed_count int; elapsed numeric; h int; ha int; e int; xp_gain int:=0; msg text;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if nullif(trim(p_item_key),'') is null then raise exception 'Kein Item ausgewählt.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':item:'||p_item_key,0));
  select * into p from public.club_pets where user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'Bitte zuerst ein Tier adoptieren.'; end if;
  select * into item from public.club_pet_items where item_key=p_item_key and enabled;
  if item.id is null then raise exception 'Dieses Pet-Item gibt es nicht.'; end if;
  if item.item_type not in ('food','boost','toy') then raise exception 'Dieses Item kann gerade nicht verwendet werden.'; end if;

  select * into inv from public.club_pet_inventory where user_id=auth.uid() and item_id=item.id for update;
  if coalesce(inv.quantity,0)<1 then raise exception 'Du hast dieses Item nicht auf Vorrat.'; end if;

  elapsed:=greatest(0,extract(epoch from(now()-p.last_interaction_at))/3600.0);
  h:=greatest(0,p.hunger-floor(elapsed*1)::int);
  ha:=greatest(0,p.happiness-floor(elapsed*.5)::int);
  e:=greatest(0,p.energy-floor(elapsed*.5)::int);

  if item.item_type='food' then
    select count(*) into feed_count from public.club_pet_activity_log where user_id=auth.uid() and activity_key='feed' and activity_date=today;
    if feed_count>=3 then raise exception 'Für heute sind alle 3 Fütterungen aufgebraucht.'; end if;
    h:=least(100,h+item.hunger);
    ha:=least(100,ha+item.happiness);
    e:=least(100,e+item.energy);
    xp_gain:=greatest(1,item.xp);
    insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata)
      values(auth.uid(),'feed',today,jsonb_build_object('item_key',item.item_key,'item_name',item.name));
    msg:=format('%s %s verwendet. +%s Hunger%s.',item.icon,item.name,item.hunger,case when item.happiness>0 then format(' · +%s Laune',item.happiness) else '' end);
  elsif item.item_type='boost' then
    e:=least(100,e+item.energy);
    xp_gain:=greatest(1,item.xp);
    insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata)
      values(auth.uid(),'item_use',today,jsonb_build_object('item_key',item.item_key,'item_name',item.name));
    msg:=format('%s %s verwendet. +%s Energie.',item.icon,item.name,item.energy);
  else
    ha:=least(100,ha+item.happiness);
    e:=greatest(0,e+item.energy);
    xp_gain:=greatest(1,item.xp);
    insert into public.club_pet_activity_log(user_id,activity_key,activity_date,metadata)
      values(auth.uid(),'item_use',today,jsonb_build_object('item_key',item.item_key,'item_name',item.name));
    msg:=format('%s %s benutzt. +%s Laune.',item.icon,item.name,item.happiness);
  end if;

  update public.club_pet_inventory set quantity=quantity-1,updated_at=now() where user_id=auth.uid() and item_id=item.id;
  update public.club_pets set hunger=h,happiness=ha,energy=e,pet_xp=pet_xp+xp_gain,updated_at=now(),last_interaction_at=now() where user_id=auth.uid();
  if xp_gain>0 then perform public.award_club_xp(auth.uid(),'pet_item_'||item.item_key||'_'||current_date::text,1); end if;

  select jsonb_build_object('user_id',user_id,'species',species,'name',name,'hunger',hunger,'happiness',happiness,'energy',energy,'pet_xp',pet_xp,'last_interaction_at',last_interaction_at) into result from public.club_pets where user_id=auth.uid();
  return jsonb_build_object('ok',true,'message',msg,'pet',result,'hub',public.get_pet_life_hub());
end $$;

revoke all on function public.use_pet_item(text) from public;
grant execute on function public.use_pet_item(text) to authenticated;
