# Supabase Edge Functions

## iOS APNs token registration

Deploy from the website repository with:

```sh
supabase functions deploy ios-push-register --no-verify-jwt
supabase secrets set ACY_SERVICE_ROLE_KEY="<service-role-key>"
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically by Supabase. The function still validates the user's bearer token through Supabase Auth before writing to `ios_push_tokens`.

After deployment, the iOS app should call:

`https://<project-ref>.supabase.co/functions/v1/ios-push-register`

Do not put the service-role key in the iOS app.

## Sending an iOS push

The `ios-push-send` function is admin-only. Configure these secrets before deploying it:

```sh
supabase secrets set \
  ACY_SERVICE_ROLE_KEY="<service-role-key>" \
  APNS_KEY_ID="<apple-key-id>" \
  APNS_TEAM_ID="<apple-team-id>" \
  APNS_BUNDLE_ID="de.acyjannik.club" \
  APNS_AUTH_KEY="<contents-of-AuthKey_XXXXXXXXXX.p8>"

supabase functions deploy ios-push-send --no-verify-jwt --use-api
```

Call it with an admin Supabase access token and JSON such as `{ "title": "ACY Club", "body": "Testnachricht" }`.
