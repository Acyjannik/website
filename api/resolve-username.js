const { createClient } = require('@supabase/supabase-js');

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const username = String(req.body?.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return json(res, 400, { error: 'Ungültiger Benutzername.' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(res, 500, { error: 'Auth-Konfiguration fehlt.' });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin
    .from('profiles')
    .select('email')
    .eq('username', username)
    .maybeSingle();

  if (error) return json(res, 500, { error: 'Login konnte nicht verarbeitet werden.' });
  if (!data?.email) return json(res, 401, { error: 'Anmeldedaten sind ungültig.' });

  return json(res, 200, { email: data.email });
};
