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


## V2.3.1: Public content sync fix

The homepage now loads settings, social links and enabled games through `/api/site-content`.
This avoids browser-side Supabase query inconsistencies and provides a single server-side read path.
The admin dashboard also shows the last successful save time.


## V2.4: Admin Suite

The admin panel now includes:
- tabbed dashboard navigation
- Twitch/system status
- website content editing with live preview
- social link add/edit/delete
- game reorder, visibility, Main Game flag and descriptions
- password change for the signed-in admin
- Supabase Storage image uploads
- Hero image activation and game-image linking
- recent media preview

### Storage setup
Run the updated `supabase/setup.sql` once. It creates the public `site-media` bucket and admin-only write policies. Supabase documents browser uploads for existing buckets and recommends standard uploads for smaller files; this UI caps uploads at 6 MB for reliable browser handling. citeturn282563search2turn282563search11


## V2.4.1: Content restoration + game covers

Default social links and the four current games are restored automatically when an authorized admin logs in. Missing game images are repaired automatically. Bundled custom SVG cover art is used for:
- Fortnite
- GTA V
- Meccha Chameleon
- Thick As Thieves

A standalone `supabase/restore_default_content.sql` is also included for manual restoration if needed.


## V2.4.2: Robust fallback content

The public site no longer depends on Supabase being populated before the current games and social links appear.
The API and client use bundled fallback content, and the admin login repairs missing default rows without overwriting intentional admin edits.


## V2.4.3: Dynamic content visibility fix

Fixed a front-end issue where games and social cards loaded from Supabase were inserted with the `reveal` class after the initial IntersectionObserver had already run. The new dynamic cards are rendered visibly and no longer depend on the initial observer.


## V2.4.4: Real game artwork

The game cards now use recognizable game artwork rather than generated placeholder covers:
- Fortnite: Wikimedia Commons promotional photo (CC BY-SA 4.0 source)
- GTA V: Steam store header
- Meccha Chameleon: Steam store header
- Thick As Thieves: Steam store header

Artwork remains owned by its respective rights holders where applicable. The website should retain appropriate attribution/usage rights if the site is used commercially.


## V2.4.5: Game artwork and card layout fix

The current four games now use canonical artwork URLs server-side and client-side, overriding legacy placeholder image URLs that may still exist in Supabase. The cards are also rebuilt as a vertical image + content layout so titles and descriptions no longer sit beside or clip against the cover art.


## V2.4.6: Current games cleaned up

Meccha Chameleon has been removed. The current game lineup is Fortnite, GTA V, and Thick As Thieves. Older Meccha rows are automatically removed at admin login, and a cleanup SQL file is included.


## V2.4.7: Admin content + social icon fix

The admin dashboard now always displays the three current games and three current social platforms, even when the database is empty or a read is temporarily unavailable. Standard items can be saved directly into the database from the admin UI. Social cards use local SVG icon assets for Twitch, TikTok and WhatsApp.


## V2.4.8: Stable admin editors

Games and Socials are now rendered as stable, always-visible admin rows. Supabase data hydrates these rows instead of dynamically creating the editor DOM, so the existing items remain visible even if a database read is delayed or empty.


## V2.4.9: Social icon path fix

Social SVG icons for Twitch, TikTok and WhatsApp are included in the repository and referenced with root-relative paths so they also load correctly from `/admin.html`.


## V2.4.10: Admin initialization fix

The admin login now waits for the Supabase configuration and client initialization before enabling the login button. If the configuration endpoint or Supabase library fails, the page shows a direct diagnostic instead of `Cannot read properties of null (reading 'auth')`.


## V2.4.12: Final Meccha cleanup

All Meccha-like legacy game rows are filtered from the public API and client, and the admin now removes any database row whose name contains "meccha". A manual cleanup button and SQL file are included as a final safeguard.


## V2.4.13: remove legacy game flash

The homepage now initializes the Games section directly with the three current games before any Supabase/API hydration. This prevents a discontinued legacy card from flashing briefly during page load.


## V2.4.14: Public social icons

