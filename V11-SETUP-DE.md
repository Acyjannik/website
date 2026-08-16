ACY V11 — Twitch & Votes Setup
==============================

1. Supabase: run `supabase/v10.4.2_poll_mod_rls.sql` to fix the Mod Vote error.
2. Supabase: run `supabase/v11_twitch.sql`.
3. Twitch Developer Console:
   - Use the existing Twitch application if you have one.
   - Add OAuth Redirect URL:
     https://YOUR-DOMAIN/api/twitch-callback
   - Keep Client ID and Client Secret in Vercel.
4. Vercel Environment Variables:
   TWITCH_CLIENT_ID=<existing client id>
   TWITCH_CLIENT_SECRET=<existing client secret>
   TWITCH_REDIRECT_URI=https://YOUR-DOMAIN/api/twitch-callback
   TWITCH_OAUTH_STATE_SECRET=<random long secret>
   PUBLIC_SITE_URL=https://YOUR-DOMAIN
5. Deploy V11.

Important:
- The OAuth integration requests no extra Twitch scopes for the basic account-linking feature.
- Do not expose TWITCH_CLIENT_SECRET or the OAuth state secret in client code.
- ACY Stream-Zeit is measured by active ACY session heartbeats while the Twitch channel is live. It is intentionally not presented as Twitch's official Watch Time.
- Additional Twitch features such as follows, subs, cheers or Channel Points can be added later with the corresponding Twitch OAuth scopes/EventSub subscriptions.
