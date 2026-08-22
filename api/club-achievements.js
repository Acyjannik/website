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

  const baseHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  const achievementNames = {
    acy_rookie: "ACY Rookie",
    profile_complete: "Profile Complete",
    discord_member: "Discord Member",
    event_fan: "Event Fan",
    event_hunter: "Event Hunter",
    event_regular: "Event Regular",
    event_legend: "Event Legend",
    xp_100: "100 XP Club",
    xp_500: "500 XP Club",
    xp_1000: "1000 XP Club",
    xp_1500: "1500 XP Club",
    xp_3000: "3000 XP Club",
    xp_6000: "6000 XP Club",
    xp_9000: "9000 XP Club",
    xp_15000: "15000 XP Club",
    xp_20000: "20000 XP Club",
    xp_35000: "35000 XP Club",
    xp_50000: "50000 XP Club",
    xp_75000: "75000 XP Club",
    xp_100000: "100K XP Club",
    xp_150000: "150K XP Club",
    xp_250000: "250K XP Club",
    xp_500000: "500K XP Club",
    xp_750000: "750K XP Club",
    xp_1000000: "1M XP Club",
    acy_og: "ACY OG",
    acy_legend: "ACY Legend",
    early_member: "Early Member",
    veteran_member: "ACY Veteran",
    streak_7: "7-Tage-Serie",
    streak_14: "14-Tage-Serie",
    streak_30: "30-Tage-Serie",
    streak_60: "60-Tage-Serie",
    streak_100: "100-Tage-Serie",
    member_180_days: "Half-Year Club",
    member_365_days: "1 Jahr ACY",
    member_730_days: "2 Jahre ACY",
    event_50: "Event Veteran",
    event_100: "Event Legend",
    game_explorer: "Game Explorer",
    game_hunter: "Game Hunter",
    game_master: "Game Master",
    game_legend: "Game Legend",
    quest_starter: "Quest Starter",
    quest_runner: "Quest Runner",
    quest_master: "Quest Master",
    quest_legend: "Quest Legend",
    quest_mythic: "Quest Mythic"
  };

  function buildRules(profile, counts) {
    const totalXp = Number(profile?.xp || 0);
    const days = Math.max(0, Math.floor((Date.now() - new Date(profile?.created_at).getTime()) / 86400000));
    const eventCount = counts.eventCount;
    const uniqueGames = counts.uniqueGames;
    const questClaimCount = counts.questClaimCount;
    const streak = counts.streak;

    return [
      ["acy_rookie", true],
      ["profile_complete", true],
      ["discord_member", !!profile?.discord_connected],
      ["event_fan", eventCount >= 1],
      ["event_hunter", eventCount >= 5],
      ["event_regular", eventCount >= 10],
      ["event_legend", eventCount >= 25],
      ["event_50", eventCount >= 50],
      ["event_100", eventCount >= 100],
      ["xp_100", totalXp >= 100],
      ["xp_500", totalXp >= 500],
      ["xp_1000", totalXp >= 1000],
      ["xp_1500", totalXp >= 1500],
      ["xp_3000", totalXp >= 3000],
      ["xp_6000", totalXp >= 6000],
      ["xp_9000", totalXp >= 9000],
      ["xp_15000", totalXp >= 15000],
      ["xp_20000", totalXp >= 20000],
      ["xp_35000", totalXp >= 35000],
      ["xp_50000", totalXp >= 50000],
      ["xp_75000", totalXp >= 75000],
      ["xp_100000", totalXp >= 100000],
      ["xp_150000", totalXp >= 150000],
      ["xp_250000", totalXp >= 250000],
      ["xp_500000", totalXp >= 500000],
      ["xp_750000", totalXp >= 750000],
      ["xp_1000000", totalXp >= 1000000],
      ["acy_og", totalXp >= 600],
      ["acy_legend", totalXp >= 1000],
      ["early_member", days >= 30],
      ["veteran_member", days >= 90],
      ["member_180_days", days >= 180],
      ["member_365_days", days >= 365],
      ["member_730_days", days >= 730],
      ["streak_7", streak >= 7],
      ["streak_14", streak >= 14],
      ["streak_30", streak >= 30],
      ["streak_60", streak >= 60],
      ["streak_100", streak >= 100],
      ["game_explorer", uniqueGames >= 5],
      ["game_hunter", uniqueGames >= 15],
      ["game_master", uniqueGames >= 30],
      ["game_legend", uniqueGames >= 75],
      ["quest_starter", questClaimCount >= 1],
      ["quest_runner", questClaimCount >= 10],
      ["quest_master", questClaimCount >= 25],
      ["quest_legend", questClaimCount >= 100],
      ["quest_mythic", questClaimCount >= 250]
    ];
  }

  async function evaluateAndAward(userId, profile, { notify = true } = {}) {
    const cutoff = encodeURIComponent(new Date(Date.now() - 90 * 86400000).toISOString());
    const [attendanceRes, gameLogRes, questRes, streakRes, existingRes] = await Promise.all([
      fetch(`${url}/rest/v1/club_event_attendance?user_id=eq.${encodeURIComponent(userId)}&select=id`, { headers: baseHeaders, cache: "no-store" }),
      fetch(`${url}/rest/v1/club_game_presence_log?user_id=eq.${encodeURIComponent(userId)}&detected_at=gte.${cutoff}&select=game_id`, { headers: baseHeaders, cache: "no-store" }),
      fetch(`${url}/rest/v1/club_quest_progress?user_id=eq.${encodeURIComponent(userId)}&claimed=eq.true&select=quest_key`, { headers: baseHeaders, cache: "no-store" }),
      fetch(`${url}/rest/v1/club_daily_streaks?user_id=eq.${encodeURIComponent(userId)}&select=current_streak&limit=1`, { headers: baseHeaders, cache: "no-store" }),
      fetch(`${url}/rest/v1/club_achievements?user_id=eq.${encodeURIComponent(userId)}&select=achievement_key`, { headers: baseHeaders, cache: "no-store" })
    ]);

    const [attendance, gameLog, questClaims, streakRows, existing] = await Promise.all([
      attendanceRes.ok ? attendanceRes.json() : [],
      gameLogRes.ok ? gameLogRes.json() : [],
      questRes.ok ? questRes.json() : [],
      streakRes.ok ? streakRes.json() : [],
      existingRes.ok ? existingRes.json() : []
    ]);

    const counts = {
      eventCount: Array.isArray(attendance) ? attendance.length : 0,
      uniqueGames: new Set((Array.isArray(gameLog) ? gameLog : []).map(row => row?.game_id).filter(Boolean)).size,
      questClaimCount: Array.isArray(questClaims) ? questClaims.length : 0,
      streak: Number(streakRows?.[0]?.current_streak || 0)
    };

    const rules = buildRules(profile, counts);
    const existingKeys = new Set((Array.isArray(existing) ? existing : []).map(row => row?.achievement_key).filter(Boolean));
    const newlyAwarded = rules
      .filter(([, eligible]) => eligible)
      .map(([achievementKey]) => achievementKey)
      .filter(achievementKey => !existingKeys.has(achievementKey));

    if (!newlyAwarded.length) {
      return { achievements: rules.filter(([, eligible]) => eligible).map(([keyName]) => keyName), newlyAwarded: [] };
    }

    const insertRes = await fetch(`${url}/rest/v1/club_achievements`, {
      method: "POST",
      headers: {
        ...baseHeaders,
        Prefer: "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify(newlyAwarded.map(achievement_key => ({ user_id: userId, achievement_key })))
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      throw new Error(text || "Could not save achievements.");
    }

    if (notify) {
      const notifications = newlyAwarded.map(achievementKey => ({
        user_id: userId,
        title: "Neues Achievement! 🏆",
        body: `Du hast „${achievementNames[achievementKey] || achievementKey}“ freigeschaltet.`,
        notification_type: "badge",
        link_url: "/club-profile.html"
      }));

      const notificationRes = await fetch(`${url}/rest/v1/club_notifications`, {
        method: "POST",
        headers: { ...baseHeaders, Prefer: "return=minimal" },
        body: JSON.stringify(notifications)
      });
      if (!notificationRes.ok) {
        console.warn("club-achievements: notification insert failed", await notificationRes.text());
      }
    }

    return {
      achievements: rules.filter(([, eligible]) => eligible).map(([keyName]) => keyName),
      newlyAwarded
    };
  }

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: auth },
      cache: "no-store"
    });
    if (!who.ok) return res.status(401).json({ error: "Invalid session." });

    const user = await who.json();
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (body.all === true) {
      const adminCheck = await fetch(
        `${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
        { headers: baseHeaders, cache: "no-store" }
      );
      const admins = adminCheck.ok ? await adminCheck.json() : [];
      if (!admins.length) return res.status(403).json({ error: "Admin access required." });

      const profilesRes = await fetch(
        `${url}/rest/v1/profiles?select=id,xp,created_at,discord_connected,display_name,username&limit=500`,
        { headers: baseHeaders, cache: "no-store" }
      );
      if (!profilesRes.ok) return res.status(500).json({ error: await profilesRes.text() || "Could not load profiles." });
      const profiles = await profilesRes.json();

      let cursor = 0;
      let updated = 0;
      const concurrency = 8;
      async function worker() {
        while (cursor < profiles.length) {
          const profile = profiles[cursor++];
          try {
            const result = await evaluateAndAward(profile.id, profile, { notify: false });
            if (result.newlyAwarded.length) updated++;
          } catch (error) {
            console.warn("club-achievements admin refresh failed for", profile.id, error);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, profiles.length) }, worker));
      return res.status(200).json({ updated });
    }

    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,xp,created_at,discord_connected`,
      { headers: baseHeaders, cache: "no-store" }
    );
    if (!profileRes.ok) throw new Error(await profileRes.text());
    const profiles = await profileRes.json();
    const profile = profiles?.[0];
    if (!profile) return res.status(404).json({ error: "Profile not found." });

    const result = await evaluateAndAward(user.id, profile, { notify: true });
    return res.status(200).json(result);
  } catch (error) {
    console.error("club-achievements:", error);
    return res.status(500).json({ error: "Achievement check failed." });
  }
}
