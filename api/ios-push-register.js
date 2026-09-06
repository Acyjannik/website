export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || serviceKey;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Push service is not configured.' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht angemeldet.' });

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: auth }
    });
    if (!who.ok) return res.status(401).json({ error: 'Ungültige Sitzung.' });
    const user = await who.json();
    if (!user?.id) return res.status(401).json({ error: 'Benutzer konnte nicht ermittelt werden.' });

    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body && typeof req.body === 'object' ? req.body : {});
    const deviceToken = String(body.deviceToken || '').trim().toLowerCase();
    const environment = String(body.environment || '').trim().toLowerCase();
    const deviceName = String(body.deviceName || '').trim().slice(0, 120);

    if (!/^[a-f0-9]{32,256}$/.test(deviceToken)) {
      return res.status(400).json({ error: 'Ungültiger APNs-Device-Token.' });
    }
    if (!['sandbox', 'production'].includes(environment)) {
      return res.status(400).json({ error: 'Ungültige APNs-Umgebung.' });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    };
    const response = await fetch(`${url}/rest/v1/ios_push_tokens?on_conflict=device_token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        device_token: deviceToken,
        environment,
        device_name: deviceName || null,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) return res.status(500).json({ error: await response.text() });
    return res.status(200).json({ ok: true, saved: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'APNs-Token konnte nicht gespeichert werden.' });
  }
}
