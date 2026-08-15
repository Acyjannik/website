-- ACY CLUB V7.4 — FRIENDS & BLOCKS

create table if not exists public.club_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id),
  check (status in ('pending','accepted','declined','cancelled'))
);

create table if not exists public.club_friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_user_id),
  check (user_id <> friend_user_id)
);

create table if not exists public.club_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

alter table public.club_friend_requests enable row level security;
alter table public.club_friendships enable row level security;
alter table public.club_blocks enable row level security;

drop policy if exists "members read own friend requests" on public.club_friend_requests;
create policy "members read own friend requests"
on public.club_friend_requests for select to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "members create friend requests" on public.club_friend_requests;
create policy "members create friend requests"
on public.club_friend_requests for insert to authenticated
with check (requester_id = auth.uid());

drop policy if exists "members update own incoming requests" on public.club_friend_requests;
create policy "members update own incoming requests"
on public.club_friend_requests for update to authenticated
using (addressee_id = auth.uid() or requester_id = auth.uid())
with check (addressee_id = auth.uid() or requester_id = auth.uid());

drop policy if exists "members read own friendships" on public.club_friendships;
create policy "members read own friendships"
on public.club_friendships for select to authenticated
using (user_id = auth.uid());

drop policy if exists "members read own blocks" on public.club_blocks;
create policy "members read own blocks"
on public.club_blocks for select to authenticated
using (blocker_id = auth.uid());

drop policy if exists "members manage own blocks" on public.club_blocks;
create policy "members manage own blocks"
on public.club_blocks for all to authenticated
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid());

create index if not exists idx_friend_requests_addressee_status
on public.club_friend_requests(addressee_id,status,created_at desc);

create index if not exists idx_friendships_user
on public.club_friendships(user_id,created_at desc);

create index if not exists idx_blocks_blocker
on public.club_blocks(blocker_id,created_at desc);

create or replace function public.send_friend_request(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  blocked boolean;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then raise exception 'Ungültiger Kontakt.'; end if;

  select exists(
    select 1 from public.club_blocks
    where blocker_id = p_target_user_id and blocked_user_id = auth.uid()
  ) or exists(
    select 1 from public.club_blocks
    where blocker_id = auth.uid() and blocked_user_id = p_target_user_id
  ) into blocked;

  if blocked then raise exception 'Dieser Kontakt kann nicht angefragt werden.'; end if;

  if exists(
    select 1 from public.club_friendships
    where user_id = auth.uid() and friend_user_id = p_target_user_id
  ) then
    return jsonb_build_object('status','accepted');
  end if;

  insert into public.club_friend_requests(requester_id,addressee_id,status)
  values(auth.uid(),p_target_user_id,'pending')
  on conflict(requester_id,addressee_id) do update
    set status='pending', responded_at=null, created_at=now();

  return jsonb_build_object('status','pending');
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid,p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.club_friend_requests%rowtype;
begin
  select * into r from public.club_friend_requests
  where id=p_request_id and addressee_id=auth.uid() and status='pending'
  for update;

  if r.id is null then raise exception 'Freundschaftsanfrage nicht gefunden.'; end if;

  if p_accept then
    update public.club_friend_requests
    set status='accepted',responded_at=now()
    where id=r.id;

    insert into public.club_friendships(user_id,friend_user_id)
    values(r.requester_id,r.addressee_id),(r.addressee_id,r.requester_id)
    on conflict do nothing;

    return jsonb_build_object('status','accepted');
  else
    update public.club_friend_requests
    set status='declined',responded_at=now()
    where id=r.id;
    return jsonb_build_object('status','declined');
  end if;
end;
$$;

create or replace function public.remove_friend(p_friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.club_friendships
  where (user_id=auth.uid() and friend_user_id=p_friend_user_id)
     or (user_id=p_friend_user_id and friend_user_id=auth.uid());

  update public.club_friend_requests
  set status='cancelled',responded_at=now()
  where ((requester_id=auth.uid() and addressee_id=p_friend_user_id)
      or (requester_id=p_friend_user_id and addressee_id=auth.uid()))
    and status='pending';
end;
$$;

create or replace function public.block_member(p_blocked_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_blocked_user_id=auth.uid() then raise exception 'Du kannst dich nicht selbst blockieren.'; end if;

  insert into public.club_blocks(blocker_id,blocked_user_id)
  values(auth.uid(),p_blocked_user_id)
  on conflict do nothing;

  delete from public.club_friendships
  where (user_id=auth.uid() and friend_user_id=p_blocked_user_id)
     or (user_id=p_blocked_user_id and friend_user_id=auth.uid());

  update public.club_friend_requests
  set status='cancelled',responded_at=now()
  where ((requester_id=auth.uid() and addressee_id=p_blocked_user_id)
      or (requester_id=p_blocked_user_id and addressee_id=auth.uid()))
    and status='pending';
end;
$$;

create or replace function public.unblock_member(p_blocked_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.club_blocks
  where blocker_id=auth.uid() and blocked_user_id=p_blocked_user_id;
end;
$$;

create or replace function public.get_my_social_connections()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'friends',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',f.friend_user_id,
        'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,'')
      ) order by p.display_name nulls last,p.username)
      from public.club_friendships f
      join public.profiles p on p.id=f.friend_user_id
      where f.user_id=auth.uid()
    ),'[]'::jsonb),
    'incoming',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.requester_id,'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),
        'created_at',r.created_at
      ) order by r.created_at desc)
      from public.club_friend_requests r
      join public.profiles p on p.id=r.requester_id
      where r.addressee_id=auth.uid() and r.status='pending'
    ),'[]'::jsonb),
    'outgoing',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.addressee_id,'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),
        'created_at',r.created_at
      ) order by r.created_at desc)
      from public.club_friend_requests r
      join public.profiles p on p.id=r.addressee_id
      where r.requester_id=auth.uid() and r.status='pending'
    ),'[]'::jsonb),
    'blocked',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',b.blocked_user_id,
        'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,'')
      ) order by p.display_name nulls last,p.username)
      from public.club_blocks b
      join public.profiles p on p.id=b.blocked_user_id
      where b.blocker_id=auth.uid()
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.block_member(uuid) from public;
revoke all on function public.unblock_member(uuid) from public;
revoke all on function public.get_my_social_connections() from public;

grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_member(uuid) to authenticated;
grant execute on function public.unblock_member(uuid) to authenticated;
grant execute on function public.get_my_social_connections() to authenticated;
