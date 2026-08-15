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
- Thick As Thieves: Steam store header

Artwork remains owned by its respective rights holders where applicable. The website should retain appropriate attribution/usage rights if the site is used commercially.


## V2.4.5: Game artwork and card layout fix

The current four games now use canonical artwork URLs server-side and client-side, overriding legacy placeholder image URLs that may still exist in Supabase. The cards are also rebuilt as a vertical image + content layout so titles and descriptions no longer sit beside or clip against the cover art.


## V2.4.6: Current games cleaned up



## V2.4.7: Admin content + social icon fix

The admin dashboard now always displays the three current games and three current social platforms, even when the database is empty or a read is temporarily unavailable. Standard items can be saved directly into the database from the admin UI. Social cards use local SVG icon assets for Twitch, TikTok and WhatsApp.


## V2.4.8: Stable admin editors

Games and Socials are now rendered as stable, always-visible admin rows. Supabase data hydrates these rows instead of dynamically creating the editor DOM, so the existing items remain visible even if a database read is delayed or empty.


## V2.4.9: Social icon path fix

Social SVG icons for Twitch, TikTok and WhatsApp are included in the repository and referenced with root-relative paths so they also load correctly from `/admin.html`.


## V2.4.10: Admin initialization fix

The admin login now waits for the Supabase configuration and client initialization before enabling the login button. If the configuration endpoint or Supabase library fails, the page shows a direct diagnostic instead of `Cannot read properties of null (reading 'auth')`.





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


## V3.3.3: Existing clip list fix

Fixed the Admin Clips list failing before render because `escapeAttr()` / `escapeHtml()` were missing from `admin.js`. Existing clips can now render and be opened/edited/deleted.


## V3.4: ACY Club header CTA

Added a prominent `ACY Club beitreten` call-to-action in the desktop header/navigation. It links directly to `/club.html` and hides on small screens to avoid crowding the mobile navigation.


## V3.4.1: Header CTA fix

The previous V3.4 attempted to insert the Club CTA only if `/club.html` was absent anywhere in the homepage. Because the link already existed in the Club section, the header insertion was skipped. V3.4.1 inserts the CTA explicitly into the actual navigation.

## V3.5: ACYJANNIK favicon

Added a site-wide SVG favicon using the ACY monogram style. All HTML pages reference `/assets/favicon.svg`, including the login, member, public member, and admin pages.


## V3.5.1: Password reset flow

Added a dedicated `/club-reset.html` recovery page. Password recovery emails now redirect there, where the recovery session is used to set a new password with `updateUser({ password })`.

This fixes the previous behavior where the recovery link returned the user to the normal member page without giving them a password-change form.

Note: Supabase's built-in email provider currently allows only 2 auth emails per hour project-wide. Frequent password-reset testing can therefore trigger `email rate limit exceeded`. For production, configure custom SMTP to get a higher email-send allowance.


## V3.6: Leaderboard + achievements + member statistics

Added:
- ACY Club leaderboard (top 10, XP sorted)
- clickable leaderboard rows to public member profiles
- member stats: events, badges, XP, membership days
- automatic achievement checks
- initial achievements: ACY Rookie, Discord Member, Event Fan, Event Hunter, Early Member, ACY OG, ACY Legend
- new `club_achievements` table
- protected leaderboard API

Run `supabase/club_achievements.sql` once in Supabase SQL Editor.


## V3.9: Member Hub + Notifications + Community Spotlight

Combined the next three roadmap steps:
- personal Member Hub with level/XP progress, Twitch live state, upcoming events and recent achievements
- in-site notifications bell with unread count
- Community Spotlight / Member of the Month card in the Member area and public homepage
- new Supabase tables for notifications and spotlight
- public spotlight API + authenticated notification API

Run `supabase/club_notifications_spotlight.sql` once in Supabase SQL Editor.

Notifications are intentionally UI-only for now: the table is ready for later automatic events such as new badges, event reminders and live-start notifications.


## V3.9.1: Member Hub reliability

Optional Hub/notification/spotlight loaders now run independently via `Promise.allSettled()`, so one failed optional API cannot stop the remaining dashboard additions. Client cache version bumped to 3.9.1.


## V3.9.2: Hub visibility hardening

