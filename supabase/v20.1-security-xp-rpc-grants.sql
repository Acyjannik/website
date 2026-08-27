-- ACY CLUB SECURITY: restrict XP RPC execution to server-side service role.
-- Apply this migration to the DEV Supabase project only.
-- The application server calls these RPCs with SUPABASE_SERVICE_ROLE_KEY.

revoke all on function public.award_club_xp(uuid, text, integer) from public;
revoke all on function public.award_club_xp(uuid, text, integer) from authenticated;
grant execute on function public.award_club_xp(uuid, text, integer) to service_role;

revoke all on function public.revoke_club_xp(uuid, text, integer) from public;
revoke all on function public.revoke_club_xp(uuid, text, integer) from authenticated;
grant execute on function public.revoke_club_xp(uuid, text, integer) to service_role;
