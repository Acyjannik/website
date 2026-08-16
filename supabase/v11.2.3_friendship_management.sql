-- ACY CLUB V11.2.3 — Friendship Management Repair
-- Run once in Supabase SQL Editor.

create or replace function public.send_friend_request(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  blocked boolean;
  existing_accepted boolean;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if p_target_user_id is null or p_target_user_id=auth.uid() then raise exception 'Ungültiger Kontakt.'; end if;

  select
    exists(select 1 from public.club_blocks where blocker_id=p_target_user_id and blocked_user_id=auth.uid())
    or exists(select 1 from public.club_blocks where blocker_id=auth.uid() and blocked_user_id=p_target_user_id)
    into blocked;

  if blocked then raise exception 'Dieser Kontakt kann nicht angefragt werden.'; end if;

  existing_accepted := exists(
    select 1
    from public.club_friend_requests
    where status='accepted'
      and (
        (requester_id=auth.uid() and addressee_id=p_target_user_id)
        or (requester_id=p_target_user_id and addressee_id=auth.uid())
      )
  );

  if existing_accepted then
    insert into public.club_friendships(user_id,friend_user_id)
    values(auth.uid(),p_target_user_id),(p_target_user_id,auth.uid())
    on conflict do nothing;
    return jsonb_build_object('status','accepted','restored',true);
  end if;

  if exists(
    select 1 from public.club_friendships
    where user_id=auth.uid() and friend_user_id=p_target_user_id
  ) then
    return jsonb_build_object('status','accepted','restored',false);
  end if;

  insert into public.club_friend_requests(requester_id,addressee_id,status)
  values(auth.uid(),p_target_user_id,'pending')
  on conflict(requester_id,addressee_id) do update
    set status='pending',responded_at=null,created_at=now();

  return jsonb_build_object('status','pending');
end;
$$;

revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;


create or replace function public.remove_friend(p_friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  delete from public.club_friendships
  where (user_id=auth.uid() and friend_user_id=p_friend_user_id)
     or (user_id=p_friend_user_id and friend_user_id=auth.uid());

  -- Also clear a stale accepted request, so a new request starts cleanly.
  update public.club_friend_requests
  set status='cancelled',responded_at=now()
  where (
    (requester_id=auth.uid() and addressee_id=p_friend_user_id)
    or (requester_id=p_friend_user_id and addressee_id=auth.uid())
  )
  and status in ('pending','accepted');
end;
$$;

revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;


create or replace function public.sync_my_friendships()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  pair record;
  inserted_total integer:=0;
  changed_rows integer:=0;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  for pair in
    select requester_id,addressee_id
    from public.club_friend_requests
    where status='accepted'
      and (requester_id=auth.uid() or addressee_id=auth.uid())
  loop
    insert into public.club_friendships(user_id,friend_user_id)
    values(pair.requester_id,pair.addressee_id)
    on conflict do nothing;
    get diagnostics changed_rows=row_count;
    inserted_total:=inserted_total+changed_rows;

    insert into public.club_friendships(user_id,friend_user_id)
    values(pair.addressee_id,pair.requester_id)
    on conflict do nothing;
    get diagnostics changed_rows=row_count;
    inserted_total:=inserted_total+changed_rows;
  end loop;

  return inserted_total;
end;
$$;

revoke all on function public.sync_my_friendships() from public;
grant execute on function public.sync_my_friendships() to authenticated;


create or replace function public.get_my_social_connections()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  perform public.sync_my_friendships();

  select jsonb_build_object(
    'friends',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',f.friend_user_id,
        'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),
        'online',coalesce(op.updated_at > now()-interval '5 minutes',false),
        'game_id',gp.game_id,
        'game_name',g.name,
        'last_seen',gp.updated_at
      ) order by p.display_name nulls last,p.username)
      from (
        select user_id,friend_user_id
        from public.club_friendships
        where user_id=auth.uid()
        union
        select requester_id,addressee_id
        from public.club_friend_requests
        where status='accepted' and requester_id=auth.uid()
        union
        select addressee_id,requester_id
        from public.club_friend_requests
        where status='accepted' and addressee_id=auth.uid()
      ) f
      join public.profiles p on p.id=f.friend_user_id
      left join public.club_game_presence gp on gp.user_id=f.friend_user_id
      left join public.club_online_presence op on op.user_id=f.friend_user_id
      left join public.games g on g.id=gp.game_id
      where not exists(
        select 1
        from public.club_blocks b
        where (b.blocker_id=auth.uid() and b.blocked_user_id=f.friend_user_id)
           or (b.blocker_id=f.friend_user_id and b.blocked_user_id=auth.uid())
      )
    ),'[]'::jsonb),
    'incoming',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.requester_id,'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),'created_at',r.created_at
      ) order by r.created_at desc)
      from public.club_friend_requests r
      join public.profiles p on p.id=r.requester_id
      where r.addressee_id=auth.uid() and r.status='pending'
    ),'[]'::jsonb),
    'outgoing',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.addressee_id,'username',p.username,
        'display_name',coalesce(p.display_name,p.username),
        'avatar_url',coalesce(p.avatar_url,''),'created_at',r.created_at
      ) order by r.created_at desc)
      from public.club_friend_requests r
      join public.profiles p on p.id=r.addressee_id
      where r.requester_id=auth.uid() and r.status='pending'
    ),'[]'::jsonb),
    'blocked',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',b.blocked_user_id,'username',p.username,
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

revoke all on function public.get_my_social_connections() from public;
grant execute on function public.get_my_social_connections() to authenticated;
