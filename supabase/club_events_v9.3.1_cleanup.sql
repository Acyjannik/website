-- ACY CLUB V9.3.1 — Event cleanup
delete from public.club_events
where title='Fortnite Community Night'
  and description='Gemeinsame Runden mit der ACY Community.';

update public.club_events
set enabled=false
where event_date < now() and enabled=true;
