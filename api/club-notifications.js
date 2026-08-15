export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return res.status(503).json({ error: "Service is not configured." });
  }

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Validate the caller with the token they received from Supabase Auth.
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: auth,
      },
    });

    if (!who.ok) {
      return res.status(401).json({ error: "Invalid session." });
    }

    const user = await who.json();
    const action = new URL(req.url, "http://localhost").searchParams.get("action");

    if (req.method === "POST" && action === "delete_account") {
      // auth.users is the parent row for the Club data. The Club tables use
      // ON DELETE CASCADE, so removing the Auth user removes its profile,
      // XP events, achievements, event attendance, notifications, etc.
      const deletion = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      });

      const deletionText = await deletion.text();

      if (!deletion.ok) {
        let detail = deletionText;
        try {
          const parsed = JSON.parse(deletionText);
          detail = parsed.msg || parsed.message || parsed.error || deletionText;
        } catch (_) {}
        return res.status(502).json({
          error: detail || "Auth account deletion failed.",
        });
      }

      return res.status(200).json({ deleted: true });
    }

    if (req.method === "POST" && action === "mark_all_read") {
      const r = await fetch(
        `${url}/rest/v1/club_notifications?user_id=eq.${encodeURIComponent(user.id)}&read_at=is.null`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ read_at: new Date().toISOString() }),
        }
      );

      if (!r.ok) {
        return res.status(500).json({ error: "Could not mark notifications as read." });
      }

      return res.status(200).json({ markedRead: true });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed." });
    }

    const r = await fetch(
      `${url}/rest/v1/club_notifications?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc&limit=30`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      }
    );

    const text = await r.text();

    if (!r.ok) {
      return res.status(500).json({
        error: text || "Could not load notifications.",
      });
    }

    let notifications = [];
    try {
      notifications = text ? JSON.parse(text) : [];
    } catch (_) {
      return res.status(502).json({
        error: "Notification service returned invalid JSON.",
      });
    }

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("club-notifications:", error);
    return res.status(500).json({
      error: "Notification service failed.",
    });
  }
}
