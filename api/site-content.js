export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const fallback = {
    settings: {
      hero_kicker: "GAMING · STREAMING · COMMUNITY",
      hero_title: "ACYJANNIK",
      hero_description: "Willkommen im digitalen Zuhause von Acyjannik. Streams, Games und der ACY Club an einem Ort.",
      about_text: "Gaming, Streaming und eine Community, die weit über einen Stream hinausgeht.",
      community_text: "Mehr als nur ein Chat. Die Community rund um Acyjannik, zusammengebracht an einem Ort.",
      hero_image_url: "/assets/acyjannik-hero.png",
    },
    socials: [
      { platform: "twitch", label: "Twitch", url: "https://www.twitch.tv/acyjannik", enabled: true, sort_order: 1 },
      { platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@acyjannik", enabled: true, sort_order: 2 },
      { platform: "whatsapp", label: "WhatsApp", url: "https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10", enabled: true, sort_order: 3 },
    ],
    games: [
      { name: "Fortnite", description: "Main Game · Ranked · Community", tag: "MAIN GAME", image_url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Fortnite_at_E3_2018_(42719678112).jpg", featured: true, sort_order: 1, enabled: true },
      { name: "GTA V", description: "Open World · Aktuell · Fun", tag: "AKTUELL", image_url: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg", featured: false, sort_order: 2, enabled: true },
      { name: "Meccha Chameleon", description: "Variety · Hide & Seek · Community", tag: "VARIETY", image_url: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/4704690/header.jpg", featured: false, sort_order: 3, enabled: true },
      { name: "Thick As Thieves", description: "Stealth · Heist · Community", tag: "VARIETY", image_url: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg", featured: false, sort_order: 4, enabled: true },
    ],
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return res.status(200).json({ configured: false, ...fallback, source: "fallback" });
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
    if (!response.ok) throw new Error(`${response.status}: ${text}`);
    return text ? JSON.parse(text) : [];
  }

  try {
    const [settingsRows, socialsRows, gamesRows] = await Promise.all([
      fetchRows("site_settings?select=*&id=eq.true&limit=1"),
      fetchRows("social_links?select=*&enabled=eq.true&order=sort_order.asc"),
      fetchRows("games?select=*&enabled=eq.true&order=sort_order.asc"),
    ]);

    const settings = { ...fallback.settings, ...(settingsRows[0] || {}) };
    const socials = socialsRows.length ? socialsRows : fallback.socials;
    const games = gamesRows
      .filter((game) => !/meccha/i.test(String(game.name || '')))
      .length
      ? gamesRows.filter((game) => !/meccha/i.test(String(game.name || '')))
      : fallback.games;

    // Canonical artwork for the four current ACYJANNIK games.
    // This intentionally overrides legacy/placeholder image_url values stored in Supabase.
    const canonicalCovers = {
      "Fortnite": "https://cdn.startselect.com/production/blog/preview-images/new-fortnite-season.jpg",
      "GTA V": "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg",
      "Thick As Thieves": "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg",
    };

    const normalizedGames = games.map((game) => ({
      ...game,
      image_url: canonicalCovers[game.name] || game.image_url || null,
    }));

    // Prevent accidental disappearance of the required current games.
    const required = new Map(fallback.games.map(g => [g.name, g]));
    const mergedGames = normalizedGames.filter((game) => !/meccha/i.test(String(game.name || '')));
    for (const fallbackGame of fallback.games) {
      if (!mergedGames.some(g => g.name === fallbackGame.name)) {
        mergedGames.push(fallbackGame);
      }
    }
    mergedGames.sort((a,b) => (Number(a.sort_order)||999) - (Number(b.sort_order)||999));

    return res.status(200).json({
      configured: true,
      source: (settingsRows.length || socialsRows.length || gamesRows.length) ? "supabase+fallback" : "fallback",
      settings,
      socials,
      games: mergedGames,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("site-content error:", error);
    return res.status(200).json({
      configured: true,
      source: "fallback-error",
      error: "Supabase read failed; fallback content used.",
      ...fallback,
    });
  }
}