The Member Hub and Spotlight are now hard-coded into the member page directly after the hero and explicitly forced visible in CSS. Notification controls are also inserted directly into the member header. Script cache version bumped to 3.9.2.


## V3.9.3: Vercel serverless function limit

Vercel Hobby allows at most 12 Serverless Functions per deployment. The project previously had 13 under `/api`, which caused the entire production deployment to fail.

The standalone `club-member.js` function has been merged into `club-members.js`:
- `/api/club-members` -> member directory
- `/api/club-members?id=<uuid>` -> public member profile

This reduces `/api` from 13 functions to 12 without removing functionality.


## V4.0 Legal & Privacy
Added Impressum, Datenschutzerklärung, Account & Datenschutz page, account deletion, footer links, and registration legal links. Legal pages contain explicit placeholders for the operator's real identity/address/contact data and must be completed before publication. The account deletion endpoint is folded into the existing notifications function to keep the Vercel Hobby deployment at 12 functions.


## V4.1 Notifications

- Automatic notifications for XP/progression awards
- Level-up notifications
- Achievement notifications
- Event join/leave notifications
- Unread counter in the notification bell
- "Alle gelesen" action
- Notification history remains stored in `club_notifications`
- Uses the existing 12 Vercel Serverless Functions, no new function added


## V4.1.1 Auth Flow Fix

- Registration success no longer depends on an immediate Supabase session when email confirmation is enabled.
- Confirmation links redirect to `/club-profile.html`.
- Registration XP is awarded on the first authenticated session/login, with server-side duplicate protection.
- Profile initialization also retries the one-time registration XP award as a safe fallback.


## V4.1.2 Account Delete Fix
- Account deletion now uses an explicit `action=delete_account` route in the existing notification function.
- Auth deletion relies on the existing `ON DELETE CASCADE` relationships.
- Frontend safely handles non-JSON server responses instead of throwing `Unexpected token`.
- No additional Vercel Serverless Function added; remains at 12.


## V4.2 + V4.3: Spotlight & Achievement Expansion

- Admin Spotlight tab with member search, selection, current spotlight and clear action.
- Active Spotlight is stored in `club_spotlight`.
- Selecting a member creates a Spotlight notification.
- Expanded achievement rules: profile complete, event fan/hunter/regular/legend, 100/500/1000 XP clubs, 30/90 day membership, Discord member.
- No additional Vercel function; API count remains 12.


## V4.3.2
- Fixed Spotlight persistence to match the existing `club_spotlight` schema (`blurb`, `month_key`).
- Admin Spotlight loads members through the existing server-side member API.
- XP & Badges now shows actual earned achievements per member.
- No additional Vercel Function.


## V4.4
- Moved Community Spotlight to directly below the member profile header so it is visible immediately.
- Spotlight remains the same component/IDs; only placement and visual emphasis changed.


## V4.4.1
- Moved the public Community Spotlight to immediately below the homepage hero.
- Kept the existing Spotlight API and rendering logic unchanged.
- Added stronger visual emphasis for the homepage Spotlight card.


## V5.0 — ACY Club Chat
- Live member-only chat with Supabase Realtime.
- Last 100 messages loaded on entry.
- Instant new-message and delete updates.
- Online presence count.
- 500-character limit and server-side 2-second rate limit.
- Server-side temporary chat bans are supported by the database schema.
- Members can delete their own messages.
- Admins can delete messages through the existing RLS policy.
- Run `supabase/club_chat.sql` once before testing the chat.


## V5.0.1
- Fixed chat profile loading: `club_chat_messages.user_id` references `auth.users`, so messages and `profiles` are now loaded separately.
- Fixed Realtime INSERT enrichment using the same profile lookup.
- Added clearer chat connection/error reporting.


## V5.0.2 — Registration clarity
- Username field now visibly explains the lowercase-only rule.
- Uppercase letters are normalized to lowercase while typing.
- Unsupported username characters are removed immediately.
- Added `autocapitalize="none"` and disabled spellcheck for usernames.
- Confirmation message now explicitly reminds users to check spam/junk.


