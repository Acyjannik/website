export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Notification service is not configured." });

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: auth }
    });
    if (!who.ok) return res.status(401).json({ error: "Invalid session." });
    const user = await who.json();

    const response = await fetch(
      `${url}/rest/v1/club_notifications?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=30`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    const text = await response.text();
    if (!response.ok) return res.status(500).json({ error: text || "Could not load notifications." });

    return res.status(200).json({ notifications: text ? JSON.parse(text) : [] });
  } catch (error) {
    console.error("club-notifications:", error);
    return res.status(500).json({ error: "Notification service failed." });
  }
}
