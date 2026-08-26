import { createClient } from '@supabase/supabase-js';

export async function requireStaffAAL2(req) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    return { ok: false, status: 503, error: 'Moderationsdienst ist nicht konfiguriert.' };
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
    if (claimsError || !claims?.sub || claims.role !== 'authenticated') {
      return { ok: false, status: 401, error: 'Ungültige Sitzung.' };
    }

    if (claims.aal !== 'aal2') {
      return { ok: false, status: 403, error: 'AAL2-MFA erforderlich.' };
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    };

    const [adminRes, modRes] = await Promise.all([
      fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(claims.sub)}&select=user_id&limit=1`, { headers }),
      fetch(`${url}/rest/v1/club_moderators?user_id=eq.${encodeURIComponent(claims.sub)}&select=user_id&limit=1`, { headers })
    ]);

    if (!adminRes.ok || !modRes.ok) {
      return { ok: false, status: 500, error: 'Staff-Rechte konnten nicht geprüft werden.' };
    }

    const [admins, moderators] = await Promise.all([adminRes.json(), modRes.json()]);
    const isAdmin = Array.isArray(admins) && admins.length > 0;
    const isModerator = Array.isArray(moderators) && moderators.length > 0;

    if (!isAdmin && !isModerator) {
      return { ok: false, status: 403, error: 'Nur Moderatoren und Admins dürfen diese Aktion ausführen.' };
    }

    return { ok: true, userId: claims.sub, claims, isAdmin, isModerator };
  } catch (error) {
    console.error('staff-auth', error);
    return { ok: false, status: 500, error: error?.message || 'Staff-Autorisierung fehlgeschlagen.' };
  }
}
