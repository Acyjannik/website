/* ACY Club V20 Admin MFA UI
 * Uses Supabase Auth TOTP. This file never handles secrets itself.
 */
(function () {
  'use strict';
  const root = document.querySelector('[data-acy-mfa]');
  if (!root) return;

  const status = root.querySelector('[data-mfa-status]');
  const setup = root.querySelector('[data-mfa-setup]');
  const verify = root.querySelector('[data-mfa-verify]');
  const secret = root.querySelector('[data-mfa-secret]');
  const qr = root.querySelector('[data-mfa-qr]');
  const code = root.querySelector('[data-mfa-code]');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const FRIENDLY_NAME = 'ACY Admin Authenticator';

  async function client() {
    if (window.ACYAuthSecurity?.getClient) return window.ACYAuthSecurity.getClient();
    throw new Error('Auth-Sicherheitsmodul fehlt.');
  }

  function setStatus(text, type='') {
    if (status) {
      status.textContent = text;
      status.dataset.type = type;
    }
  }

  async function listFactors(sb) {
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) throw error;
    return data || { totp: [], phone: [] };
  }

  async function cleanupUnverifiedFriendlyName(sb) {
    const factors = await listFactors(sb);
    const all = [...(factors.totp || []), ...(factors.phone || [])];
    const matches = all.filter(f =>
      f?.factor_type === 'totp' &&
      f?.friendly_name === FRIENDLY_NAME &&
      f?.status !== 'verified' &&
      UUID_RE.test(String(f?.id || ''))
    );

    for (const factor of matches) {
      const { error } = await sb.auth.mfa.unenroll({ factorId: factor.id });
      if (error) console.warn('[ACY MFA] konnte unbestätigten Faktor nicht entfernen:', error);
    }
  }

  async function showExistingVerifiedFactor(sb) {
    const factors = await listFactors(sb);
    const verified = (factors.totp || []).find(f =>
      f?.factor_type === 'totp' && f?.status === 'verified' && UUID_RE.test(String(f?.id || ''))
    );
    if (!verified) return false;

    if (setup) setup.hidden = true;
    if (verify) verify.hidden = true;
    root.dataset.factorId = verified.id;
    setStatus('MFA ist bereits aktiviert. Dein Admin-Zugang ist mit AAL2 geschützt.', 'success');
    return true;
  }

  async function enroll() {
    const sb = await client();
    setStatus('MFA wird vorbereitet…');

    // Supabase creates an unverified factor immediately. If a previous
    // attempt failed, that orphaned factor otherwise blocks the same name.
    if (await showExistingVerifiedFactor(sb)) return;
    await cleanupUnverifiedFriendlyName(sb);

    const { data, error } = await sb.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: FRIENDLY_NAME
    });
    if (error) throw error;

    // The factor UUID is data.id. data.totp contains the QR/secret.
    const factorId = data?.id;
    const totp = data?.totp;
    if (!factorId || !UUID_RE.test(String(factorId))) {
      throw new Error('Supabase hat keine gültige MFA-Faktor-ID zurückgegeben.');
    }
    if (!totp) throw new Error('Kein TOTP-Faktor erhalten.');

    if (secret) secret.textContent = totp.secret || '';
    if (qr && totp.qr_code) {
      qr.src = totp.qr_code;
      qr.hidden = false;
    }
    if (setup) setup.hidden = false;
    if (verify) verify.hidden = false;
    if (code) code.value = '';
    root.dataset.factorId = factorId;
    setStatus('Authenticator eingerichtet. Scanne den QR-Code und gib danach den aktuellen 6-stelligen Code ein.', 'success');
  }

  async function verifyEnrollment() {
    const sb = await client();
    const factorId = root.dataset.factorId;
    const value = String(code?.value || '').replace(/\D/g, '');

    if (!factorId || !UUID_RE.test(factorId)) {
      throw new Error('Keine gültige MFA-Faktor-ID. Bitte die Einrichtung neu starten.');
    }
    if (value.length !== 6) {
      throw new Error('Bitte den 6-stelligen Code eingeben.');
    }

    const { data: challenge, error: challengeError } = await sb.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    if (!challenge?.id || !UUID_RE.test(String(challenge.id))) {
      throw new Error('Supabase hat keine gültige MFA-Challenge zurückgegeben.');
    }

    const { error } = await sb.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: value
    });

    if (error) {
      // Keep the unverified factor alive so the user can simply enter the
      // next 6-digit code. Do not create another factor on a bad code.
      if (error.code === 'mfa_verification_failed') {
        throw new Error('TOTP-Code ungültig. Bitte den aktuell angezeigten Code aus deiner Authenticator-App eingeben und erneut bestätigen.');
      }
      throw error;
    }

    await sb.auth.refreshSession();
    setStatus('MFA erfolgreich aktiviert. Dein Admin-Zugang ist jetzt mit AAL2 geschützt.', 'success');
    if (setup) setup.hidden = true;
    if (verify) verify.hidden = true;
    if (secret) secret.textContent = '';
    if (code) code.value = '';
  }

  async function handleEnroll() {
    try {
      await enroll();
    } catch (e) {
      setStatus(e?.message || 'MFA konnte nicht eingerichtet werden.', 'error');
    }
  }

  async function handleVerify() {
    try {
      await verifyEnrollment();
    } catch (e) {
      setStatus(e?.message || 'MFA-Code ungültig.', 'error');
    }
  }

  root.querySelector('[data-mfa-enroll]')?.addEventListener('click', handleEnroll);
  root.querySelector('[data-mfa-confirm]')?.addEventListener('click', handleVerify);
})();
