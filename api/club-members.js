export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "Member service is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  try {
    const meResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!meResponse.ok) {
      return res.status(401).json({ error: "Invalid session." });
    }

    const memberId = String(req.query?.id || "").trim();

    if (memberId) {
      if (!/^[0-9a-f-]{36}$/i.test(memberId)) {
        return res.status(400).json({ error: "Invalid member id" });
      }

      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=id,username,display_name,bio,avatar_url,created_at,xp,badges,discord_connected&id=eq.${encodeURIComponent(memberId)}&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          cache: "no-store",
        }
      );

      const profileText = await profileResponse.text();
      if (!profileResponse.ok) {
        return res.status(500).json({ error: profileText || "Could not load member." });
      }

      const rows = profileText ? JSON.parse(profileText) : [];
      if (!rows.length) {
        return res.status(404).json({ error: "Member not found." });
      }

      const p = rows[0];
      return res.status(200).json({
        member: {
          id: p.id,
          username: p.username,
          display_name: p.display_name || p.username,
          bio: p.bio || "",
          avatar_url: p.avatar_url || "",
          created_at: p.created_at,
          xp: Number(p.xp || 0),
          badges: Array.isArray(p.badges) ? p.badges.slice(0, 8) : [],
          discord_connected: !!p.discord_connected,
        },
      });
    }

    const params = new URLSearchParams({
      select: "id,username,display_name,bio,avatar_url,created_at,xp,badges",
      order: "created_at.asc",
      limit: "100",
    });

    const search = String(req.query?.search || "").trim();
    if (search) {
      const safe = search.replace(/[%(),]/g, " ").slice(0, 40);
      params.set("or", `(username.ilike.*${safe}*,display_name.ilike.*${safe}*)`);
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?${params.toString()}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(500).json({ error: text || "Could not load members." });
    }

    const rows = text ? JSON.parse(text) : [];
    const memberRows = rows.map((row) => ({
      id: row.id,
      username: row.username,
      display_name: row.display_name || row.username,
      bio: row.bio || "",
      avatar_url: row.avatar_url || "",
      created_at: row.created_at,
      xp: Number(row.xp || 0),
      badges: Array.isArray(row.badges) ? row.badges.slice(0, 8) : [],
    }));

    return res.status(200).json({
      members: memberRows,
      count: memberRows.length,
    });
  } catch (error) {
    console.error("club-members:", error);
    return res.status(500).json({ error: "Member service failed." });
  }
}
