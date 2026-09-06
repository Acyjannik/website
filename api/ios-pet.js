export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'GET or POST only' });
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || serviceKey;
  const auth = req.headers.authorization || '';
  if (!url || !serviceKey || !anonKey) return res.status(503).json({ error: 'Supabase ist nicht konfiguriert.' });
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht angemeldet.' });
  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } });
    if (!userResponse.ok) return res.status(401).json({ error: 'Ungültige Sitzung.' });
    const user = await userResponse.json();
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    if (req.method === 'GET') {
      const response = await fetch(`${url}/rest/v1/club_pets?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=updated_at.desc&limit=1`, { headers });
      if (!response.ok) return res.status(500).json({ error: await response.text() });
      const rows = await response.json();
      return res.status(200).json({ pet: rows?.[0] || null });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '').trim();
    const allowed = new Set(['feed', 'play', 'pet', 'groom', 'sleep', 'train', 'explore']);
    if (!allowed.has(action)) return res.status(400).json({ error: 'Ungültige Pet-Aktion.' });
    const response = await fetch(`${url}/rest/v1/rpc/club_pet_action`, { method: 'POST', headers, body: JSON.stringify({ p_action: action }) });
    if (!response.ok) return res.status(response.status).json({ error: await response.text() });
    return res.status(200).json({ result: await response.json() });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Pet konnte nicht geladen werden.' });
  }
}
