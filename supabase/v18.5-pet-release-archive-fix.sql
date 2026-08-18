-- ACYJANNIK V18.5 — Pet release archive + Mystery Box SQL fixes.

-- Abgeben = archivieren, nicht endgültig löschen.
create or replace function public.release_club_pet()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;
  perform public.archive_club_pet();
end;
$$;

revoke all on function public.release_club_pet() from public;
grant execute on function public.release_club_pet() to authenticated;

-- Mystery Box: qualify table columns so the PL/pgSQL variable `species`
-- cannot collide with club_pets.species.
create or replace function public.open_pet_mystery_box()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bid uuid;
  invqty int;
  roll numeric := random();
  rewardkey text;
  qty int;
  coins int := 0;
  iid uuid;
  label text;
  species text;
  rare_cut numeric := .93;
  perkkey text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select p.species into species from public.club_pets p where p.user_id = auth.uid();
  select i.id into bid from public.club_pet_items i where i.item_key = 'mystery_box';
  select inv.quantity into invqty from public.club_pet_inventory inv
    where inv.user_id = auth.uid() and inv.item_id = bid for update;
  if coalesce(invqty,0) < 1 then raise exception 'Du hast keine Mystery Box.'; end if;
  if species = 'unicorn' then rare_cut := .88; end if;

  update public.club_pet_inventory
    set quantity = quantity - 1, updated_at = now()
    where user_id = auth.uid() and item_id = bid;

  if roll < .07 then
    perkkey := case
      when random() < .35 then 'wheel_luck'
      when random() < .55 then 'cuddle_charm'
      when random() < .75 then 'coin_magnet'
      when random() < .90 then 'snack_magnet'
      else 'xp_charm'
    end;
    perform public.grant_pet_perk(auth.uid(), perkkey, 1);
    select c.icon || ' ' || c.name into label
      from public.club_pet_perk_catalog c where c.perk_key = perkkey;
  elsif roll < .55 then rewardkey := 'snack'; qty := 3; label := '+3 Snacks';
  elsif roll < .78 then rewardkey := 'treat'; qty := 2; label := '+2 Leckerlis';
  elsif roll < rare_cut then rewardkey := 'premium_food'; qty := 1; label := '+1 Premium-Futter';
  else coins := 100; label := '+100 AC Coins';
  end if;

  if rewardkey is not null then
    select i.id into iid from public.club_pet_items i where i.item_key = rewardkey;
    insert into public.club_pet_inventory(user_id,item_id,quantity)
      values(auth.uid(),iid,qty)
      on conflict(user_id,item_id)
      do update set quantity = club_pet_inventory.quantity + excluded.quantity, updated_at = now();
  end if;

  if coins > 0 then
    update public.profiles set ac_coins = coalesce(ac_coins,0) + coins, updated_at = now()
      where id = auth.uid();
  end if;

  return jsonb_build_object('ok',true,'reward_label',coalesce(label,'Pet-Reward'),'hub',public.get_pet_life_hub());
end;
$$;

revoke all on function public.open_pet_mystery_box() from public;
grant execute on function public.open_pet_mystery_box() to authenticated;
