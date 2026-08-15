function xpLevel(xp) {
  const thresholds = [0, 100, 250, 500, 1000, 2000];
  let level = 1;
  for (const threshold of thresholds) if (xp >= threshold) level++;
  return Math.min(level, thresholds.length);
}

function notificationForProgress(eventKey, xp) {
  const map = {
    registration: ["Willkommen im ACY Club! 💜", "Dein Club-Account ist eingerichtet. Du hast 50 XP erhalten.", "general"],
    profile_complete: ["Profil vervollständigt ✨", `Dein Profil ist komplett. +${xp} XP`, "profile"],
    avatar_added: ["Neues Profilbild ✨", `Dein Profilbild ist gespeichert. +${xp} XP`, "profile"],
    discord_connected: ["Discord verbunden 💬", `Dein Discord-Konto ist jetzt mit dem ACY Club verbunden. +${xp} XP`, "discord"],
    event_attended: ["Event-Teilnahme 🎮", `Danke fürs Mitmachen! +${xp} XP`, "event"],
    member_7_days: ["Eine Woche ACY Club! 🎉", `Du bist seit 7 Tagen dabei. +${xp} XP`, "general"],
    member_30_days: ["30 Tage ACY Club! 🎉", `Du bist seit einem Monat dabei. +${xp} XP`, "general"]
  };
  const [title, body, type] = map[eventKey] || ["Neue XP erhalten", `Du hast +${xp} XP erhalten.`, "general"];
  return { title, body, type };
}

async function createNotification(base, headers, payload) {
  try {
    const response = await fetch(`${base}/rest/v1/club_notifications`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.warn("Notification insert failed:", await response.text());
  } catch (error) {
    console.warn("Notification insert failed:", error);
  }
}

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

    // Check whether this progression event was already awarded. This keeps
    // notifications one-shot even when the member page initializes twice.
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/club_xp_events?user_id=eq.${userId}&event_key=eq.${encodeURIComponent(eventKey)}&select=id&limit=1`,
      { headers, cache: "no-store" }
    );
    const existingText = await existingRes.text();
    const alreadyAwarded = existingRes.ok && existingText && JSON.parse(existingText).length > 0;

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

    const totalXp = Number(text || 0);

    if (!alreadyAwarded) {
      const level = xpLevel(totalXp);
      const previousLevel = xpLevel(Math.max(0, totalXp - allowed[eventKey]));
      const notification = notificationForProgress(eventKey, allowed[eventKey]);

      await createNotification(supabaseUrl, headers, {
        user_id: userId,
        title: notification.title,
        body: notification.body,
        notification_type: notification.type,
        link_url: notification.link || "/club-profile.html",
      });

      if (level > previousLevel) {
        await createNotification(supabaseUrl, headers, {
          user_id: userId,
          title: `Level ${level} erreicht!`,
          body: `Glückwunsch! Du bist jetzt Level ${level}.`,
          notification_type: "level",
          link_url: "/club-profile.html",
        });
      }
    }

    return res.status(200).json({
      awarded: alreadyAwarded ? 0 : allowed[eventKey],
      totalXp,
      eventKey,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Progression service failed." });
  }
}
