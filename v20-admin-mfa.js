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

  async function client() {
    if (window.ACYAuthSecurity?.getClient) return window.ACYAuthSecurity.getClient();
    throw new Error('Auth-Sicherheitsmodul fehlt.');
  }
  function setStatus(text, type='') { if (status) { status.textContent=text; status.dataset.type=type; } }

  async function enroll() {
    const sb = await client();
    setStatus('MFA wird eingerichtet…');
    const { data, error } = await sb.auth.mfa.enroll({ factorType:'totp', friendlyName:'ACY Admin Authenticator' });
    if (error) throw error;
    const factor = data?.totp;
    if (!factor) throw new Error('Kein TOTP-Faktor erhalten.');
    if (secret) secret.textContent = factor.secret || '';
    if (qr && factor.qr_code) { qr.src = factor.qr_code; qr.hidden=false; }
    setup.hidden=false;
    verify.hidden=false;
    setStatus('Authenticator eingerichtet. Scanne den QR-Code und gib danach den 6-stelligen Code ein.','success');
    root.dataset.factorId=factor.id;
  }

  async function verifyEnrollment() {
    const sb=await client();
    const factorId=root.dataset.factorId;
    const value=String(code?.value||'').replace(/\D/g,'');
    if (!factorId || value.length!==6) throw new Error('Bitte den 6-stelligen Code eingeben.');
    const { data: challenge, error: challengeError } = await sb.auth.mfa.challenge({factorId});
    if (challengeError) throw challengeError;
    const { error } = await sb.auth.mfa.verify({factorId,challengeId:challenge.id,code:value});
    if (error) throw error;
    await sb.auth.refreshSession();
    setStatus('MFA erfolgreich aktiviert. Dein Admin-Zugang ist jetzt mit AAL2 geschützt.','success');
    setup.hidden=true;
    verify.hidden=true;
  }

  root.querySelector('[data-mfa-enroll]')?.addEventListener('click',()=>enroll().catch(e=>setStatus(e.message||'MFA konnte nicht eingerichtet werden.','error')));
  root.querySelector('[data-mfa-confirm]')?.addEventListener('click',()=>verifyEnrollment().catch(e=>setStatus(e.message||'MFA-Code ungültig.','error')));
})();
