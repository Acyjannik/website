/* ACY Pet refresh compatibility fix.
 * Loaded after club-profile.js so successful Pet Life actions always re-read
 * the canonical hub state and refresh quest progress in the visible UI.
 *
 * V19 RELEASE LOCK: one visible version marker, without a DOM observer loop.
 */
(() => {
  const VERSION = 'V19.0.0 · RC11';

  const lockVersionBadge = () => {
    const selectors = [
      '#acy-build-marker', '#acy-v19-rc6-badge', '#acy-dev-version-badge',
      '#acy-v189-version-badge', '#acy-v19-rc-badge', '#acy-v19-rc-badge-v2',
      '#acy-v19-rc-safe-badge', '#acy-v19-rc3-badge', '#acy-v19-rc5-badge',
      '#acy-canonical-version-badge', '#acy-v19-canonical-version',
      '.streamer-version', '[data-acy-version-badge]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());

    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^V(?:18|19)\.[0-9.]+\s*[·•]\s*(?:DEV|RC\d+|RELEASE)$/i.test(text)) el.remove();
    });

    let badge = document.getElementById('acy-v19-release-version');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-v19-release-version';
      badge.setAttribute('aria-hidden', 'true');
      document.body.appendChild(badge);
    }
    badge.textContent = VERSION;
    badge.style.cssText = [
      'position:fixed','top:max(8px,env(safe-area-inset-top))','right:10px','z-index:13050',
      'padding:7px 11px','border:1px solid rgba(180,108,255,.42)','border-radius:999px',
      'background:rgba(10,9,15,.95)','backdrop-filter:blur(14px)','color:#f7f3ff',
      'font:800 11px/1.1 system-ui,sans-serif','letter-spacing:.04em','pointer-events:none',
      'white-space:nowrap','box-shadow:0 8px 30px rgba(0,0,0,.28)'
    ].join(';');
  };

  const installStaffCenterNav = () => {
    const clubPath = /\/club-profile\.html$/i.test(location.pathname);
    if (!clubPath) return;

    const nav = document.querySelector('.member-section-nav');
    if (!nav) return;

    const legacy = [...nav.querySelectorAll('a,button')].find(el => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const href = (el.getAttribute('href') || '').toLowerCase();
      return /admin\s*\/\s*mod|admin\s*center|mod\s*center/i.test(text)
        || href.endsWith('/admin.html')
        || href.endsWith('/mod.html');
    });

    if (legacy) {
      legacy.textContent = '🛠️ Staff Center';
      legacy.setAttribute('href', '/staff-center.html');
      legacy.hidden = false;
      legacy.removeAttribute('id');
      legacy.classList.add('staff-center-nav-link');
      legacy.dataset.acyStaffCenter = '1';
      return;
    }

    if (!nav.querySelector('[data-acy-staff-center]')) {
      const link = document.createElement('a');
      link.href = '/staff-center.html';
      link.textContent = '🛠️ Staff Center';
      link.className = 'staff-center-nav-link';
      link.dataset.acyStaffCenter = '1';
      nav.appendChild(link);
    }
  };

  const syncFeedAvailability = async () => {
    const buttons = [...document.querySelectorAll('.pet-action-btn[data-pet-action="feed"]')];
    const client = window.__acySupabaseClient;
    if (!buttons.length || !client?.rpc) return;
    try {
      const { data, error } = await client.rpc('get_club_pet');
      if (error || !data) return;
      const full = Number(data.hunger) >= 100;
      buttons.forEach(button => {
        button.disabled = full;
        button.setAttribute('aria-disabled', String(full));
        button.title = full ? 'Dein Tier ist bereits satt.' : 'Futter auswählen';
        const label = button.querySelector('strong') || button;
        if (!button.dataset.acyOriginalFeedLabel) button.dataset.acyOriginalFeedLabel = label.textContent || '🍖 Füttern';
        label.textContent = full ? '🍖 Satt' : button.dataset.acyOriginalFeedLabel;
      });
      if (full) {
        const status = document.getElementById('pet-life-status') || document.getElementById('pet-status');
        if (status) {
          status.textContent = '🐾 Dein Tier ist bereits satt. Es braucht gerade kein Futter.';
          status.className = 'club-auth-status';
        }
      }
    } catch {}
  };

  const loadPetInteractionFix = () => {
    if (!/\/(pet\.html|club-profile\.html)$/i.test(location.pathname)) return;
    if (document.getElementById('acy-v19-pet-interaction-script')) return;
    const script = document.createElement('script');
    script.id = 'acy-v19-pet-interaction-script';
    script.src = '/v19-pet-interaction-fix.js?v=19122';
    script.async = false;
    document.head.appendChild(script);
  };

  const install = () => {
    lockVersionBadge();
    installStaffCenterNav();
    loadPetInteractionFix();
    void syncFeedAvailability();
    setTimeout(() => {
      lockVersionBadge();
      installStaffCenterNav();
      loadPetInteractionFix();
      void syncFeedAvailability();
    }, 1200);

    if (typeof window.petLifeRpc === 'function' && !window.__acyPetLifeRpcRefreshPatched) {
      const originalPetLifeRpc = window.petLifeRpc;
      window.petLifeRpc = async function patchedPetLifeRpc(fn, args = {}, success = 'Erledigt. 🐾') {
        const result = await originalPetLifeRpc(fn, args, success);
        await Promise.allSettled([
          typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve(),
          typeof window.loadQuests === 'function' ? window.loadQuests() : Promise.resolve()
        ]);
        void syncFeedAvailability();
        return result;
      };
      window.__acyPetLifeRpcRefreshPatched = true;
    }

    if (typeof window.performPetAction === 'function' && !window.__acyPerformPetActionRefreshPatched) {
      const originalPerformPetAction = window.performPetAction;
      window.performPetAction = async function patchedPerformPetAction(action, button) {
        const result = await originalPerformPetAction(action, button);
        await Promise.allSettled([
          typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve(),
          typeof window.loadQuests === 'function' ? window.loadQuests() : Promise.resolve()
        ]);
        void syncFeedAvailability();
        return result;
      };
      window.__acyPerformPetActionRefreshPatched = true;
    }
  };

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    setTimeout(install, 0);
  }
})();
