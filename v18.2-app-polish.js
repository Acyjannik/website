(() => {
  const APP_VERSION = 'V18.4.1';

  const loadStyles = () => {
    if (document.getElementById('acy-v182-app-polish')) return;
    const link = document.createElement('link');
    link.id = 'acy-v182-app-polish';
    link.rel = 'stylesheet';
    link.href = '/v18.2-app-polish.css?v=1841';
    document.head.appendChild(link);
  };

  const interactiveSelector = 'button, .button, [role="button"]';
  const ignoreSelector = '#mobile-dock-more-v18, .notification-filter, .quest-tab, .member-filter, summary';

  function initPressFeedback() {
    document.addEventListener('pointerdown', (event) => {
      const el = event.target.closest(interactiveSelector);
      if (!el || el.matches(ignoreSelector) || el.disabled) return;
      el.dataset.acyPressing = 'true';
    }, { capture: true, passive: true });

    const clear = (event) => {
      const el = event.target?.closest?.(interactiveSelector);
      if (el) delete el.dataset.acyPressing;
    };
    document.addEventListener('pointerup', clear, true);
    document.addEventListener('pointercancel', clear, true);
    document.addEventListener('pointerleave', clear, true);

    document.addEventListener('click', (event) => {
      const el = event.target.closest(interactiveSelector);
      if (!el || el.matches(ignoreSelector) || el.disabled || el.dataset.acyNoBusy !== undefined) return;
      delete el.dataset.acyPressing;
      if (el.type === 'submit' || el.matches('.button-primary,.button-secondary,.event-attend-btn,.club-chat-send')) {
        el.dataset.acyBusy = 'true';
        setTimeout(() => delete el.dataset.acyBusy, 700);
      }
    }, true);
  }

  function installVersionBadge() {
    const render = () => {
      let badge = document.getElementById('acy-dev-version-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'acy-dev-version-badge';
        badge.className = 'acy-dev-version-badge';
        document.body.appendChild(badge);
      }
      badge.textContent = `●  ${APP_VERSION}  DEV`;
      badge.dataset.version = APP_VERSION;
    };
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  function scrollToTarget(target) {
    if (!target) return false;
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return true;
  }

  function installSafeDockNavigation() {
    const navigate = (key) => {
      const targets = {
        home: '#acy-v18-home',
        pet: '#pet-section',
        quests: '#club-quests-section',
        social: '#social-connections-section'
      };
      const target = document.querySelector(targets[key] || '');
      if (scrollToTarget(target)) document.body.dataset.acyAppView = key;
    };

    document.addEventListener('click', (event) => {
      const item = event.target.closest('.mobile-club-dock [data-dock-key]');
      if (!item) return;
      const key = item.dataset.dockKey;
      if (key === 'more') return;
      if (key === 'social' && !document.querySelector('#social-connections-section')) {
        const fallback = document.querySelector('#club-messages, #club-chat, #member-directory-section');
        if (fallback) {
          event.preventDefault();
          scrollToTarget(fallback);
        }
        return;
      }
      if (key === 'home' || key === 'pet' || key === 'quests' || key === 'social') {
        event.preventDefault();
        navigate(key);
      }
    }, false);
  }

  function hardenMoreButton() {
    const fix = () => {
      const toggle = document.getElementById('mobile-dock-more-v18');
      if (!toggle || toggle.dataset.acyMoreHardened === 'true') return;
      toggle.dataset.acyMoreHardened = 'true';
      toggle.setAttribute('type', 'button');
      toggle.addEventListener('click', (event) => {
        const sheet = document.getElementById('mobile-more-sheet-v181');
        if (!sheet) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const open = sheet.hidden;
        sheet.hidden = !open;
        document.body.classList.toggle('mobile-more-open-v181', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }, true);
    };
    fix();
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true });
  }

  function installCompactAppLayout() {
    if (document.getElementById('acy-v184-safe-layout')) return;
    const style = document.createElement('style');
    style.id = 'acy-v184-safe-layout';
    style.textContent = `
      .acy-dev-version-badge{position:fixed;top:max(9px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12000;padding:7px 13px;border:1px solid rgba(168,85,247,.42);border-radius:999px;background:rgba(11,11,16,.9);backdrop-filter:blur(16px);color:#f7f3ff;font:700 13px/1 system-ui,sans-serif;letter-spacing:.04em;box-shadow:0 8px 30px rgba(0,0,0,.28);pointer-events:none;white-space:nowrap}
      @media(max-width:700px){
        .club-auth-page .member-dashboard{padding-bottom:116px}
        .club-auth-page .member-card,.club-auth-page .member-fold,.club-auth-page .member-hub,.club-auth-page .v18-app-home{margin-bottom:12px}
        .club-auth-page .member-card-head{margin-bottom:10px}
        .club-auth-page .member-card-head p{max-width:58ch}
        .club-auth-page .member-fold-summary{min-height:68px}
        .club-auth-page .member-fold-body{padding-top:14px;padding-bottom:14px}
        .club-auth-page .member-quick{gap:8px}
        .club-auth-page .member-quick>div{padding:10px 8px}
        .acy-dev-version-badge{top:max(8px,env(safe-area-inset-top));font-size:12px;padding:6px 11px}
      }
      @media(min-width:701px){
        .club-auth-page .member-dashboard{row-gap:14px}
        .club-auth-page .member-card,.club-auth-page .member-fold{margin-bottom:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function initAppDensity() {
    document.body.classList.add('acy-v182-app-mode');
  }

  function init() {
    loadStyles();
    initAppDensity();
    initPressFeedback();
    installVersionBadge();
    installSafeDockNavigation();
    hardenMoreButton();
    installCompactAppLayout();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
