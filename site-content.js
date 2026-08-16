export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const fallback = {
    settings: {
      hero_kicker: "GAMING · STREAMING · COMMUNITY",
      hero_title: "ACYJANNIK",
      hero_description: "Willkommen im digitalen Zuhause von Acyjannik. Streams, Games und der ACY Club an einem Ort.",
      about_text: 'Hi, ich bin Jannik! 💜\\nIch bin 24 Jahre alt und streame seit Januar 2024. Angefangen hat alles auf TikTok, mittlerweile gibt es meine Streams auch hier auf Twitch.\\n\\nBei mir dreht sich vieles um Fortnite, Horror-Games und alles, was gerade Spaß macht. Mal entspannt, mal komplett chaotisch und manchmal vermutlich etwas fragwürdig. 😅\\n\\nWas mir aber genauso wichtig ist wie die Games, ist die Community. Für mich soll der Stream ein Ort sein, an dem man gerne vorbeikommt, zusammen lacht, quatscht, neue Leute kennenlernt und einfach eine gute Zeit hat.\\n\\nGenau deshalb gibt es auch den ACY Club: ein Ort, an dem die Community nicht nur zuschaut, sondern selbst Teil davon wird. Mit Profilen, XP, Achievements, Events, Freunden, Pets und noch vielem mehr, das nach und nach dazukommt.\\n\\nDanke für jede Form von Unterstützung. Ob Follow, Chatnachricht, Lurk, Sub, Raid oder einfach nur da sein: Ich weiß das wirklich zu schätzen. 🫶\\n\\nSchön, dass du hier bist. Willkommen bei ACY. 💜',
      community_text: "Mehr als nur ein Chat. Die Community rund um Acyjannik, zusammengebracht an einem Ort.",
      hero_image_url: "/assets/acyjannik-hero.png",
    },
    socials: [
      { platform: "twitch", label: "Twitch", url: "https://www.twitch.tv/acyjannik", enabled: true, sort_order: 1 },
      { platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@acyjannik", enabled: true, sort_order: 2 },
      { platform: "whatsapp", label: "WhatsApp", url: "https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10", enabled: true, sort_order: 3 },
      { platform: "discord", label: "Discord", url: "https://discord.gg/74ACqBwfu", enabled: true, sort_order: 4 },
    ],
    games: [
      { name: "Fortnite", description: "Main Game · Ranked · Community", tag: "MAIN GAME", image_url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Fortnite_at_E3_2018_(42719678112).jpg", featured: true, sort_order: 1, enabled: true },
      { name: "GTA V", description: "Open World · Aktuell · Fun", tag: "AKTUELL", image_url: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg", featured: false, sort_order: 2, enabled: true },
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
      .length
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
    // V7.4.8 fixes a regression where `mergedGames` was referenced before
    // initialization, causing the whole public-content endpoint to fall back
    // to the static placeholder content.
    const mergedGames = [...normalizedGames];
    const required = new Map(fallback.games.map(g => [g.name, g]));
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