## V5.0.3 — Discord unlink
- Added a user-facing “Discord trennen” action in the ACY Club profile.
- Uses Supabase Auth `unlinkIdentity()` to remove the Discord identity.
- Synchronizes `profiles.discord_connected` after unlinking.
- Discord badge disappears when disconnected.
- The one-time +50 XP progression event is intentionally not revoked, preventing XP farming by reconnecting repeatedly.
- Added confirmation and clear success/error states.


## V5.0.4 — Discord reconnect reliability
- Explicitly enables Supabase OAuth callback/session detection.
- Uses PKCE for the browser auth flow.
- Adds OAuth callback error reporting instead of silently returning to the profile.
- Adds a short callback settling delay before checking linked identities.
- Adds an explicit `discord_callback=1` redirect marker.


## V5.0.5 — Discord XP + OAuth redirect
- Fixed stale `club-profile.html` cache-buster that was still loading `club-profile.js?v=3.9.2`.
- Discord disconnect now revokes the +50 XP.
- The XP event is kept as a zeroed one-time marker, so reconnecting cannot farm the XP repeatedly.
- Discord OAuth still returns to `/club-profile.html?discord_callback=1`.
- No new Supabase table is required, but the updated `supabase/club_progression.sql` must be run once to replace the revoke function.


## V5.0.6 — Exact Discord redirect
- Fixed the Discord OAuth redirect to use the exact allow-listed URL `/club-profile.html`.
- Removed the `?discord_callback=1` query parameter, which was not present in Supabase's exact redirect allow-list and could therefore fall back to the Site URL.


## V5.0.7 — Reversible Discord XP
- Fixed the XP lifecycle: Discord connected = +50 XP, Discord disconnected = -50 XP, reconnecting = +50 XP again.
- The event row remains unique but can be reactivated when its stored XP is 0.
- Repeated connect/disconnect cycles do not stack XP; the current connection state determines the +50/-50.
- Updated the progression SQL function accordingly.


## V5.0.8 — Notifications + public Club state
- “Alle gelesen” now calls the existing server-side notification endpoint and immediately clears the visible notification list and unread badge.
- Public homepage header detects an existing Supabase session.
- Logged-in members see their avatar (or initial) and display name instead of “ACY Club beitreten”.
- The header member control links directly to `/club-profile.html`.


## V5.0.9 — Public session detection fix
- Fixed the public homepage missing the Supabase JS client.
- The homepage now loads the same Supabase JS library used by the Club pages before `script.js`.
- Added a short wait for a slow CDN response so the logged-in header is not silently skipped.


## V5.0.10 — Responsive navigation
- Fixed the mobile hamburger menu: the nav was hidden at <=900px but had no `.nav.mobile-open` style.
- Added a proper mobile dropdown/panel containing Live, Games, ACY Club, Socials and the Club CTA.
- The menu button now changes between ☰ and ✕ and has the correct accessible label.
- Tapping a navigation link closes the mobile menu.


## V5.1 — Private messages
- Added member-to-member direct messaging with Supabase RLS.
- Added conversation list, live message delivery, timestamps and own-message deletion.
- Added a “Nachricht senden” button on member profiles.
- Member-profile links can open a new DM directly via `?dm=<user_id>`.
- New DMs create an in-app notification for the recipient.
- Added Realtime for direct messages.


V5.1 uses Supabase RLS directly for DM reads/writes; no service-role key is exposed in the browser.


## V5.2 — Community Polls
- Added one active community poll at a time.
- Members can vote once per poll.
- Votes are stored server-side with RLS and a unique `(poll_id, user_id)` constraint.
- Each successful vote awards +5 XP exactly once via a database trigger.
- Vote counts update live through Supabase Realtime.
- Admins can create, activate and end polls.


## V5.2.1 — Admin login fix
- Fixed a JavaScript initialization-order error introduced by the Community Poll admin code.
- The poll event binding now runs only after the `$` DOM helper and Supabase variables are initialized.
- This restores the Admin Login handler while keeping the V5.2 poll functionality.


## V6.0 — Live Hub
- Upgraded the existing Twitch Helix status into a more visible live experience.
- Added a floating live alert with stream title, game and viewer count.
- Added live viewer count and stream start time to the Twitch section.
- Twitch status refreshes every 30 seconds while the page is open.
- Live alert can be dismissed without disabling the actual live status.
- Twitch credentials remain server-side in `/api/twitch-status.js`.


