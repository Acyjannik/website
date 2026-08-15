export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(503).json({ error: "Leaderboard service is not configured." });
  }

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: auth }
    });
    if (!who.ok) return res.status(401).json({ error: "Invalid session." });

    const response = await fetch(
      `${url}/rest/v1/profiles?select=id,username,display_name,avatar_url,xp,badges,discord_connected,created_at&order=xp.desc,created_at.asc&limit=100`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store"
      }
    );

    const text = await response.text();
    if (!response.ok) {
      return res.status(500).json({ error: text || "Could not load leaderboard." });
    }

    const rows = text ? JSON.parse(text) : [];
    const members = rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      display_name: row.display_name || row.username,
      avatar_url: row.avatar_url || "",
      xp: Number(row.xp || 0),
      badges: Array.isArray(row.badges) ? row.badges.slice(0, 8) : [],
      discord_connected: !!row.discord_connected,
      created_at: row.created_at
    }));

    return res.status(200).json({ members });
  } catch (error) {
    console.error("club-leaderboard:", error);
    return res.status(500).json({ error: "Leaderboard failed." });
  }
}
