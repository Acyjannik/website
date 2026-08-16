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



  async function loadPresenceForUserIds(ids) {
    const clean=[...new Set((ids||[]).filter(Boolean))];
    if(!clean.length)return new Map();
    const r=await fetch(`${supabaseUrl}/rest/v1/club_game_presence?select=user_id,game_id,updated_at&user_id=in.(${clean.map(encodeURIComponent).join(",")})`,{
      headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"
    });
    if(!r.ok)return new Map();
    const rows=await r.json();
    const gameIds=[...new Set((rows||[]).map(row=>row.game_id).filter(Boolean))];
    const games=new Map();
    if(gameIds.length){
      const gr=await fetch(`${supabaseUrl}/rest/v1/games?select=id,name&id=in.(${gameIds.map(encodeURIComponent).join(",")})`,{
        headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"
      });
      if(gr.ok){
        const gs=await gr.json();
        (gs||[]).forEach(g=>games.set(g.id,g.name));
      }
    }
    return new Map((rows||[]).map(row=>[row.user_id,{
      online:new Date(row.updated_at).getTime()>Date.now()-5*60*1000,
      game_name:games.get(row.game_id)||'',
      updated_at:row.updated_at
    }]));
  }


  async function loadOnlinePresenceForUserIds(ids) {
    const clean=[...new Set((ids||[]).filter(Boolean))];
    if(!clean.length)return new Map();

    const r=await fetch(`${supabaseUrl}/rest/v1/club_online_presence?select=user_id,updated_at&user_id=in.(${clean.map(encodeURIComponent).join(",")})`,{
      headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},
      cache:"no-store"
    });
    if(!r.ok)return new Map();
    const rows=await r.json();

    return new Map((rows||[]).map(row=>[row.user_id,{
      online:new Date(row.updated_at).getTime()>Date.now()-5*60*1000,
      updated_at:row.updated_at
    }]));
  }

  async function loadPetsForUserIds(ids) {
    const clean = [...new Set((ids || []).filter(Boolean))];
    if (!clean.length) return new Map();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/club_pets?select=user_id,species,name,pet_xp,social_xp,hunger,happiness,energy&user_id=in.(${clean.map(encodeURIComponent).join(",")})`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) return new Map();
    const rows = await response.json();
    return new Map((rows || []).map(row => [row.user_id, row]));
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
      const pets = await loadPetsForUserIds([p.id]);
      const presence = await loadPresenceForUserIds([p.id]);
      const onlinePresence = await loadOnlinePresenceForUserIds([p.id]);
      const pet = pets.get(p.id) || null;
      const livePresence = presence.get(p.id) || null;
      const onlineState = onlinePresence.get(p.id) || null;

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
          online: Boolean(onlineState?.online),
          game_name: livePresence?.game_name || '',
          last_seen: livePresence?.updated_at || null,
          pet: pet ? {
            species: pet.species,
            name: pet.name,
            pet_xp: Number(pet.pet_xp || 0),
            social_xp: Number(pet.social_xp || 0),
            hunger: Number(pet.hunger ?? 100),
            happiness: Number(pet.happiness ?? 100),
            energy: Number(pet.energy ?? 100),
          } : null,
        },
      });
    }

    const params = new URLSearchParams({
      select: "id,username,display_name,bio,avatar_url,created_at,xp,badges",
      order: "created_at.asc",
      limit: "100",
    });

    const includeAchievements = String(req.query?.includeAchievements || "").toLowerCase() === "true";
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
    let achievementMap = new Map();

    if (includeAchievements && rows.length) {
      const achievementsResponse = await fetch(
        `${supabaseUrl}/rest/v1/club_achievements?select=user_id,achievement_key&user_id=in.(${rows.map(r => encodeURIComponent(r.id)).join(",")})`,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          cache: "no-store",
        }
      );
      const achievementText = await achievementsResponse.text();
      if (achievementsResponse.ok) {
        const achievementRows = achievementText ? JSON.parse(achievementText) : [];
        achievementMap = new Map();
        for (const item of achievementRows) {
          if (!achievementMap.has(item.user_id)) achievementMap.set(item.user_id, []);
          achievementMap.get(item.user_id).push(item.achievement_key);
        }
      }
    }

    const pets = await loadPetsForUserIds(rows.map(row => row.id));
    const presence = await loadPresenceForUserIds(rows.map(row => row.id));
    const onlinePresence = await loadOnlinePresenceForUserIds(rows.map(row => row.id));

    const memberRows = rows.map((row) => ({
      id: row.id,
      username: row.username,
      display_name: row.display_name || row.username,
      bio: row.bio || "",
      avatar_url: row.avatar_url || "",
      created_at: row.created_at,
      xp: Number(row.xp || 0),
      badges: Array.isArray(row.badges) ? row.badges.slice(0, 8) : [],
      achievements: achievementMap.get(row.id) || [],
      online: Boolean(onlinePresence.get(row.id)?.online),
      game_name: presence.get(row.id)?.game_name || '',
      last_seen: onlinePresence.get(row.id)?.updated_at || presence.get(row.id)?.updated_at || null,
      pet: pets.get(row.id) ? {
        species: pets.get(row.id).species,
        name: pets.get(row.id).name,
        pet_xp: Number(pets.get(row.id).pet_xp || 0),
        social_xp: Number(pets.get(row.id).social_xp || 0),
        hunger: Number(pets.get(row.id).hunger ?? 100),
        happiness: Number(pets.get(row.id).happiness ?? 100),
        energy: Number(pets.get(row.id).energy ?? 100),
      } : null,
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
