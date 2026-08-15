export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "Progression service is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const eventKey = String(body.eventKey || "");

  const allowed = {
    registration: 50,
    profile_complete: 25,
    avatar_added: 25,
    discord_connected: 50,
    event_attended: 100,
    member_7_days: 50,
    member_30_days: 150,
  };

  if (!Object.prototype.hasOwnProperty.call(allowed, eventKey)) {
    return res.status(400).json({ error: "Unknown progression event." });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!who.ok) return res.status(401).json({ error: "Invalid session." });

    const user = await who.json();
    const userId = user.id;

    const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/award_club_xp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_user_id: userId,
        p_event_key: eventKey,
        p_xp: allowed[eventKey],
      }),
    });

    const text = await rpc.text();
    if (!rpc.ok) {
      return res.status(500).json({ error: text || "Could not award XP." });
    }

    return res.status(200).json({
      awarded: allowed[eventKey],
      totalXp: Number(text || 0),
      eventKey,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Progression service failed." });
  }
}