The public Socials section now shows the bundled Twitch, TikTok and WhatsApp SVG icons immediately and keeps them when the section hydrates from Supabase.


## V2.4.15: Social icons + Discord

Fixed the public social hydration so it no longer replaces real icons with TW/TK/WA text after Supabase loads. Added Discord with the ACY Club invite `https://discord.gg/74ACqBwfu` to the public site, admin defaults, and Supabase seeds.


## V2.4.16: About text sync

The "Über Jannik" text field in the admin now updates the public About section on the homepage. The field was already being saved to Supabase, but the public page had no target element and did not apply `about_text` during hydration.


## V2.4.17: ACY Club Discord CTA

The ACY Club button now links directly to the ACY Club Discord invite.


## V2.4.18: Daily Fortnite schedule

Added a public schedule card: **Jeden Tag um 20:00 Uhr** with Fortnite and a direct Twitch button.


## V2.4.19: Schedule time update

The daily Fortnite schedule is now **20:30 Uhr**.


## V2.4.20: Schedule marker polish

Removed the confusing numeric "20" tile from the daily schedule card and replaced it with a simple play marker. The actual schedule remains 20:30 Uhr.


## V2.4.21: ACY Club Discord CTA fix

The ACY Club Discord button is now explicitly linked to the ACY Club invite and no longer uses the disabled/placeholder state.


## V2.4.22: ACY Club layout fix

Removed the duplicate Discord CTA, fixed the leaked `class="eyebrow">CONNECT` fragment, and centered the ACY Club content/Discord button.


## V2.4.23: Final ACY Club / Socials cleanup

Rebuilt the Club and Socials markup cleanly: one active Discord CTA, centered Club content, and a proper CONNECT heading with no leaked HTML fragment.


## V2.5.0: ACY Club registration + login

Added:
- `/club.html` for registration and login
- password reset request
- `/club-profile.html` for the signed-in member profile
- Supabase `profiles` table with automatic profile creation
- RLS so members can read/update only their own profile
- ACY Club registration CTA on the homepage
- Discord CTA for the community
- `supabase/club_members.sql` to initialize the member profile system

### One-time Supabase setup
Run `supabase/club_members.sql` once in the Supabase SQL Editor.
The existing `SUPABASE_URL` and `SUPABASE_ANON_KEY` Vercel variables are reused.


## V2.6: Member dashboard

Expanded `/club-profile.html` with:
- editable display name + bio
- profile avatar upload
- Twitch live/offline card with current game and viewer count
- XP/level progress
- member badges
- Discord CTA

Run the updated `supabase/club_members.sql` and `supabase/club_storage.sql` once.


## V2.6.1: Member dashboard robustness

Fixed null DOM access in the member dashboard and made the Twitch card fail gracefully while still showing live/offline status. Also bumped the client script version to avoid stale browser caching.


## V2.6.1: Twitch + null-safety fix

The member dashboard now tolerates missing DOM elements, and the Twitch card updates all available fields safely. Client cache version bumped to 2.6.1.


## V2.7: Events + News

Added ACY Club Events and ACY News to the member dashboard and Admin. Run `supabase/club_events_news.sql` once in Supabase SQL Editor.


## V2.8: XP + Badges

Added server-side one-time XP awards for:
- registration
- profile completion
- profile picture
- Discord connection placeholder
- event attendance placeholder
- 7-day membership
- 30-day membership

Added automatic progression badges and an Admin overview under **XP & Badges**.
Run `supabase/club_progression.sql` once in Supabase SQL Editor.

