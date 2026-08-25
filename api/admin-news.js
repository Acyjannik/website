import { requireAdminAAL2 } from './_admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });

  const authz = await requireAdminAAL2(req);
  if (!authz.ok) return res.status(authz.status).json({ error: authz.error });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  try {
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

    if (!response.ok) return res.status(500).json({ error: await response.text() });

    const deleted = await response.json().catch(() => []);
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return res.status(404).json({ error: 'News wurde nicht gefunden oder war bereits gelöscht.' });
    }

    return res.status(200).json({ ok: true, deleted: deleted.length, id });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'News konnte nicht gelöscht werden.' });
  }
}
