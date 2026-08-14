# Acyjannik V2.1

Aktualisierte Website-Version mit Acyjannik-Portrait für **acyjannik.de**.

## Enthalten
- Dark / Purple Design
- Responsive Desktop- und Mobile-Layout
- Hero für Acyjannik
- vorbereiteter Twitch-Bereich
- Games: Fortnite, GTA V, Overwatch
- ACY Club Bereich
- Twitch, TikTok und WhatsApp Links
- Platzhalter für späteres Jannik-Foto
- dezente Scroll-Animationen

## Noch für V2 vorgesehen
- echter Twitch Embed + Live-Status über Twitch API
- Twitch Chat
- Discord Invite
- echte Bilder / Branding Assets
- automatische Game-/Streamdaten
- SEO / Social Preview
- optionales Admin-CMS

## Lokal ansehen
Die Datei `index.html` kann direkt im Browser geöffnet werden. Für die spätere Veröffentlichung empfiehlt sich ein Deployment über Vercel.


## V2 – Twitch Integration

- Real Twitch video player for `acyjannik`
- Real Twitch chat embed
- Responsive player/chat layout
- Twitch links updated for the Acyjannik channel
- The embed automatically uses the current hostname as Twitch's required `parent` value when deployed.

### Important
Twitch requires the embedding site to use HTTPS and the correct `parent` domain. The live domain `https://acyjannik.de` must therefore be configured before the production embed can work. See the official Twitch embed documentation for the current requirements.


## Current games
- Fortnite (main game)
- GTA V
- Meccha Chameleon
- Thick As Thieves


## V2.2: Twitch Live API

This version includes `/api/twitch-status`, a Vercel serverless function that uses Twitch's Client Credentials flow to check whether `acyjannik` is live and return the current stream title, game and viewer count.

### Vercel Environment Variables

Add these in **Project Settings → Environment Variables**:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Do not place the client secret in front-end files or commit it to GitHub.

The public site polls `/api/twitch-status` every 60 seconds.


## V2.3: Admin-Bereich

Admin URL: `/admin.html`

### Supabase setup

1. Create a Supabase project.
2. In **Authentication → Users**, create the admin email/password account.
3. Open **SQL Editor** and run `supabase/setup.sql`.
4. Copy the Auth user's UUID and insert it into `public.admin_users` using the commented SQL line.
5. In Vercel → Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Redeploy the production deployment.

The browser only receives the Supabase URL and the public anon key. Admin write access is controlled by Supabase RLS policies and the `admin_users` table. Never add the Supabase service-role key to the frontend or GitHub.


### Public site syncing

The public homepage reads the public `site_settings`, `social_links`, and `games` rows via the Supabase anon key and RLS. If Supabase is not configured yet, the homepage falls back to its built-in static content.
