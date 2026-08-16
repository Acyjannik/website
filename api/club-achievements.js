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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const runForAll = body.all === true;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    if (runForAll) {
      const adminCheck = await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, { headers, cache: 'no-store' });
      const admins = adminCheck.ok ? await adminCheck.json() : [];
      if (!admins.length) return res.status(403).json({ error: 'Admin access required.' });

      const profilesResponse = await fetch(`${url}/rest/v1/profiles?select=id,xp,badges,created_at,discord_connected&limit=500`, { headers, cache: 'no-store' });
      const profilesText = await profilesResponse.text();
      if (!profilesResponse.ok) return res.status(500).json({ error: profilesText || 'Could not load profiles.' });
      const profiles = profilesText ? JSON.parse(profilesText) : [];
      let updated = 0;

      for (const profile of profiles) {
        const [attendanceRes] = await Promise.all([
          fetch(`${url}/rest/v1/club_event_attendance?user_id=eq.${profile.id}&select=id`, { headers })
        ]);
        const attendanceText = await attendanceRes.text();
        const attendance = attendanceText ? JSON.parse(attendanceText) : [];
        const days = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
        const totalXp = Number(profile.xp || 0);
        const rules = [
          ['acy_rookie', true], ['profile_complete', true], ['discord_member', !!profile.discord_connected],
          ['event_fan', attendance.length >= 1], ['event_hunter', attendance.length >= 5], ['event_regular', attendance.length >= 10], ['event_legend', attendance.length >= 25],
          ['xp_100', totalXp >= 100], ['xp_500', totalXp >= 500], ['xp_1000', totalXp >= 1000], ['acy_og', totalXp >= 500], ['acy_legend', totalXp >= 1000],
          ['early_member', days >= 30], ['veteran_member', days >= 90]
        ];
        let changed = false;
        for (const [keyName, eligible] of rules) {
          if (!eligible) continue;
          const check = await fetch(`${url}/rest/v1/club_achievements?user_id=eq.${profile.id}&achievement_key=eq.${encodeURIComponent(keyName)}&select=id&limit=1`, { headers });
          const existingText = await check.text();
          const existing = existingText ? JSON.parse(existingText) : [];
          if (existing.length) continue;
          const insert = await fetch(`${url}/rest/v1/club_achievements`, { method: 'POST', headers, body: JSON.stringify({ user_id: profile.id, achievement_key: keyName }) });
          if (insert.ok) {
          changed = true;
          try {
            const siteSecret = process.env.CLUB_EVENT_HUB_SECRET || '';
            if (siteSecret) {
              const displayName = profile.display_name || profile.username || 'Ein Mitglied';
              await fetch(`${process.env.PUBLIC_SITE_URL || ''}/api/club-event-hub`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  internalSecret: siteSecret,
                  eventType: 'achievement_unlocked',
                  title: 'Neues Achievement',
                  payload: {
                    message: `🏆 ${displayName} hat gerade das Achievement „${keyName}“ freigeschaltet!`,
                    userId: profile.id,
                    achievementKey: keyName
                  }
                })
              }).catch(() => {});
            }
          } catch {}
        }
        }
        if (changed) updated++;
      }
      return res.status(200).json({ updated });
    }

    const userId = user.id;
    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=id,xp,badges,created_at,discord_connected`,
      { headers, cache: "no-store" }
    );
    const profileText = await profileRes.text();
    if (!profileRes.ok) throw new Error(profileText);
    const profileRows = profileText ? JSON.parse(profileText) : [];
    const profile = profileRows[0];
    if (!profile) return res.status(404).json({ error: "Profile not found." });

    const [attendanceRes, xpRes, gameLogRes, questRes, streakRes] = await Promise.all([
      fetch(`${url}/rest/v1/club_event_attendance?user_id=eq.${userId}&select=id`, { headers }),
      fetch(`${url}/rest/v1/club_xp_events?user_id=eq.${userId}&select=event_key,xp`, { headers }),
      fetch(`${url}/rest/v1/club_game_presence_log?user_id=eq.${userId}&detected_at=gte.${encodeURIComponent(new Date(Date.now()-90*86400000).toISOString())}&select=game_id`, { headers }),
      fetch(`${url}/rest/v1/club_quest_progress?user_id=eq.${userId}&claimed=eq.true&select=quest_key`, { headers }),
      fetch(`${url}/rest/v1/club_daily_streaks?user_id=eq.${userId}&select=current_streak&limit=1`, { headers })
    ]);

    const attendanceText = await attendanceRes.text();
    const xpText = await xpRes.text();
    const gameLogText = await gameLogRes.text();
    const questText = await questRes.text();
    const streakRows = streakRes.ok ? await streakRes.json() : [];
    const streak = Number(streakRows?.[0]?.current_streak || 0);
    const attendance = attendanceText ? JSON.parse(attendanceText) : [];
    const xpEvents = xpText ? JSON.parse(xpText) : [];
    const gameLog = gameLogText ? JSON.parse(gameLogText) : [];
    const questClaims = questText ? JSON.parse(questText) : [];
    const uniqueGames = new Set((gameLog || []).map(row => row.game_id).filter(Boolean)).size;
    const questClaimCount = (questClaims || []).length;

    const days = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
    const eventCount = attendance.length;
    const totalXp = Number(profile.xp || 0);
    const rules = [
      ["acy_rookie", true],
      ["profile_complete", true],
      ["discord_member", !!profile.discord_connected],
      ["event_fan", eventCount >= 1],
      ["event_hunter", eventCount >= 5],
      ["event_regular", eventCount >= 10],
      ["event_legend", eventCount >= 25],
      ["xp_100", totalXp >= 100],
      ["xp_500", totalXp >= 500],
      ["xp_1000", totalXp >= 1000],
      ["xp_2000", totalXp >= 2000],
      ["xp_5000", totalXp >= 5000],
      ["xp_10000", totalXp >= 10000],
      ["xp_25000", totalXp >= 25000],
      ["acy_og", totalXp >= 500],
      ["acy_legend", totalXp >= 1000],
      ["early_member", days >= 30],
      ["veteran_member", days >= 90],
      ["member_180_days", days >= 180],
      ["member_365_days", days >= 365],
      ["game_explorer", uniqueGames >= 5],
      ["game_hunter", uniqueGames >= 15],
      ["quest_starter", questClaimCount >= 1],
      ["quest_runner", questClaimCount >= 10],
      ["quest_master", questClaimCount >= 25]
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
      profile_complete: "Profile Complete",
      discord_member: "Discord Member",
      event_fan: "Event Fan",
      event_hunter: "Event Hunter",
      event_regular: "Event Regular",
      event_legend: "Event Legend",
      xp_100: "100 XP Club",
      xp_500: "500 XP Club",
      xp_1000: "1000 XP Club",
      xp_2000: "2000 XP Club",
      xp_5000: "5000 XP Club",
      xp_10000: "10000 XP Club",
      xp_25000: "25000 XP Club",
      acy_og: "ACY OG",
      acy_legend: "ACY Legend",
      early_member: "Early Member",
      veteran_member: "ACY Veteran",
      streak_7: "7-Tage-Serie", streak_14: "14-Tage-Serie", streak_30: "30-Tage-Serie", streak_60: "60-Tage-Serie", streak_100: "100-Tage-Serie",
      member_180_days: "Half-Year Club",
      member_365_days: "1 Jahr ACY",
      game_explorer: "Game Explorer",
      game_hunter: "Game Hunter",
      quest_starter: "Quest Starter",
      quest_runner: "Quest Runner",
      quest_master: "Quest Master"
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