**Important:** The progression API expects `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production. This key must never be exposed to the browser.


## V2.8.1: Avatar upload fix

The profile avatar now uses a dedicated `club-avatars` Supabase Storage bucket with per-user folder policies. This avoids the `new row violates row-level security policy` error caused by the old storage path/policy setup.

Run `supabase/club_storage.sql` once in the Supabase SQL Editor.


## V2.8.2: Avatar upload code fix

Fixed the actual browser upload code to use the dedicated `club-avatars` bucket. The previous build still referenced `site-media` despite the new storage SQL. Re-run `supabase/club_storage.sql` once.


## V2.8.3: Avatar display cleanup

Fixed the member header showing the uploaded profile image and the fallback initial at the same time. Hidden avatar elements now remain hidden regardless of CSS display rules.


## V2.9: Discord account linking

The member dashboard now supports linking an existing ACY Club account to a Discord identity through Supabase Auth's `linkIdentity({ provider: 'discord' })`.

### One-time Supabase setup
1. Run `supabase/club_discord.sql`.
2. In **Authentication → Sign In / Providers → Discord**, enable Discord and configure the Discord Client ID and Client Secret.
3. In **Authentication → URL Configuration**, allow `https://acyjannik.de/club-profile.html` as a redirect URL.
4. Enable Supabase **Manual Linking** in Auth security settings.
5. In the Discord Developer Portal, use the Supabase project's callback URL shown under the Discord provider (format: `https://<project-ref>.supabase.co/auth/v1/callback`).

After setup, the member can click **Discord verbinden**. The OAuth identity is linked to the existing member account rather than creating a separate site account.


## V2.9.1: Discord linking diagnostics

The Discord button now explicitly follows the OAuth URL returned by Supabase and shows the exact setup error below the button if no OAuth URL is returned or linking fails.


## V2.9.2: Discord progression

Discord linking now visibly unlocks the **Discord Member** badge and awards the configured **+50 XP** once. The Member dashboard updates XP and badges immediately after a successful link.


## V3.0: Event participation

Added:
- `club_event_attendance` table with one row per member/event
- Join/leave buttons in the Member dashboard
- live attendee counts
- +100 XP once per event attended
- authenticated attendance API
- events now show whether the current member is attending

Run `supabase/club_event_attendance.sql` once in Supabase SQL Editor.


## V3.0.1: Event XP reversal

Leaving an event now also reverses the +100 XP that was awarded for that attendance. The XP record is removed server-side so the score cannot remain inflated after cancelling participation.
Run the updated `supabase/club_progression.sql` once in Supabase SQL Editor so the `revoke_club_xp` function exists.


## V3.0.2: Attendance state persistence

Event attendance is now reloaded from Supabase with the authenticated member session and explicitly re-renders the button as `Dabei ✓` after a page reload.


## V3.1: ACY Club member directory

Added an authenticated member directory to the Member dashboard:
- member count
- search by username/display name
- profile image or avatar fallback
- display name and username
- short bio
- XP/level
- selected badges

The directory API exposes only these public profile fields and never exposes member email addresses.


## V3.1.1: Member directory fix

The member directory now reads profiles directly through the authenticated Supabase client. The previous `/api/club-members` endpoint returned a Vercel HTML page instead of JSON. A dedicated authenticated RLS policy was added for directory reads.


## V3.1.2: Member directory render fix

Defined the missing `escapeAttr()` helper used by member avatar URLs. This fixes the `escapeAttr is not defined` error that prevented the directory from rendering.


## V3.2: Public member profiles

Clicking a member in the directory now opens `/member.html?id=...`.
Authenticated club members can see:
- profile image
- display name + username
- bio
- member since
- XP + level
- Discord connection state
- badges

Emails and auth-provider data are never exposed.


## V3.3: ACY Clips

Added:
- ACY Clips section in the Member dashboard
- admin Clip management
- title, Twitch clip URL, thumbnail URL, category and description
- enable/disable, edit and delete
- responsive clip cards
- direct links to Twitch clips

Run `supabase/club_clips.sql` once in Supabase SQL Editor.


## V3.3.1: Remove demo clip

Removed the seeded demo clip. Running `supabase/club_clips.sql` now also deletes the old placeholder `ACY Clip` row from V3.3. The public Member dashboard stays empty until a real clip is added.


## V3.3.2: Full clip management

The Admin Clips section now supports opening, editing, saving, resetting, enabling/disabling, and deleting existing clips. Editing includes title, category, clip URL, thumbnail URL and description.