## V5.2.2 — Admin initialization fix
Community Poll admin code is now initialized only after the base DOM/Supabase helpers exist, restoring the Admin Login handler.


## V5.5 — Admin Control Center
- Grouped admin navigation into Overview, Website, Community and System.
- Added a useful dashboard with member, XP, achievement, poll and Spotlight metrics.
- Added a manual dashboard refresh.
- Added member search and aggregate stats to XP & Badges.
- Prevented default-content seeding from overwriting an admin-customized game image.
- Added duplicate-binding guards for admin navigation/Spotlight controls.
- No new database tables or SQL migrations are required for the admin overhaul.


## V5.6 — XP & Achievement Catalog
- Added a member-facing XP and achievement catalog.
- Shows all current XP sources, amounts, one-time/repeatable explanations and current status.
- Shows all current achievements with unlock requirements and live progress.
- Shows the five current ACY Club levels and their XP thresholds.
- No new database migration is required.
- Pet/Tamagotchi functionality is intentionally not included; that remains a later feature.


## V6.0 — Live Hub
- Prominent live experience on the public homepage.
- Dynamic Twitch stream title, category, viewer count and start time.
- Uses Twitch stream thumbnail as a live visual when available.
- Header, hero, player status and Live Hub stay synchronized.
- Browser title changes while Acyjannik is live.
- Live alert can be dismissed for the current stream and returns for a new stream.
- Twitch status refreshes every 30 seconds.
- Twitch credentials remain server-side.
- No database migration required.


## V6.1 — Community Games
- Public Games section now reads the existing Supabase `games` catalog instead of hardcoded legacy cards.
- Static legacy game cards are removed from the HTML, so old "Mecha Chamäleon" / fourth-card relics cannot flash back into the page.
- Added a member "Was spielst du gerade?" selector.
- Added anonymized public community game counts.
- Added `supabase/club_game_presence.sql` migration with RLS.
- Public activity exposes game counts only, not member identities.
- Admin already has a dynamic Games catalog; its active games become the member choices automatically.


## V6.2 — Direct Messages
- Direct messages are now presented as a finished member feature.
- Added unread DM count using the existing notification system.
- Opening a DM marks its related message notifications as read.
- Realtime incoming messages refresh the unread state.
- Member directory now has a direct "Nachricht" action without leaving the Club context.
- Existing public member profiles can also start a DM.
- Existing RLS keeps messages limited to sender/recipient; sent messages can be deleted by their sender.
- Uses `supabase/club_direct_messages.sql`; no additional migration beyond that file is required.


## V6.3 — Club Dashboard Cleanup
- Added a sticky in-page section navigation so the long member dashboard is no longer a scroll marathon.
- Large secondary areas are now collapsible with native `<details>` sections.
- The XP & Achievement catalog keeps its full functionality but stays compact until opened.
- Events, News, Messages, Chat, Members, Clips, Ranking, Stats and Discord can be opened on demand.
- Navigation automatically opens a collapsed section before scrolling to it.
- Direct-message links (`?dm=`) automatically open and focus the Messages section.
- Mobile navigation is horizontally scrollable and compact.


## V6.3.2 — Mobile Chat Composer
- Fixed the mobile ACY Club Chat composer where the send button could overlap the textarea/counter.
- Mobile layout now stacks textarea, counter/help text, and Send button.
- Added iOS safe-area padding and width/box-sizing safeguards.
- Desktop/tablet composer remains unchanged.

## V6.3.3 — Achievement Hub Cleanup
- Fixed the compact 'Letzte Erfolge' renderer so badges no longer concatenate together.
- Removed the repeated 'ACY Club' label from each mini achievement.
- Added consistent icon, title and subtitle layout with responsive mobile stacking.


## V6.4 — ACY Pet Companion
- Added a persistent personal pet companion with five species: cat, dog, fox, axolotl and dragon.
- Members can adopt one pet, name it, rename it, feed it, play with it and pet it.
- Pet hunger, happiness and energy decay gently over time.
- Pet actions use server-side Supabase functions with cooldowns and validation.
- The first care action each day grants +5 profile XP and 5 pet-care XP.
- Pet state is protected by RLS and security-definer RPCs instead of trusting client-side stat updates.
- Added responsive mobile UI and a dedicated Club navigation anchor.
- Run `supabase/club_pets.sql` once in Supabase before testing the feature.


