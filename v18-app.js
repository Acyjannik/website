(() => {
  const VERSION = 'V18.5.6';
  const $ = (id) => document.getElementById(id);
  const ready = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

  function openNotifications() {
    const panel = $('notification-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('v181-open');
    if (typeof window.loadNotifications === 'function') window.loadNotifications().catch(() => {});
  }
  function closeNotifications() {
    const panel = $('notification-panel');
    if (panel) { panel.hidden = true; panel.classList.remove('v181-open'); }
  }
  function initNotifications() {
    $('notification-bell')?.addEventListener('click', (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      const panel = $('notification-panel');
      if (!panel) return;
      if (panel.hidden) openNotifications(); else closeNotifications();
    }, true);
    $('notification-close')?.addEventListener('click', closeNotifications, true);
    $('v18-open-notifications')?.addEventListener('click', openNotifications, true);
    $('mobile-dock-notifications-v18')?.addEventListener('click', openNotifications, true);
    $('mobile-more-notification-count-v181')?.setAttribute('aria-live', 'polite');
  }

  function installVersionBadge() {
    let badge = $('acy-dev-version-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-dev-version-badge';
      document.body.appendChild(badge);
    }
    badge.textContent = `● ${VERSION} · DEV`;
    badge.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12000;padding:7px 12px;border:1px solid rgba(180,108,255,.42);border-radius:999px;background:rgba(11,11,16,.94);backdrop-filter:blur(18px);color:#f7f3ff;font:700 12px/1 system-ui,sans-serif;letter-spacing:.05em;pointer-events:none;white-space:nowrap;';
  }

  function closeMore() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'false');
  }
  function openMore() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (!sheet) return false;
    sheet.hidden = false;
    document.body.classList.add('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'true');
    return true;
  }

  const targetIds = {
    home: ['acy-v18-home', 'member-spotlight', 'member-hub'],
    quests: ['club-quests-section', 'member-badges-section', 'club-rewards-section', 'club-daily-section', 'daily-section'],
    social: ['social-connections-section', 'club-messages', 'club-chat', 'member-directory-section', 'member-friends-section', 'club-friends']
  };
  function isVisible(el) {
    return !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  }
  function findTarget(key) {
    for (const id of (targetIds[key] || [])) {
      const el = document.getElementById(id);
      if (isVisible(el)) return el;
    }
    const pattern = key === 'social'
      ? /Nachrichten|Direktnachrichten|Chat|Freunde|Mitglieder/i
      : /Quests|Daily|Rewards|Belohnungen|Badges|Glücksrad/i;
    return [...document.querySelectorAll('details.member-card,details.member-fold,.member-card,.member-fold,section')]
      .find(el => pattern.test((el.querySelector('summary')?.textContent || el.textContent || '').trim()) && isVisible(el)) || null;
  }
  function setActive(key) {
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(el => {
      const active = el.dataset.dockKey === key;
      el.classList.toggle('is-active', active);
      if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }
  function scrollToTarget(target) {
    if (!target) return;
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const offset = window.matchMedia('(max-width:700px)').matches ? 112 : 92;
      const y = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }));
  }
  function navigate(key) {
    if (key === 'more') { setActive('more'); openMore(); return; }
    if (key === 'pet') {
      setActive('pet');
      window.location.href = '/pet.html';
      return;
    }
    const target = findTarget(key);
    if (!target) return;
    closeMore();
    setActive(key);
    scrollToTarget(target);
  }

  function captureDockClicks() {
    document.addEventListener('click', (event) => {
      const item = event.target.closest('.mobile-club-dock [data-dock-key]');
      if (!item) return;
      const key = item.dataset.dockKey;
      if (!key) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(key);
    }, true);
  }
  function captureMoreLinks() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('#mobile-more-sheet-v181 a[href^="#"]');
      if (!link) return;
      const id = (link.getAttribute('href') || '').slice(1);
      const target = document.getElementById(id);
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!target) return;
      const details = target.closest('details');
      if (details) details.open = true;
      closeMore();
      scrollToTarget(target);
    }, true);
  }
  function initMoreSheet() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (!sheet || !toggle) return;
    toggle.setAttribute('aria-expanded', 'false');
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMore(); });
    sheet.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-more]')) closeMore();
      if (event.target.closest('[data-open-notifications-v181]')) { closeMore(); openNotifications(); }
    }, true);
  }

  function syncLiveSummary() {
    const target = $('v18-live-summary');
    if (!target) return;
    const liveText = $('member-live-text')?.textContent?.trim();
    const game = $('member-twitch-game')?.textContent?.trim();
    const viewers = $('member-twitch-viewers')?.textContent?.trim();
    if (liveText === 'LIVE' || liveText === 'LIVE NOW' || $('member-live-pill')?.classList.contains('is-live')) {
      target.textContent = `LIVE${game && game !== '–' ? ` · ${game}` : ''}${viewers && viewers !== '–' ? ` · ${viewers} Zuschauer` : ''}`;
    } else if (liveText && liveText !== 'CHECKING') target.textContent = 'Offline · beim nächsten Stream wieder dabei';
  }

  function init() {
    installVersionBadge();
    initNotifications();
    initMoreSheet();
    captureDockClicks();
    captureMoreLinks();
    const observer = new MutationObserver(syncLiveSummary);
    ['member-live-text','member-twitch-game','member-twitch-viewers','member-live-pill'].forEach(id => {
      const el = $(id);
      if (el) observer.observe(el, { childList:true, subtree:true, attributes:true, characterData:true });
    });
    syncLiveSummary();
  }
  ready(init);
})();
