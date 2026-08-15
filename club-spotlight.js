export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Spotlight service is not configured." });

  try {
    const response = await fetch(
      `${url}/rest/v1/club_spotlight?enabled=eq.true&select=*&order=created_at.desc&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    const text = await response.text();
    if (!response.ok) return res.status(500).json({ error: text || "Could not load spotlight." });

    const rows = text ? JSON.parse(text) : [];
    if (!rows.length) return res.status(200).json({ spotlight: null });

    const item = rows[0];
    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?id=eq.${item.user_id}&select=id,username,display_name,bio,avatar_url,xp,badges,discord_connected,created_at&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    const profileText = await profileResponse.text();
    if (!profileResponse.ok) return res.status(500).json({ error: profileText || "Could not load spotlight member." });

    const profiles = profileText ? JSON.parse(profileText) : [];
    if (!profiles.length) return res.status(404).json({ error: "Spotlight member not found." });

    return res.status(200).json({ spotlight: { ...item, member: profiles[0] } });
  } catch (error) {
    console.error("club-spotlight:", error);
    return res.status(500).json({ error: "Spotlight service failed." });
  }
}
