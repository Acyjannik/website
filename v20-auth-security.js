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
    const client = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    // Keep the freshly issued MFA JWT available to immediate AAL checks.
    // Supabase's MFA verify response contains the new access token, whose
    // `aal` claim is the authoritative proof that the step-up succeeded.
    const originalGetAal = client.auth.mfa.getAuthenticatorAssuranceLevel.bind(client.auth.mfa);
    client.auth.mfa.getAuthenticatorAssuranceLevel = async (jwt) => {
      const verifiedJwt = window.__acyAuthSecurityAal2Token;
      return originalGetAal(jwt || verifiedJwt || undefined);
    };

    window.__acyAuthSecurityClient = client;
    return client;
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

    const { data: verification, error: verifyError } = await client.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: String(code || '').trim()
    });
    if (verifyError) throw verifyError;

    // MFA verify returns a newly issued access token. Validate AAL2 directly
    // against that token instead of racing the client's in-memory session.
    const accessToken = verification?.access_token;
    if (!accessToken) throw new Error('MFA wurde bestätigt, aber Supabase hat kein neues AAL2-Token zurückgegeben.');
    window.__acyAuthSecurityAal2Token = accessToken;

    const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    if (aalError) throw aalError;
    if (aal?.currentLevel !== 'aal2') {
      throw new Error('MFA wurde bestätigt, aber das neue Supabase-Token ist noch nicht auf AAL2.');
    }

    return aal;
  }

  window.ACYAuthSecurity = {
    getClient,
    requirePrivilegedMfa,
    verifyTotp
  };
})();