## V6.4.1 — Expanded Pet Catalog
- Expanded the pet catalog from 5 to 15 companions.
- Added Unicorn, Penguin, Panda, Bunny, Koala, Hamster, Turtle, Owl, Frog and Bee.
- Server-side species validation was expanded to match the catalog.
- The pet picker is scrollable so the larger selection stays compact on desktop and mobile.
- Existing pets and pet data remain compatible.


## V6.4.2 — ACY Pet Artwork
- Replaced the emoji-only pet presentation with the generated ACY pet artwork from the approved 15-pet sheet.
- Added one standalone WebP asset per pet under `assets/pets/`.
- Kept the generated master sheet as `assets/pets/pet-sheet-generated.png` for provenance/reference.
- Pet selection cards and the active pet view now render the corresponding artwork automatically.
- No new database migration is required for the artwork change.


## V6.4.3 — Flat Pet Assets
- Added every pet image directly under `assets/` as `pet-<species>.webp`.
- Updated the Club profile to reference the flat asset paths instead of `assets/pets/`.
- This avoids deployment/upload tools that fail to preserve nested asset folders.
- Updated the club-profile.js cache-busting version to 6.4.3.
- The original `assets/pets/` files are retained as a backup, but the live UI no longer depends on that folder.


## V6.4.4 — Pet Database Repair
- Pet loading now uses a server-side `get_club_pet()` RPC instead of relying on direct client table reads.
- Added `supabase/club_pets_repair.sql` to repair/create the pet table, update the 15-species constraint and install the loader RPC.
- The UI now hides the active pet panel when loading fails instead of leaving the placeholder cat visible.
- The initial pet avatar is an actual asset, not an emoji.
- Cache-busting updated to 6.4.4.


## V6.5 — Pet Management & Companion Presence
- Added “Tier wechseln” with confirmation. The replacement starts fresh at 100/100/100 and 0 pet XP; normal Club XP is unaffected.
- Added “Tier abgeben” with confirmation. This removes the current pet so the member can adopt another later.
- Added a small authenticated companion widget across the public home page and Club/account/member pages.
- The floating companion shows the pet artwork, name, species and pet level and links directly to the Tier section.
- Added secure `replace_club_pet()` and `release_club_pet()` RPCs.
- Run `supabase/club_pets_repair.sql` again after deploying V6.5 so the new RPCs are installed.


## V6.5.1 — Pet Life & Neglect
- A pet can die only after one care bar reaches 0 and remains at 0 for 72 hours.
- The death check is server-side, in both pet loading and pet actions.
- When a member returns after a death, the UI explains what happened and allows a new adoption.
- Pet artwork references are normalized to the flat `assets/pet-*.webp` files.
- Run `supabase/club_pets_repair.sql` again after deployment.


## V6.6 — Pet Progression
- Added five pet progression levels at 0, 100, 250, 500 and 1,000 pet-care XP.
- Each level now has its own title and subtle visual treatment:
  Level 2 glow, Level 3 sparkle, Level 4 crown aura, Level 5 legendary glow.
- The active pet card shows a visual progression track and progress to the next pet level.
- The global companion widget shows pet level and progression title and reflects higher-level visual effects.
- No database schema changes required.


## V6.6.1 — Pet Balance
- Rebalanced decay: Hunger −1/hour, Happiness −0.5/hour, Energy −0.5/hour.
- Feed: +35 Hunger and +5 Happiness.
- Play: +25 Happiness, −15 Energy and −10 Hunger.
- Pet: +10 Happiness.
- Cooldowns: Feed 30 min, Play 45 min, Pet 15 min.
- All values are capped at 100 and floored at 0.
- Pet action buttons now show their main reward directly in the UI.
- The 72-hour-at-zero death rule remains unchanged.
- Run `supabase/club_pets_repair.sql` again after deployment.


## V7.0 — Notification Center
- Added granular member notification preferences.
- In-app and email switches are separate.
- Categories: Community Votes, Events, News, Live, Achievements, DMs, Spotlight, Rewards and Pet.
- Email is off by default.
- Added `supabase/club_notification_preferences.sql`.
- This version intentionally stops at preferences. The actual mail dispatch will be added as the next small step.


