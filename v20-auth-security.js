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

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function readAal2(client) {
    const { data: aal, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return aal;
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

    // Supabase upgrades the session to AAL2 after a successful verification.
    // The refresh is asynchronous, so do not reject a valid verification just
    // because the local JWT still contains the previous AAL1 claim for a moment.
    // We first allow the automatic refresh to finish, then explicitly refresh
    // the session if the local client still has the old JWT.
    for (let attempt = 0; attempt < 6; attempt++) {
      const aal = await readAal2(client);
      if (aal?.currentLevel === 'aal2') return aal;

      await wait(250);

      if (attempt === 2 || attempt === 4) {
        const { error: refreshError } = await client.auth.refreshSession();
        if (refreshError) throw refreshError;
      }
    }

    throw new Error('MFA wurde bestätigt, aber Supabase hat die Sitzung noch nicht auf AAL2 hochgestuft.');
  }

  window.ACYAuthSecurity = {
    getClient,
    requirePrivilegedMfa,
    verifyTotp
  };
})();
