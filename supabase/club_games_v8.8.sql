-- ACY CLUB V8.8 — Expand Community Games
insert into public.games (name,description,tag,image_url,featured,sort_order,enabled)
values
  ('Overwatch','Hero Shooter · Competitive · Community','COMPETITIVE','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2357570/header.jpg',false,4,true),
  ('MECCHA CHAMELEON','Hide & Seek · Party · Community','VARIETY','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/4704690/header.jpg',false,5,true),
  ('Dead by Daylight','Horror · Multiplayer · Community','HORROR','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/381210/header.jpg',false,6,true),
  ('Roblox','Variety · Community · Fun','VARIETY','/assets/games/roblox-acy-cover.svg',false,7,true)
on conflict (name) do update set
  description=excluded.description,
  tag=excluded.tag,
  image_url=excluded.image_url,
  sort_order=excluded.sort_order,
  enabled=true;

-- Keep the public homepage intentionally compact: the first three entries
-- stay Fortnite, GTA V and Thick As Thieves. Additional games remain in
-- the full community/profile catalog.
