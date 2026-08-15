export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Spotlight service is not configured." });

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  try {
    // Admin can set or clear the active spotlight without adding another Vercel function.
    if (req.method === "POST") {
      const auth = req.headers.authorization || "";
      if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

      const who = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: auth }
      });
      if (!who.ok) return res.status(401).json({ error: "Invalid session." });
      const user = await who.json();

      const adminCheck = await fetch(
        `${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
      );
      const admins = adminCheck.ok ? await adminCheck.json() : [];
      if (!admins.length) return res.status(403).json({ error: "Admin access required." });

      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const memberId = String(body.userId || "").trim();
      const note = String(body.note || "").trim().slice(0, 500);
      const action = body.action === "clear" ? "clear" : "set";

      if (action === "clear") {
        const cleared = await fetch(`${url}/rest/v1/club_spotlight?enabled=eq.true`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ enabled: false })
        });
        if (!cleared.ok) return res.status(500).json({ error: await cleared.text() || "Could not clear spotlight." });
        return res.status(200).json({ success: true, spotlight: null });
      }

      if (!/^[0-9a-f-]{36}$/i.test(memberId)) {
        return res.status(400).json({ error: "Valid member id required." });
      }

      const profileCheck = await fetch(
        `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(memberId)}&select=id,username,display_name,bio,avatar_url,xp,badges&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
      );
      const profiles = profileCheck.ok ? await profileCheck.json() : [];
      if (!profiles.length) return res.status(404).json({ error: "Member not found." });

      // The table uses a unique month_key, so update this month's row instead of
      // inserting a second row. This also makes replacing the winner deterministic.
      const monthKey = new Date().toISOString().slice(0, 7);

      await fetch(`${url}/rest/v1/club_spotlight?month_key=eq.${encodeURIComponent(monthKey)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() })
      });

      const existing = await fetch(
        `${url}/rest/v1/club_spotlight?month_key=eq.${encodeURIComponent(monthKey)}&select=id&limit=1`,
        { headers, cache: "no-store" }
      );
      const existingText = await existing.text();
      if (!existing.ok) return res.status(500).json({ error: existingText || "Could not check current spotlight." });
      const existingRows = existingText ? JSON.parse(existingText) : [];

      let saveResponse;
      if (existingRows.length) {
        saveResponse = await fetch(
          `${url}/rest/v1/club_spotlight?id=eq.${existingRows[0].id}`,
          {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=representation" },
            body: JSON.stringify({
              user_id: memberId,
              title: "ACY Member of the Month",
              blurb: note,
              month_key: monthKey,
              enabled: true,
              updated_at: new Date().toISOString()
            })
          }
        );
      } else {
        saveResponse = await fetch(`${url}/rest/v1/club_spotlight`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: memberId,
            title: "ACY Member of the Month",
            blurb: note,
            month_key: monthKey,
            enabled: true
          })
        });
      }

      const text = await saveResponse.text();
      if (!saveResponse.ok) return res.status(500).json({ error: text || "Could not save spotlight." });

      // Notify the selected member.
      await fetch(`${url}/rest/v1/club_notifications`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: memberId,
          title: "Du bist Member of the Month! 👑",
          body: note || "Du wurdest zum ACY Member of the Month gewählt.",
          notification_type: "spotlight",
          link_url: "/club-profile.html"
        })
      });

      return res.status(200).json({ success: true, spotlight: text ? JSON.parse(text)[0] : null });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

    const response = await fetch(
      `${url}/rest/v1/club_spotlight?enabled=eq.true&select=*&order=created_at.desc&limit=1`,
      { headers, cache: "no-store" }
    );
    const text = await response.text();
    if (!response.ok) {
      return res.status(500).json({ error: text || "Could not load spotlight. Prüfe, ob die Tabelle club_spotlight in Supabase existiert." });
    }

    const rows = text ? JSON.parse(text) : [];
    if (!rows.length) return res.status(200).json({ spotlight: null });

    const item = rows[0];
    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(item.user_id)}&select=id,username,display_name,bio,avatar_url,xp,badges,discord_connected,created_at&limit=1`,
      { headers, cache: "no-store" }
    );
    const profileText = await profileResponse.text();
    if (!profileResponse.ok) return res.status(500).json({ error: profileText || "Could not load spotlight member." });

    const profiles = profileText ? JSON.parse(profileText) : [];
    if (!profiles.length) return res.status(404).json({ error: "Spotlight member not found." });

    return res.status(200).json({ spotlight: { ...item, note: item.blurb || "", member: profiles[0] } });
  } catch (error) {
    console.error("club-spotlight:", error);
    return res.status(500).json({ error: "Spotlight service failed." });
  }
}
