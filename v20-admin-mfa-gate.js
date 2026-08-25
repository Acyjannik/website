/* ACY V20 Admin MFA Gate
 * UI/session gate for privileged admin accounts.
 * The final security boundary remains server-side AAL2 enforcement on privileged APIs.
 */
(function () {
  'use strict';

  const STYLE = `
    #dashboard[data-acy-mfa-locked="true"] { display:none !important; }
    #acy-mfa-gate { position:fixed; inset:0; z-index:2147483000; display:grid; place-items:center; padding:24px; background:rgba(5,5,9,.96); backdrop-filter:blur(18px); }
    #acy-mfa-gate[hidden] { display:none !important; }
    .acy-mfa-card { width:min(460px,100%); box-sizing:border-box; padding:28px; border:1px solid rgba(255,255,255,.12); border-radius:24px; background:#14141b; color:#f5f5f7; box-shadow:0 24px 80px rgba(0,0,0,.45); font-family:Inter,system-ui,sans-serif; }
    .acy-mfa-card h2 { margin:8px 0 10px; }
    .acy-mfa-muted { color:#aaaab7; line-height:1.5; }
    .acy-mfa-code { width:100%; box-sizing:border-box; margin:12px 0; padding:14px; border-radius:12px; border:1px solid #363644; background:#0b0b10; color:#fff; font-size:25px; letter-spacing:.28em; text-align:center; }
    .acy-mfa-btn { border:0; border-radius:12px; padding:13px 16px; background:#fff; color:#08080c; font-weight:750; cursor:pointer; }
    .acy-mfa-btn:disabled { opacity:.55; cursor:wait; }
    .acy-mfa-link { display:inline-block; margin-left:10px; color:#fff; }
    .acy-mfa-status { min-height:22px; margin-top:14px; }
    .acy-mfa-status.error { color:#ff8c8c; }
    .acy-mfa-status.success { color:#8be0a5; }
  `;

  function installStyle() {
    if (document.getElementById('acy-mfa-gate-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-mfa-gate-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function buildGate() {
    if (document.getElementById('acy-mfa-gate')) return document.getElementById('acy-mfa-gate');
    const gate = document.createElement('section');
    gate.id = 'acy-mfa-gate';
    gate.hidden = true;
    gate.innerHTML = `
      <div class="acy-mfa-card">
        <div class="eyebrow">ACY SECURE AUTH</div>
        <h2>Admin-MFA erforderlich</h2>
        <p class="acy-mfa-muted" data-acy-mfa-copy>Dieser Admin-Bereich ist zusätzlich mit Zwei-Faktor-Authentifizierung geschützt.</p>
        <div data-acy-mfa-setup hidden>
          <p class="acy-mfa-muted">Für diesen Admin-Account ist noch kein Authenticator eingerichtet.</p>
          <a class="acy-mfa-btn" href="/admin-mfa.html" style="text-decoration:none;display:inline-block">MFA einrichten</a>
          <button class="acy-mfa-link" type="button" data-acy-mfa-logout>Abmelden</button>
        </div>
        <div data-acy-mfa-challenge hidden>
          <label for="acy-mfa-code">Authenticator-Code</label>
          <input id="acy-mfa-code" class="acy-mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000">
          <button class="acy-mfa-btn" type="button" data-acy-mfa-verify>Code bestätigen</button>
          <button class="acy-mfa-link" type="button" data-acy-mfa-logout>Abmelden</button>
        </div>
        <div class="acy-mfa-status" data-acy-mfa-status></div>
      </div>`;
    document.body.appendChild(gate);

    gate.querySelectorAll('[data-acy-mfa-logout]').forEach(btn => btn.addEventListener('click', async () => {
      try { await window.ACYAuthSecurity?.getClient().then(c => c.auth.signOut()); } finally { location.reload(); }
    }));
    gate.querySelector('[data-acy-mfa-verify]')?.addEventListener('click', verify);
    gate.querySelector('#acy-mfa-code')?.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
    return gate;
  }

  function lock() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.dataset.acyMfaLocked = 'true';
    const gate = buildGate();
    gate.hidden = false;
  }

  function unlock() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.dataset.acyMfaLocked = 'false';
      dashboard.hidden = false;
    }
    const gate = document.getElementById('acy-mfa-gate');
    if (gate) gate.hidden = true;
  }

  function setStatus(text, type = '') {
    const el = document.querySelector('[data-acy-mfa-status]');
    if (!el) return;
    el.textContent = text;
    el.className = `acy-mfa-status ${type}`.trim();
  }

  async function enforce() {
    if (!window.ACYAuthSecurity?.requirePrivilegedMfa) return;
    try {
      const result = await window.ACYAuthSecurity.requirePrivilegedMfa();
      if (!result?.ok || !result?.privileged) return;
      lock();

      const client = await window.ACYAuthSecurity.getClient();
      const { data: factors } = await client.auth.mfa.listFactors();
      const verified = (factors?.totp || []).some(f => f.status === 'verified');
      const setup = document.querySelector('[data-acy-mfa-setup]');
      const challenge = document.querySelector('[data-acy-mfa-challenge]');

      if (!verified) {
        if (setup) setup.hidden = false;
        if (challenge) challenge.hidden = true;
        setStatus('MFA muss einmal eingerichtet werden.', 'error');
        return;
      }

      if (setup) setup.hidden = true;
      if (challenge) challenge.hidden = false;
      setStatus('Bitte den aktuellen 6-stelligen Code eingeben.');
      document.querySelector('#acy-mfa-code')?.focus();
    } catch (error) {
      lock();
      setStatus(error?.message || 'MFA-Prüfung fehlgeschlagen.', 'error');
    }
  }

  async function verify() {
    const input = document.querySelector('#acy-mfa-code');
    const button = document.querySelector('[data-acy-mfa-verify]');
    const value = String(input?.value || '').replace(/\D/g, '');
    if (value.length !== 6) return setStatus('Bitte den 6-stelligen Authenticator-Code eingeben.', 'error');
    if (button) { button.disabled = true; button.textContent = 'Prüfe…'; }
    setStatus('MFA wird geprüft…');
    try {
      await window.ACYAuthSecurity.verifyTotp(value);
      const result = await window.ACYAuthSecurity.requirePrivilegedMfa();
      if (result?.aal !== 'aal2') throw new Error('MFA wurde bestätigt, aber die Sitzung ist noch nicht auf AAL2.');
      setStatus('MFA bestätigt.', 'success');
      unlock();
    } catch (error) {
      setStatus(error?.message || 'Ungültiger MFA-Code.', 'error');
      if (input) { input.value = ''; input.focus(); }
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Code bestätigen'; }
    }
  }

  function init() {
    installStyle();
    buildGate();
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.dataset.acyMfaLocked = 'true';
    window.setTimeout(enforce, 0);

    window.addEventListener('acy:admin-auth-ready', enforce);
    window.addEventListener('storage', e => { if (e.key === 'supabase.auth.token') enforce(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
