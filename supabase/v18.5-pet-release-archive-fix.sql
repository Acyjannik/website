-- ACYJANNIK V18.5 — Pet release must archive, never delete.
-- Applied to Supabase project together with the V18.5 frontend fix.

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
