(() => {
  const $ = (id) => document.getElementById(id);
  const APP_VERSION = 'V18.4.0';

  function loadV182Polish() {
    if (document.getElementById('acy-v182-polish-script')) return;
    const script = document.createElement('script');
    script.id = 'acy-v182-polish-script';
    script.src = '/v18.2-app-polish.js?v=1821';
    script.defer = true;
    document.head.appendChild(script);
  }

  function openNotifications() {
    const panel = $('notification-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('v181-open');
    document.body.classList.add('acy-notifications-open-v182');
    if (typeof window.loadNotifications === 'function') window.loadNotifications().catch(() => {});
  }

  function closeNotifications() {
    const panel = $('notification-panel');
    if (panel) { panel.hidden = true; panel.classList.remove('v181-open'); }
    document.body.classList.remove('acy-notifications-open-v182');
  }

  function getSupabaseAccessToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
      }
    } catch (error) { console.warn('[V18.4] Could not read auth session:', error); }
    return null;
  }

  async function notificationAction(action) {
    const token = getSupabaseAccessToken();
    if (!token) throw new Error('Deine Sitzung ist abgelaufen.');
    const response = await fetch(`/api/club-notifications?action=${encodeURIComponent(action)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Benachrichtigungen konnten nicht aktualisiert werden.');
    return data;
  }

  async function handleNotificationAction(action, button) {
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      await notificationAction(action);
      if (typeof window.loadNotifications === 'function') await window.loadNotifications();
    } catch (error) {
      console.warn(`[V18.4] Notification action ${action} failed:`, error);
      if (typeof window.setAcyRefreshStatus === 'function') window.setAcyRefreshStatus(error?.message || 'Benachrichtigungen konnten nicht aktualisiert werden.', 'error');
    } finally { if (button) button.disabled = false; }
  }

  function injectNotificationMobileFixes() {
    if ($('acy-v182-notification-mobile-fixes')) return;
    const style = document.createElement('style');
    style.id = 'acy-v182-notification-mobile-fixes';
    style.textContent = `
      #notification-panel[hidden] { display:none !important; }
      @media (max-width:700px) {
        #notification-panel { position:fixed !important; z-index:10050 !important; top:max(12px,env(safe-area-inset-top)) !important; left:12px !important; right:12px !important; width:auto !important; max-height:calc(100dvh - 92px) !important; overflow:auto !important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding-bottom:max(18px,env(safe-area-inset-bottom)) !important; }
        #notification-panel .notification-panel-head { position:sticky !important; top:0 !important; z-index:4 !important; gap:10px !important; flex-wrap:wrap !important; background:rgba(11,11,16,.96) !important; backdrop-filter:blur(18px) !important; }
        #notification-panel .notification-panel-head > strong { flex:1 1 100% !important; font-size:22px !important; }
        #notification-panel .notification-panel-actions { display:flex !important; width:100% !important; gap:8px !important; }
        #notification-panel .notification-panel-actions button { min-height:42px !important; padding:9px 13px !important; flex:1 1 auto !important; touch-action:manipulation !important; }
        #notification-panel .notification-panel-actions #notification-close { flex:0 0 44px !important; font-size:22px !important; }
        #notification-panel .notification-filter-row { position:sticky !important; top:96px !important; z-index:3 !important; background:rgba(11,11,16,.94) !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function smartScrollTo(target) {
    if (!target) return false;
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'start' }));
    return true;
  }

  function navigateToHash(hash) {
    if (!hash || !hash.startsWith('#')) return false;
    const target = document.querySelector(hash);
    return smartScrollTo(target);
  }

  function initNotifications() {
    injectNotificationMobileFixes();
    document.addEventListener('click', (event) => {
      const bell = event.target.closest('#notification-bell');
      if (bell) { event.preventDefault(); event.stopImmediatePropagation(); const panel = $('notification-panel'); panel?.hidden ? openNotifications() : closeNotifications(); return; }
      const close = event.target.closest('#notification-close');
      if (close) { event.preventDefault(); event.stopImmediatePropagation(); closeNotifications(); return; }
      const readAll = event.target.closest('#notification-read-all');
      if (readAll) { event.preventDefault(); event.stopImmediatePropagation(); handleNotificationAction('mark_all_read', readAll); return; }
      const clearAll = event.target.closest('#notification-clear-all');
      if (clearAll) { event.preventDefault(); event.stopImmediatePropagation(); handleNotificationAction('clear_all', clearAll); return; }
      const openCard = event.target.closest('#v18-open-notifications');
      if (openCard) { event.preventDefault(); openNotifications(); return; }
      const dockNotification = event.target.closest('#mobile-dock-notifications-v18');
      if (dockNotification) { event.preventDefault(); openNotifications(); }
    }, true);
    $('mobile-more-notification-count-v181')?.setAttribute('aria-live','polite');
  }

  function initMoreSheet() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (!sheet || !toggle) return;
    const close = () => { sheet.hidden = true; document.body.classList.remove('mobile-more-open-v181'); toggle.setAttribute('aria-expanded','false'); };
    const open = () => { sheet.hidden = false; document.body.classList.add('mobile-more-open-v181'); toggle.setAttribute('aria-expanded','true'); };
    toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); if (sheet.hidden) open(); else close(); }, true);
    sheet.addEventListener('click', (event) => {
      const closeTarget = event.target.closest('[data-close-more]');
      if (closeTarget) { close(); return; }
      const notificationTarget = event.target.closest('[data-open-notifications-v181]');
      if (notificationTarget) { event.preventDefault(); close(); openNotifications(); return; }
      const link = event.target.closest('a[href^="#"]');
      if (link) { const hash = link.getAttribute('href'); if (navigateToHash(hash)) { event.preventDefault(); close(); } }
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  function initDock() {
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item => {
      item.addEventListener('click', (event) => {
        const key = item.dataset.dockKey;
        if (key === 'more') return;
        document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(el => el.classList.remove('is-active'));
        item.classList.add('is-active');
        if (key === 'pet') return;
        event.preventDefault();
        const targets = { home:'#acy-v18-home', quests:'#club-quests-section', social:'#social-connections-section' };
        navigateToHash(targets[key]);
      }, true);
    });
  }

  function injectAppNavigationPolish() {
    if ($('acy-v184-app-nav')) return;
    const style = document.createElement('style');
    style.id = 'acy-v184-app-nav';
    style.textContent = `
      .acy-dev-version-badge[data-version="${APP_VERSION}"] { position:fixed; top:max(10px,env(safe-area-inset-top)); left:50%; transform:translateX(-50%); z-index:12000; padding:7px 13px; border:1px solid rgba(168,85,247,.42); border-radius:999px; background:rgba(11,11,16,.88); backdrop-filter:blur(16px); color:#f7f3ff; font:700 13px/1 system-ui,sans-serif; letter-spacing:.04em; box-shadow:0 8px 30px rgba(0,0,0,.25); pointer-events:none; }
      @media (max-width:700px) {
        header nav, .club-auth-header > nav { display:none !important; }
        .mobile-club-dock { position:fixed !important; left:12px !important; right:12px !important; bottom:max(10px,env(safe-area-inset-bottom)) !important; z-index:11000 !important; }
        .mobile-more-sheet-v181 { position:fixed !important; inset:0 !important; z-index:10990 !important; }
        .mobile-more-backdrop-v181 { position:absolute !important; inset:0 !important; background:rgba(0,0,0,.62) !important; backdrop-filter:blur(6px); }
        .mobile-more-panel-v181 { position:absolute !important; left:12px !important; right:12px !important; bottom:calc(86px + env(safe-area-inset-bottom)) !important; max-height:min(72dvh,620px) !important; overflow:auto !important; border-radius:24px !important; }
        body.mobile-more-open-v181 { overflow:hidden !important; }
        .acy-dev-version-badge[data-version="${APP_VERSION}"] { top:max(8px,env(safe-area-inset-top)); }
        .member-fold-summary-main small { max-height:2.5em; overflow:hidden; }
        .member-dashboard > .member-card, .member-dashboard > .member-fold { margin-bottom:12px; }
        .member-fold-summary { min-height:74px; }
      }
      @media (min-width:701px) { .mobile-club-dock, .mobile-more-sheet-v181 { display:none !important; } }
    `;
    document.head.appendChild(style);
  }

  function installVersionBadge() {
    const update = () => {
      document.querySelectorAll('[class*="build"], [class*="version"]').forEach(el => {
        if (/ACY\s*BUILD\s*V18\.1/i.test(el.textContent || '')) el.remove();
      });
      let badge = document.querySelector('.acy-dev-version-badge');
      if (!badge) { badge = document.createElement('div'); badge.className='acy-dev-version-badge'; document.body.appendChild(badge); }
      badge.dataset.version = APP_VERSION;
      badge.textContent = `●  ${APP_VERSION}  DEV`;
      badge.setAttribute('aria-label', `${APP_VERSION} Development`);
    };
    update();
    new MutationObserver(update).observe(document.body, { childList:true, subtree:true });
  }

  function syncLiveSummary() {
    const target = $('v18-live-summary'); if (!target) return;
    const liveText = $('member-live-text')?.textContent?.trim();
    const game = $('member-twitch-game')?.textContent?.trim();
    const viewers = $('member-twitch-viewers')?.textContent?.trim();
    if (liveText === 'LIVE' || liveText === 'LIVE NOW' || $('member-live-pill')?.classList.contains('is-live')) target.textContent = `LIVE${game && game !== '–' ? ` · ${game}` : ''}${viewers && viewers !== '–' ? ` · ${viewers} Zuschauer` : ''}`;
    else if (liveText && liveText !== 'CHECKING') target.textContent = 'Offline · beim nächsten Stream wieder dabei';
  }

  function init() {
    loadV182Polish();
    initNotifications();
    initMoreSheet();
    initDock();
    injectAppNavigationPolish();
    installVersionBadge();
    const observer = new MutationObserver(syncLiveSummary);
    ['member-live-text','member-twitch-game','member-twitch-viewers','member-live-pill'].forEach(id => { const el=$(id); if(el) observer.observe(el,{childList:true,subtree:true,attributes:true,characterData:true}); });
    syncLiveSummary();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
