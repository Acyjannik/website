export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Service not configured.' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht angemeldet.' });

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: auth }
    });
    if (!who.ok) return res.status(401).json({ error: 'Ungültige Sitzung.' });

    const admin = await who.json();
    const adminCheck = await fetch(
      `${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(admin.id)}&select=user_id&limit=1`,
      { headers: serviceHeaders }
    );
    const admins = adminCheck.ok ? await adminCheck.json() : [];
    if (!adminCheck.ok || !admins.length) {
      return res.status(403).json({ error: 'Nur Admins dürfen News löschen.' });
    }

    const rawId = req.query?.id ?? (typeof req.body === 'string' ? JSON.parse(req.body || '{}').id : req.body?.id);
    const id = String(rawId || '').trim();
    if (!id) return res.status(400).json({ error: 'News-ID fehlt.' });

    const response = await fetch(
      `${url}/rest/v1/club_news?id=eq.${encodeURIComponent(id)}&select=id`,
      {
        method: 'DELETE',
        headers: { ...serviceHeaders, Prefer: 'return=representation' }
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: await response.text() });
    }

    const deleted = await response.json().catch(() => []);
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return res.status(404).json({ error: 'News wurde nicht gefunden oder war bereits gelöscht.' });
    }

    return res.status(200).json({ ok: true, deleted: deleted.length, id });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'News konnte nicht gelöscht werden.' });
  }
}
