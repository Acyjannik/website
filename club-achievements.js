export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Achievement service is not configured." });

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: auth }
    });
    if (!who.ok) return res.status(401).json({ error: "Invalid session." });

    const user = await who.json();
    const userId = user.id;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=id,xp,badges,created_at,discord_connected`,
      { headers, cache: "no-store" }
    );
    const profileText = await profileRes.text();
    if (!profileRes.ok) throw new Error(profileText);
    const profileRows = profileText ? JSON.parse(profileText) : [];
    const profile = profileRows[0];
    if (!profile) return res.status(404).json({ error: "Profile not found." });

    const [attendanceRes, xpRes] = await Promise.all([
      fetch(`${url}/rest/v1/club_event_attendance?user_id=eq.${userId}&select=id`, { headers }),
      fetch(`${url}/rest/v1/club_xp_events?user_id=eq.${userId}&select=event_key,xp`, { headers })
    ]);

    const attendanceText = await attendanceRes.text();
    const xpText = await xpRes.text();
    const attendance = attendanceText ? JSON.parse(attendanceText) : [];
    const xpEvents = xpText ? JSON.parse(xpText) : [];

    const days = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
    const rules = [
      ["acy_rookie", true],
      ["discord_member", !!profile.discord_connected],
      ["event_hunter", attendance.length >= 5],
      ["event_fan", attendance.length >= 1],
      ["acy_og", Number(profile.xp || 0) >= 500],
      ["acy_legend", Number(profile.xp || 0) >= 1000],
      ["early_member", days >= 30]
    ];

    const newlyAwarded = [];
    for (const [keyName, eligible] of rules) {
      if (!eligible) continue;

      const check = await fetch(
        `${url}/rest/v1/club_achievements?user_id=eq.${userId}&achievement_key=eq.${encodeURIComponent(keyName)}&select=id&limit=1`,
        { headers }
      );
      const existingText = await check.text();
      const existing = existingText ? JSON.parse(existingText) : [];
      if (existing.length) continue;

      const insert = await fetch(`${url}/rest/v1/club_achievements`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId, achievement_key: keyName })
      });
      if (insert.ok) newlyAwarded.push(keyName);
    }

    const badgeNames = {
      acy_rookie: "ACY Rookie",
      discord_member: "Discord Member",
      event_hunter: "Event Hunter",
      event_fan: "Event Fan",
      acy_og: "ACY OG",
      acy_legend: "ACY Legend",
      early_member: "Early Member"
    };

    for (const keyName of newlyAwarded) {
      const badgeName = badgeNames[keyName] || keyName;
      await fetch(`${url}/rest/v1/club_notifications`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: userId,
          title: "Neues Achievement! 🏆",
          body: `Du hast „${badgeName}“ freigeschaltet.`,
          notification_type: "badge",
          link_url: "/club-profile.html"
        })
      });
    }

    return res.status(200).json({
      achievements: rules.filter(([, eligible]) => eligible).map(([keyName]) => keyName),
      newlyAwarded
    });
  } catch (error) {
    console.error("club-achievements:", error);
    return res.status(500).json({ error: "Achievement check failed." });
  }
}
