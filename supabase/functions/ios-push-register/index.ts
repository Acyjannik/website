const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // Supabase reserves the SUPABASE_ prefix for built-in variables.
  const serviceKey = Deno.env.get("ACY_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json(503, { error: "Push service is not configured." });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(401, { error: "Nicht angemeldet." });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    if (!userResponse.ok) return json(401, { error: "Ungültige Sitzung." });

    const user = await userResponse.json();
    if (!user?.id) return json(401, { error: "Benutzer konnte nicht ermittelt werden." });

    const body = await req.json().catch(() => ({}));
    const deviceToken = String(body?.deviceToken ?? "").trim().toLowerCase();
    const environment = String(body?.environment ?? "").trim().toLowerCase();
    const deviceName = String(body?.deviceName ?? "").trim().slice(0, 120);

    if (!/^[a-f0-9]{32,256}$/.test(deviceToken)) {
      return json(400, { error: "Ungültiger APNs-Device-Token." });
    }
    if (!["sandbox", "production"].includes(environment)) {
      return json(400, { error: "Ungültige APNs-Umgebung." });
    }

    const now = new Date().toISOString();
    const response = await fetch(
      `${supabaseUrl}/rest/v1/ios_push_tokens?on_conflict=device_token`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          device_token: deviceToken,
          environment,
          device_name: deviceName || null,
          last_seen: now,
          updated_at: now,
        }),
      },
    );

    if (!response.ok) return json(500, { error: await response.text() });
    return json(200, { ok: true, saved: true });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "APNs-Token konnte nicht gespeichert werden." });
  }
});
