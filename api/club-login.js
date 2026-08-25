export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(503).json({ error: 'Auth service is not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const identifier = String(body.identifier || '').trim();
    const password = String(body.password || '');
    if (!identifier || !password) return res.status(400).json({ error: 'Identifier and password are required.' });

    let email = identifier;
    if (!identifier.includes('@')) {
      const safeUsername = identifier.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (safeUsername !== identifier.toLowerCase()) return res.status(401).json({ error: 'Login fehlgeschlagen.' });

      const lookup = await fetch(
        `${supabaseUrl}/rest/v1/club_profiles?username=eq.${encodeURIComponent(safeUsername)}&select=user_id&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          cache: 'no-store'
        }
      );

      if (!lookup.ok) return res.status(401).json({ error: 'Login fehlgeschlagen.' });
      const rows = await lookup.json();
      if (!rows?.length) return res.status(401).json({ error: 'Login fehlgeschlagen.' });

      const user = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(rows[0].user_id)}`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store'
      });
      if (!user.ok) return res.status(401).json({ error: 'Login fehlgeschlagen.' });
      const userData = await user.json();
      email = String(userData.email || '');
      if (!email) return res.status(401).json({ error: 'Login fehlgeschlagen.' });
    }

    const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const authText = await auth.text();
    let authData = {};
    try { authData = JSON.parse(authText); } catch (_) {}

    if (!auth.ok) {
      return res.status(401).json({ error: 'Login fehlgeschlagen.' });
    }

    return res.status(200).json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires_in: authData.expires_in,
      token_type: authData.token_type,
      user: authData.user
    });
  } catch (error) {
    console.error('club-login:', error);
    return res.status(500).json({ error: 'Auth service failed.' });
  }
}
