-- ACY CLUB V7.8 — Rewards System
create table if not exists public.club_rewards (
  id uuid primary key default gen_random_uuid(),
  reward_key text unique not null,
  name text not null,
  description text not null default '',
  icon text not null default '🎁',
  reward_type text not null default 'xp',
  reward_value integer not null default 0,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reward_type in ('xp','pet','wheel_spin','twitch','badge','custom'))
);

create table if not exists public.club_reward_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.club_rewards(id) on delete cascade,
  source text not null default 'system',
  source_ref text,
  status text not null default 'available',
  granted_at timestamptz not null default now(),
  used_at timestamptz,
  unique(user_id,reward_id,source,source_ref),
  check (status in ('available','used','expired'))
);

alter table public.club_rewards enable row level security;
alter table public.club_reward_inventory enable row level security;

drop policy if exists "members can read enabled rewards" on public.club_rewards;
create policy "members can read enabled rewards"
on public.club_rewards for select to authenticated
using (enabled = true);

drop policy if exists "members can read own reward inventory" on public.club_reward_inventory;
create policy "members can read own reward inventory"
on public.club_reward_inventory for select to authenticated
using (user_id = auth.uid());

create index if not exists idx_club_rewards_enabled_order
on public.club_rewards(enabled,sort_order);

create index if not exists idx_reward_inventory_user_status
on public.club_reward_inventory(user_id,status,granted_at desc);

insert into public.club_rewards
  (reward_key,name,description,icon,reward_type,reward_value,enabled,sort_order)
values
  ('xp_25','25 XP','25 zusätzliche Club-XP.','🟣','xp',25,true,10),
  ('xp_50','50 XP','50 zusätzliche Club-XP.','💜','xp',50,true,20),
  ('xp_100','100 XP','100 zusätzliche Club-XP.','✨','xp',100,true,30),
  ('xp_250','250 XP','250 zusätzliche Club-XP.','💎','xp',250,true,40),
  ('pet_boost','Pet-Bonus','Dein Pet bekommt einen kleinen Pflege-Boost.','🐾','pet',1,true,50),
  ('extra_spin','Extra-Dreh','Eine weitere Drehung am ACY Glücksrad.','🎡','wheel_spin',1,true,60),
  ('twitch_reward','Twitch-Reward','Ein Gewinn, der später mit Twitch verbunden wird.','💜','twitch',0,true,70)
on conflict (reward_key) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  reward_type=excluded.reward_type,
  reward_value=excluded.reward_value,
  updated_at=now();

create or replace function public.get_my_rewards()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'reward_key',r.reward_key,'name',r.name,
        'description',r.description,'icon',r.icon,'reward_type',r.reward_type,
        'reward_value',r.reward_value,'enabled',r.enabled,'sort_order',r.sort_order
      ) order by r.sort_order,r.name)
      from public.club_rewards r
      where r.enabled=true
    ),'[]'::jsonb),
    'inventory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'reward_id',i.reward_id,'reward_key',r.reward_key,
        'name',r.name,'description',r.description,'icon',r.icon,
        'reward_type',r.reward_type,'reward_value',r.reward_value,
        'source',i.source,'status',i.status,'granted_at',i.granted_at,'used_at',i.used_at
      ) order by i.granted_at desc)
      from public.club_reward_inventory i
      join public.club_rewards r on r.id=i.reward_id
      where i.user_id=auth.uid()
    ),'[]'::jsonb)
  );
$$;

create or replace function public.use_reward(p_inventory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item public.club_reward_inventory%rowtype;
  reward public.club_rewards%rowtype;
  new_xp integer;
  tokens integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  select * into item
  from public.club_reward_inventory
  where id=p_inventory_id and user_id=auth.uid() and status='available'
  for update;

  if item.id is null then raise exception 'Reward nicht verfügbar.'; end if;

  select * into reward from public.club_rewards where id=item.reward_id;
  if reward.id is null then raise exception 'Reward nicht gefunden.'; end if;

  if reward.reward_type='xp' then
    update public.profiles set xp=greatest(0,coalesce(xp,0)+reward.reward_value),updated_at=now()
    where id=auth.uid() returning xp into new_xp;
  elsif reward.reward_type='pet' then
    update public.club_pets
    set happiness=least(100,coalesce(happiness,0)+10),
        energy=least(100,coalesce(energy,0)+10),
        updated_at=now()
    where user_id=auth.uid();
  elsif reward.reward_type='wheel_spin' then
    update public.profiles
    set wheel_spin_tokens=coalesce(wheel_spin_tokens,0)+greatest(1,reward.reward_value),
        updated_at=now()
    where id=auth.uid()
    returning wheel_spin_tokens into tokens;
  elsif reward.reward_type='twitch' then
    -- Twitch connection is handled later through the Twitch integration.
    null;
  end if;

  update public.club_reward_inventory
  set status='used',used_at=now()
  where id=item.id;

  return jsonb_build_object(
    'ok',true,
    'reward_key',reward.reward_key,
    'name',reward.name,
    'icon',reward.icon,
    'reward_type',reward.reward_type,
    'total_xp',new_xp,
    'spin_tokens',tokens
  );
end;
$$;

create or replace function public.grant_reward_to_user(
  p_user_id uuid,
  p_reward_key text,
  p_source text default 'admin',
  p_source_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  reward public.club_rewards%rowtype;
  inv_id uuid;
begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid()) then
    raise exception 'Admin-Rechte erforderlich.';
  end if;

  select * into reward from public.club_rewards where reward_key=p_reward_key;
  if reward.id is null then raise exception 'Reward nicht gefunden.'; end if;

  insert into public.club_reward_inventory(user_id,reward_id,source,source_ref)
  values(p_user_id,reward.id,p_source,p_source_ref)
  on conflict(user_id,reward_id,source,source_ref) do nothing
  returning id into inv_id;

  return jsonb_build_object(
    'ok',true,'created',inv_id is not null,'inventory_id',inv_id,
    'reward_key',reward.reward_key,'name',reward.name
  );
end;
$$;

revoke all on function public.get_my_rewards() from public;
revoke all on function public.use_reward(uuid) from public;
revoke all on function public.grant_reward_to_user(uuid,text,text,text) from public;
grant execute on function public.get_my_rewards() to authenticated;
grant execute on function public.use_reward(uuid) to authenticated;
grant execute on function public.grant_reward_to_user(uuid,text,text,text) to authenticated;