## V7.1 — Email Delivery
- Added a dedicated server-side SMTP email endpoint.
- Publishing a Community Vote now emails only members who enabled both the global email switch and Community Votes.
- Uses IONOS SMTP via Vercel environment variables.
- No email is sent until SMTP is configured.
- In-app notifications and preference storage remain unchanged.
- No new SQL is required for V7.1.


## V7.1.1 — Notification Status Fix
- Fixed the Community Vote admin message overwriting the email-dispatch result with the generic "Umfrage veröffentlicht." text.
- The admin page now keeps the actual result: number of emails sent, SMTP-not-configured, or send error.
- No SQL changes.


## V7.1.2 — Email Diagnostics
- Shows how many members have email enabled and how many are opted in for the active notification category.
- Reports send failures and missing Auth email addresses.
- No SQL changes.


## V7.1.3 — Email Backend Version Check
- Added an explicit API version to email dispatch responses.
- Admin now reports which notification email backend actually answered.
- Admin falls back to `emailEligible` when an older API is still deployed, making mixed deployments obvious.
- No SQL changes.


## V7.1.5 — Existing Email API Test
- Removed the new SMTP test route that returned HTTP 404 on the deployed site.
- Added the SMTP test mode to the already-known `/api/club-notification-email` route.
- The admin test button now calls that existing route with `{ "testSmtp": true }`.
- API version is now 7.1.5.
- No SQL changes.


## V7.1.5.1 — Restore SMTP Test Button
- Restored the missing admin SMTP test button in the Community Votes form.
- The button calls the existing `/api/club-notification-email` route with `testSmtp: true`.
- No SQL changes.


## V7.1.5.2 — Backward-Compatible SMTP Test
- The SMTP test now sends title/body/type fields as well as `testSmtp`.
- This lets the test work with both the new V7.1.5 API and the older deployed email API, which previously rejected empty title/body requests.
- No SQL changes.


## V7.1.6 — Email API Final
- Confirmed and replaced the stale `api/club-notification-email.js`.
- Added an explicit backend version `7.1.6`.
- Kept the SMTP test mode on the existing route instead of introducing another API path.
- No new SQL changes.


## V7.1.7 — IONOS STARTTLS
- Switched SMTP submission from direct TLS to STARTTLS on port 587.
- Matches the IONOS settings shown in the mail-server documentation.
- API version is 7.1.7.
- No SQL changes.


## V7.1.8 — SMTP Envelope Sender Fix
- The SMTP envelope `MAIL FROM` now always uses `SMTP_USER`.
- The visible `From:` header also uses `SMTP_USER`.
- This removes ambiguity when `EMAIL_FROM` is configured differently or is an alias.
- SMTP test result reports the envelope sender without exposing any secret.
- No SQL changes.


## V7.1.9 — SMTP Identity Diagnostics
- SMTP test now reports a masked `SMTP_USER`, its domain and masked `EMAIL_FROM` on SMTP failures.
- Passwords and full secret values are never returned.
- No SQL changes.


## V7.2.0 — Pet Social
- Member profiles now show the member's current companion.
- Member directory previews each member's pet and Social XP.
- Added “Pet besuchen” to jump directly to a member's Pet Social card.
- Pets can greet (+1), play together (+3), or be petted (+2).
- Both participating pets receive Social XP.
- Social XP is separate from care XP.
- Added a 15-minute actor/target cooldown and 20 social interactions per day for each member.
- Added secure Supabase RPCs and a dedicated interaction API.
- Run `supabase/club_pets_repair.sql` once after deployment.


## V7.2.1 — Pet Friendships
- Pet interactions now build a friendship bond in addition to Social XP.
- Friendship levels: Bekannt (1+), Freunde (5+), Beste Freunde (15+ interactions).
- Added a secure `club_pet_friendships` table and RPCs.
- The member's own profile can show a Pet-Freundschaften section with the top 12 friendships.
- No new global XP is awarded for friendship; Social XP remains the pet-only reward.
- Run `supabase/club_pets_repair.sql` again after deployment.
