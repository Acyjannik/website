-- ACY CLUB V10.3 — Block Enforcement
-- Goal: a block is a real privacy barrier, not just a UI state.

-- 1) Direct messages: blocked users cannot send or read messages across the block.
alter table public.club_direct_messages enable row level security;

drop policy if exists "members can read own direct messages" on public.club_direct_messages;
create policy "members can read own direct messages"
on public.club_direct_messages
for select to authenticated
using (
  (sender_id = auth.uid() or recipient_id = auth.uid())
  and not exists (
    select 1
    from public.club_blocks b
    where
      (b.blocker_id = auth.uid() and b.blocked_user_id = case when sender_id = auth.uid() then recipient_id else sender_id end)
      or
      (b.blocked_user_id = auth.uid() and b.blocker_id = case when sender_id = auth.uid() then recipient_id else sender_id end)
  )
);

drop policy if exists "members can send direct messages" on public.club_direct_messages;
create policy "members can send direct messages"
on public.club_direct_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and sender_id <> recipient_id
  and not exists (
    select 1 from public.club_blocks b
    where
      (b.blocker_id = auth.uid() and b.blocked_user_id = recipient_id)
      or
      (b.blocked_user_id = auth.uid() and b.blocker_id = recipient_id)
  )
);

-- 2) Profile visibility helper.
create or replace function public.is_member_blocked_for_view(
  p_viewer_id uuid,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.club_blocks b
    where
      (b.blocker_id = p_viewer_id and b.blocked_user_id = p_target_id)
      or
      (b.blocked_user_id = p_viewer_id and b.blocker_id = p_target_id)
  );
$$;

revoke all on function public.is_member_blocked_for_view(uuid,uuid) from public;
grant execute on function public.is_member_blocked_for_view(uuid,uuid) to authenticated;

-- 3) Pet-social interactions are blocked in both directions.
-- The function is replaced with the same behavior plus a hard privacy guard.
create or replace function public.interact_with_member_pet(
  p_target_user_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_pet public.club_pets%rowtype;
  target_pet public.club_pets%rowtype;
  gain integer;
  recent_count integer;
  action_label text;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'Nicht angemeldet.'; end if;
  if p_target_user_id is null or p_target_user_id = actor_id then
    raise exception 'Du kannst nicht mit deinem eigenen Pet interagieren.';
  end if;
  if p_action not in ('greet','play','pet') then
    raise exception 'Ungültige Pet-Aktion.';
  end if;

  if exists (
    select 1 from public.club_blocks b
    where
      (b.blocker_id = actor_id and b.blocked_user_id = p_target_user_id)
      or
      (b.blocker_id = p_target_user_id and b.blocked_user_id = actor_id)
  ) then
    raise exception 'Diese Pet-Interaktion ist für blockierte Kontakte nicht verfügbar.';
  end if;

  select * into actor_pet from public.club_pets where user_id = actor_id for update;
  if actor_pet.user_id is null then raise exception 'Du brauchst zuerst ein eigenes Tier.'; end if;

  select * into target_pet from public.club_pets where user_id = p_target_user_id for update;
  if target_pet.user_id is null then raise exception 'Dieses Mitglied hat aktuell kein Tier.'; end if;

  if exists (
    select 1 from public.club_pet_social_interactions
    where actor_user_id = actor_id
      and target_user_id = p_target_user_id
      and created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Die beiden Pets brauchen kurz eine Pause. Versuch es in ein paar Minuten erneut.';
  end if;

  select count(*) into recent_count
  from public.club_pet_social_interactions
  where actor_user_id = actor_id and created_at >= current_date;

  if recent_count >= 20 then
    raise exception 'Dein Pet hatte heute schon genug Social Time. Morgen geht es weiter.';
  end if;

  if p_action = 'greet' then gain := 1; action_label := 'begrüßt';
  elsif p_action = 'play' then gain := 3; action_label := 'spielt mit';
  else gain := 2; action_label := 'streichelt';
  end if;

  insert into public.club_pet_social_interactions(actor_user_id,target_user_id,action,xp_awarded)
  values(actor_id,p_target_user_id,p_action,gain);

  perform public.update_pet_friendship(actor_id, p_target_user_id, 1);

  insert into public.club_pet_friendships(
    user_id, friend_user_id, interaction_count, friendship_level, updated_at
  )
  values (p_target_user_id,actor_id,1,1,now())
  on conflict (user_id, friend_user_id)
  do update set
    interaction_count = public.club_pet_friendships.interaction_count + 1,
    friendship_level = case
      when public.club_pet_friendships.interaction_count + 1 >= 15 then 3
      when public.club_pet_friendships.interaction_count + 1 >= 5 then 2
      else 1
    end,
    updated_at = now();

  update public.club_pets
  set social_xp = coalesce(social_xp,0) + gain, updated_at = now()
  where user_id in (actor_id,p_target_user_id);

  select * into actor_pet from public.club_pets where user_id = actor_id;
  select * into target_pet from public.club_pets where user_id = p_target_user_id;

  return jsonb_build_object(
    'action',p_action,
    'action_label',action_label,
    'social_xp_awarded',gain,
    'actor_pet',jsonb_build_object('user_id',actor_pet.user_id,'species',actor_pet.species,'name',actor_pet.name,'pet_xp',actor_pet.pet_xp,'social_xp',actor_pet.social_xp),
    'target_pet',jsonb_build_object('user_id',target_pet.user_id,'species',target_pet.species,'name',target_pet.name,'pet_xp',target_pet.pet_xp,'social_xp',target_pet.social_xp)
  );
end;
$$;

-- 4) Preserve block lists for the blocker. Do not create a public policy
-- that exposes blocks to everyone.
