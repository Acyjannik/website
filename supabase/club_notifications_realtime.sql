-- ACY CLUB V8.7 — Realtime notification center
create or replace function public.ensure_club_notifications_realtime()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='club_notifications'
  ) then
    alter publication supabase_realtime add table public.club_notifications;
  end if;
end;
$$;

select public.ensure_club_notifications_realtime();
drop function if exists public.ensure_club_notifications_realtime();
