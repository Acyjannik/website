let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");
  }

  const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Twitch token request failed: ${tokenResponse.status} ${body}`);
  }

  const token = await tokenResponse.json();
  cachedToken = token.access_token;
  tokenExpiresAt = Date.now() + Number(token.expires_in || 0) * 1000;
  return cachedToken;
}

async function fetchLiveStream(clientId, token) {
  return fetch(
    "https://api.twitch.tv/helix/streams?user_login=acyjannik",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId,
      },
    }
  );
}

export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    let token = await getAppAccessToken();
    let twitchResponse = await fetchLiveStream(clientId, token);

    // Twitch can revoke an otherwise cached app token. Retry once with a
    // completely fresh token instead of surfacing a 500 to every club client.
    if (twitchResponse.status === 401) {
      cachedToken = null;
      tokenExpiresAt = 0;
      token = await getAppAccessToken();
      twitchResponse = await fetchLiveStream(clientId, token);
    }

    if (!twitchResponse.ok) {
      const body = await twitchResponse.text();
      throw new Error(`Twitch stream request failed: ${twitchResponse.status} ${body}`);
    }

    const payload = await twitchResponse.json();
    const stream = payload.data?.[0];

    if (!stream) {
      return res.status(200).json({ live: false, channel: "acyjannik" });
    }

    return res.status(200).json({
      live: stream.type === "live",
      id: stream.id,
      channel: stream.user_login,
      title: stream.title,
      game: stream.game_name,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      thumbnailUrl: stream.thumbnail_url,
      isMature: stream.is_mature,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      live: false,
      error: "Twitch API temporarily unavailable",
    });
  }
}
