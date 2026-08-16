ACY PUSH SETUP
==============

Supabase:
1. Run `supabase/push_notifications_v9.9.sql`.

Vercel Environment Variables:
- VAPID_SUBJECT = mailto:DEINE-EMAIL-ADRESSE
- VAPID_PUBLIC_KEY = <public VAPID key>
- VAPID_PRIVATE_KEY = <private VAPID key>

The public key is served to browsers through `/api/push-config`.
The private key stays server-side.

Generate a VAPID key pair once with Node after installing the dependency:
  npx web-push generate-vapid-keys

Then paste the two generated keys into Vercel.

Deploy the new files. No existing email environment variables change.

iPhone:
Safari → ACY → ACY install button → Share → Add to Home Screen → Add.
Then tap “Push-Benachrichtigungen aktivieren”. Apple requires a Home Screen web app and the permission request must result from direct user interaction.

Android:
Chrome/Edge/Samsung Internet usually exposes an Install / Add to Home Screen action for installable PWAs. The ACY install button will use the browser-native prompt when available; otherwise the helper explains where to install it.
