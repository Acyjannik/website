export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return res.status(503).json({
      configured: false,
      error: "Supabase is not configured in Vercel."
    });
  }

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  async function fetchRows(path) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status}: ${text}`);
    }
    return text ? JSON.parse(text) : [];
  }

  try {
    const [settings, socials, games] = await Promise.all([
      fetchRows("site_settings?select=*&id=eq.true&limit=1"),
      fetchRows("social_links?select=*&enabled=eq.true&order=sort_order.asc"),
      fetchRows("games?select=*&enabled=eq.true&order=sort_order.asc"),
    ]);

    return res.status(200).json({
      configured: true,
      settings: settings[0] || null,
      socials,
      games,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("site-content error:", error);
    return res.status(500).json({
      configured: true,
      error: "Unable to load public site content.",
    });
  }
}
