import { SignJWT, importPKCS8 } from "npm:jose@5.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "POST only" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("ACY_SERVICE_ROLE_KEY");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "de.acyjannik.club";
  const privateKey = Deno.env.get("APNS_AUTH_KEY");
  if (!supabaseUrl || !serviceKey || !keyId || !teamId || !privateKey) return respond(503, { error: "APNs ist noch nicht vollständig konfiguriert." });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return respond(401, { error: "Nicht angemeldet." });
  const internalCall = auth === `Bearer ${serviceKey}`;
  try {
    if (!internalCall) {
      const callerResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: auth } });
      if (!callerResponse.ok) return respond(401, { error: "Ungültige Sitzung." });
      const caller = await callerResponse.json();
      const adminResponse = await fetch(`${supabaseUrl}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(caller.id)}&select=user_id&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!adminResponse.ok || !(await adminResponse.json()).length) return respond(403, { error: "Nur Admins dürfen iOS-Push senden." });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "ACY Club").slice(0, 120);
    const message = String(body?.body ?? "Neue Nachricht im ACY Club.").slice(0, 300);
    const targetUrl = String(body?.url ?? "/club-profile.html").slice(0, 500);
    const targetUserId = body?.userId ? String(body.userId) : null;
    const usersResponse = targetUserId
      ? await fetch(`${supabaseUrl}/rest/v1/ios_push_tokens?user_id=eq.${encodeURIComponent(targetUserId)}&select=device_token,environment`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } })
      : await fetch(`${supabaseUrl}/rest/v1/ios_push_tokens?select=device_token,environment`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!usersResponse.ok) return respond(500, { error: "iOS-Geräte konnten nicht geladen werden." });
    const devices = await usersResponse.json();
    const keyPem = privateKey.replace(/\\n/g, "\n");
    const signingKey = await importPKCS8(keyPem, "ES256");
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: keyId }).setIssuer(teamId).setIssuedAt().sign(signingKey);
    let sent = 0, failed = 0, removed = 0;
    const results: number[] = [];
    const apnsErrors: string[] = [];
    for (const device of devices ?? []) {
      const host = device.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
      const response = await fetch(`${host}/3/device/${encodeURIComponent(device.device_token)}`, {
        method: "POST",
        headers: { authorization: `bearer ${jwt}`, "apns-topic": bundleId, "apns-push-type": "alert", "apns-priority": "10", "content-type": "application/json" },
        body: JSON.stringify({ aps: { alert: { title, body: message }, sound: "default", category: "ACY_DEFAULT" }, url: targetUrl }),
      });
      results.push(response.status);
      if (!response.ok) apnsErrors.push((await response.text()).slice(0, 240));
      if (response.ok) sent++;
      else if (response.status === 410) {
        await fetch(`${supabaseUrl}/rest/v1/ios_push_tokens?device_token=eq.${encodeURIComponent(device.device_token)}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
        removed++;
      } else failed++;
    }
    return respond(200, { ok: true, sent, failed, removed, devices: Array.isArray(devices) ? devices.length : 0, apnsStatuses: results, apnsErrors });
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : "iOS-Push konnte nicht gesendet werden." });
  }
});
