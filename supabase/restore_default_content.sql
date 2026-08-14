-- Restore ACYJANNIK default social links and games.
-- Run this in Supabase SQL Editor if you prefer to restore without logging into /admin first.

insert into public.social_links (platform, label, url, enabled, sort_order)
values
  ('twitch', 'Twitch', 'https://www.twitch.tv/acyjannik', true, 1),
  ('tiktok', 'TikTok', 'https://www.tiktok.com/@acyjannik', true, 2),
  ('whatsapp', 'WhatsApp', 'https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10', true, 3)
on conflict (platform) do update set
  label = excluded.label,
  url = excluded.url,
  enabled = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.games (name, description, tag, image_url, featured, sort_order, enabled)
values
  ('Fortnite', 'Main Game · Ranked · Community', 'MAIN GAME', '/assets/games/fortnite.svg', true, 1, true),
  ('GTA V', 'Open World · Aktuell · Fun', 'AKTUELL', '/assets/games/gta-v.svg', false, 2, true),
  ('Meccha Chameleon', 'Variety · Hide & Seek · Community', 'VARIETY', '/assets/games/meccha-chameleon.svg', false, 3, true),
  ('Thick As Thieves', 'Stealth · Heist · Community', 'VARIETY', '/assets/games/thick-as-thieves.svg', false, 4, true)
on conflict (name) do update set
  description = excluded.description,
  tag = excluded.tag,
  image_url = excluded.image_url,
  enabled = true,
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Sync the public homepage to the same static cover paths.
