(() => {
  'use strict';
  const VERSION = 'V19.0.0 · RC9';
  const isClub = /club-profile\.html$/i.test(location.pathname) || /club-profile/i.test(location.pathname);
  let staffBusy = false;
  let lastStaffRun = 0;
  let staffTimer = 0;

  const token = () => {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const p = JSON.parse(localStorage.getItem(key) || '{}');
        const t = p?.access_token || p?.currentSession?.access_token || p?.session?.access_token || p?.data?.session?.access_token;
        if (t) return t;
      }
    } catch {}
    return null;
  };

  async function sessionToken() {
    const existing = token();
    if (existing) return existing;
    try {
      const cfg = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(r => r.json());
      if (cfg?.supabaseUrl && cfg?.supabaseAnonKey && window.supabase?.createClient) {
        const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const { data } = await sb.auth.getSession();
        return data?.session?.access_token || null;
      }
    } catch {}
    return null;
  }

  function removeLegacyBadges() {
    document.querySelectorAll('#acy-build-marker,#acy-dev-version-badge,#acy-v189-version-badge,.streamer-version,.acy-v19-rc-badge,.acy-v19-rc-badge-v2,.acy-v19-rc-safe-badge,.acy-v19-rc3-badge,.acy-v19-rc5-badge,.acy-v19-rc6-badge').forEach(el => el.remove());
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').trim();
      if (/^V18\.[0-9.]+\s*·\s*DEV$/.test(text) || /^V19\.0\.0\s*·\s*RC\d+$/.test(text)) el.remove();
    });
  }

  function installVersionBadge() {
    removeLegacyBadges();
    let badge = document.getElementById('acy-v19-rc6-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-v19-rc6-badge';
      document.body.appendChild(badge);
    }
    badge.textContent = VERSION;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));right:10px;z-index:12050;padding:7px 11px;border:1px solid rgba(180,108,255,.38);border-radius:999px;background:rgba(10,9,15,.94);backdrop-filter:blur(12px);color:#f7f3ff;font:800 11px/1.1 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;white-space:nowrap';
  }

  function removeAdminHeader() {
    if (!isClub) return;
    document.querySelectorAll('.member-header-actions a,.member-header-actions button').forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (/admin\s*\/\s*mod/i.test(text) || href.includes('admin.html') || href.includes('mod.html')) el.remove();
    });
  }

  function moveCardStatuses() {
    if (!isClub) return;
    document.querySelectorAll('.member-fold>summary,.member-fold-summary').forEach(summary => {
      const main = summary.querySelector('.member-fold-summary-main');
      const side = summary.querySelector('.member-fold-summary-side');
      if (!main || !side) return;
      const status = side.querySelector('.member-count-chip,.chat-online-chip,.member-glow-title');
      if (!status) return;
      if (!main.contains(status)) {
        status.classList.add('v19-rc6-inline-status');
        main.appendChild(status);
      }
    });
  }

  function injectMobileStyles() {
    if (document.getElementById('acy-v19-rc6-mobile-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v19-rc6-mobile-style';
    style.textContent = `
      html,body{max-width:100%;overflow-x:hidden}
      *,*::before,*::after{box-sizing:border-box}
      @media(max-width:700px){
        .member-fold>summary,.member-fold-summary{grid-template-columns:58px minmax(0,1fr) 40px!important;gap:10px!important;align-items:start!important}
        .member-fold-art-wrap,.member-fold-art{width:58px!important;height:58px!important;min-width:58px!important;border-radius:16px!important;object-fit:cover!important}
        .member-fold-summary-main{min-width:0!important;width:100%!important;display:block!important;text-align:left!important}
        .member-fold-summary-main strong{font-size:20px!important;line-height:1.12!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:none!important}
        .member-fold-summary-main small{font-size:13px!important;line-height:1.32!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .v19-rc6-inline-status{display:inline-flex!important;width:max-content!important;max-width:100%!important;min-width:0!important;margin-top:8px!important;padding:6px 10px!important;border-radius:14px!important;line-height:1.15!important;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .member-fold-summary-side{display:flex!important;align-items:flex-end!important;justify-content:flex-start!important;min-width:0!important}
        .member-fold-summary-side .member-fold-chevron{width:36px!important;height:36px!important}
        .member-count-chip,.level-chip,.member-glow-title,.v18-status-pill,.member-level-badge,.level-badge,.hub-level-badge,.hub-level-pill,.progression-level-badge,[class*="count-chip"],[class*="status-pill"],[class*="level-badge"]{width:auto!important;height:auto!important;min-width:0!important;max-width:100%!important;aspect-ratio:auto!important;padding:6px 10px!important;border-radius:14px!important;white-space:normal!important;overflow-wrap:anywhere!important;line-height:1.15!important}
        .pet-progression{width:100%!important;max-width:100%!important;min-width:0!important;padding:14px!important;overflow:hidden!important}
        .pet-progression-head{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important}
        .pet-progression-head .eyebrow{font-size:11px!important;letter-spacing:.16em!important}
        .pet-progression-head strong{font-size:20px!important;line-height:1.2!important;white-space:normal!important}
        .pet-progression-summary{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:3px!important;margin-top:10px!important}
        .pet-progression-summary span{display:block!important;width:100%!important;font-size:14px!important;line-height:1.3!important;white-space:normal!important;overflow-wrap:normal!important}
        .pet-progression-bar{width:100%!important;height:9px!important;margin:10px 0 12px!important}
        .pet-progression .pet-levels-fold summary{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:46px!important;gap:10px!important}
        .member-avatar-img,.member-avatar,.member-directory-avatar img,.social-avatar img,.member-list-avatar img,.profile-avatar img{object-fit:cover!important;object-position:center!important}
        .member-avatar-wrap,.member-directory-avatar,.social-avatar,.member-list-avatar,.profile-avatar{overflow:hidden!important}
      }
      @media(max-width:390px){
        .member-fold>summary,.member-fold-summary{grid-template-columns:52px minmax(0,1fr) 38px!important;gap:8px!important;padding:11px!important}
        .member-fold-art-wrap,.member-fold-art{width:52px!important;height:52px!important;min-width:52px!important}
        .member-fold-summary-main strong{font-size:18px!important}
        .member-fold-summary-main small{font-size:12px!important}
        .pet-progression{padding:12px!important}.pet-progression-head strong{font-size:18px!important}.pet-progression-summary span{font-size:13px!important}
      }
    `;
    document.head.appendChild(style);
  }

  async function syncStaffMenu() {
    if (!isClub || staffBusy) return;
    const now = Date.now();
    if (now - lastStaffRun < 1800) return;
    const grid = document.querySelector('.mobile-more-grid-v181');
    if (!grid) return;
    staffBusy = true;
    lastStaffRun = now;
    try {
      grid.querySelectorAll('a,button').forEach(el => {
        const text = (el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        if (text.includes('staff center') || href.includes('staff.html') || href.includes('staff-center.html')) el.remove();
      });
      const access = await sessionToken();
      if (!access) return;
      const response = await fetch('/api/mod-auth', {
        headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
        cache: 'no-store', signal: AbortSignal.timeout(7000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !(data.isStaff || data.isAdmin || data.isModerator || data.isStreamer)) return;
      const link = document.createElement('a');
      link.href = '/staff-center.html';
      link.dataset.v19Rc6Staff = '1';
      link.innerHTML = '<span>🛡️</span><strong>Staff Center</strong><small>Admin · Mod · Streamer</small>';
      grid.appendChild(link);
    } catch {} finally {
      staffBusy = false;
    }
  }

  function scheduleStaffSync(delay=0) {
    if (!isClub) return;
    clearTimeout(staffTimer);
    staffTimer = setTimeout(() => syncStaffMenu(), delay);
  }

  function observe() {
    if (!isClub || document.documentElement.dataset.acyRc6Observer === '1') return;
    document.documentElement.dataset.acyRc6Observer = '1';
    const observer = new MutationObserver(() => {
      moveCardStatuses();
      removeAdminHeader();
      scheduleStaffSync(250);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function init() {
    injectMobileStyles();
    installVersionBadge();
    removeAdminHeader();
    moveCardStatuses();
    observe();
    scheduleStaffSync(0);
    [900,2500,5000].forEach(ms => setTimeout(() => { moveCardStatuses(); removeAdminHeader(); scheduleStaffSync(0); }, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
