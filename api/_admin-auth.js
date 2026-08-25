import { createClient } from '@supabase/supabase-js';

export async function requireAdminAAL2(req) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    return { ok: false, status: 503, error: 'Admin service is not configured.' };
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Nicht angemeldet.' };
  }

  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: 'Nicht angemeldet.' };

  try {
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const claims = claimsData?.claims;
    if (claimsError || !claims?.sub) {
      return { ok: false, status: 401, error: 'Ungültige Sitzung.' };
    }

    if (claims.role !== 'authenticated') {
      return { ok: false, status: 401, error: 'Ungültige Sitzung.' };
    }

    if (claims.aal !== 'aal2') {
      return { ok: false, status: 403, error: 'AAL2-MFA erforderlich.' };
    }

    const adminCheck = await fetch(
      `${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(claims.sub)}&select=user_id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    if (!adminCheck.ok) {
      return { ok: false, status: 500, error: 'Admin-Rechte konnten nicht geprüft werden.' };
    }

    const admins = await adminCheck.json();
    if (!Array.isArray(admins) || !admins.length) {
      return { ok: false, status: 403, error: 'Nur Admins dürfen diese Aktion ausführen.' };
    }

    return { ok: true, userId: claims.sub, claims };
  } catch (error) {
    console.error('admin-auth', error);
    return { ok: false, status: 500, error: error?.message || 'Admin-Autorisierung fehlgeschlagen.' };
  }
}
