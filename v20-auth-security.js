/* ACY Club V20 Auth Security
 * Username/e-mail login + MFA gate for privileged accounts.
 * MFA uses Supabase Auth TOTP and AAL2. Normal members remain unchanged.
 */
(function () {
  'use strict';

  const supabase = window.supabase;
  if (!supabase?.createClient) return;

  async function getClient() {
    if (window.__acyAuthSecurityClient) return window.__acyAuthSecurityClient;
    const response = await fetch('/api/config', { cache: 'default' });
    const config = await response.json();
    if (!config?.configured) throw new Error('Supabase ist nicht konfiguriert.');
    window.__acyAuthSecurityClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return window.__acyAuthSecurityClient;
  }

  async function requirePrivilegedMfa() {
    const client = await getClient();
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return { ok: false, reason: 'signed_out' };

    const { data: admin } = await client
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!admin) return { ok: true, privileged: false, aal: 'aal1' };

    const { data: aal, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;

    return {
      ok: true,
      privileged: true,
      aal: aal?.currentLevel || 'aal1',
      nextLevel: aal?.nextLevel || 'aal1',
      mfaRequired: aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2'
    };
  }

  async function verifyTotp(code) {
    const client = await getClient();
    const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
    if (factorError) throw factorError;
    const factor = (factors?.totp || []).find(item => item.status === 'verified');
    if (!factor) throw new Error('Für diesen Admin-Account ist noch kein TOTP-Faktor eingerichtet.');

    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) throw challengeError;
    if (!challenge?.id) throw new Error('Supabase hat keine gültige MFA-Challenge zurückgegeben.');

    const { error: verifyError } = await client.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: String(code || '').trim()
    });
    if (verifyError) throw verifyError;

    // Supabase promotes the current session to AAL2 after a successful MFA
    // verification and refreshes the session automatically. Do NOT call
    // refreshSession() here: that can replace the freshly promoted MFA
    // session with a plain AAL1 refresh-token session before the gate checks it.
    const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aal?.currentLevel !== 'aal2') {
      throw new Error('MFA wurde bestätigt, aber Supabase hat die Sitzung noch nicht auf AAL2 hochgestuft.');
    }

    return aal;
  }

  window.ACYAuthSecurity = {
    getClient,
    requirePrivilegedMfa,
    verifyTotp
  };
})();
