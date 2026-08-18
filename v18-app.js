(() => {
  const $ = (id) => document.getElementById(id);

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
      event.preventDefault();
      const panel = $('notification-panel');
      if (!panel) return;
      if (panel.hidden) openNotifications(); else closeNotifications();
    }, true);
    $('notification-close')?.addEventListener('click', closeNotifications, true);
    $('v18-open-notifications')?.addEventListener('click', openNotifications);
    $('mobile-dock-notifications-v18')?.addEventListener('click', openNotifications);
    $('mobile-more-notification-count-v181')?.setAttribute('aria-live', 'polite');
  }

  function initMoreSheet() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (!sheet || !toggle) return;
    const close = () => { sheet.hidden = true; document.body.classList.remove('mobile-more-open-v181'); };
    toggle.addEventListener('click', () => { sheet.hidden = !sheet.hidden; document.body.classList.toggle('mobile-more-open-v181', !sheet.hidden); });
    sheet.querySelectorAll('[data-close-more]').forEach(el => el.addEventListener('click', close));
    sheet.querySelector('[data-open-notifications-v181]')?.addEventListener('click', () => { close(); openNotifications(); });
    sheet.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', close));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  function initDock() {
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.dockKey === 'more') return;
        document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(el => el.classList.remove('is-active'));
        item.classList.add('is-active');
      });
    });
  }

  function syncLiveSummary() {
    const target = $('v18-live-summary');
    if (!target) return;
    const liveText = $('member-live-text')?.textContent?.trim();
    const game = $('member-twitch-game')?.textContent?.trim();
    const viewers = $('member-twitch-viewers')?.textContent?.trim();
    if (liveText === 'LIVE' || liveText === 'LIVE NOW' || $('member-live-pill')?.classList.contains('is-live')) {
      target.textContent = `LIVE${game && game !== '–' ? ` · ${game}` : ''}${viewers && viewers !== '–' ? ` · ${viewers} Zuschauer` : ''}`;
    } else if (liveText && liveText !== 'CHECKING') {
      target.textContent = 'Offline · beim nächsten Stream wieder dabei';
    }
  }

  function init() {
    initNotifications();
    initMoreSheet();
    initDock();
    const observer = new MutationObserver(syncLiveSummary);
    ['member-live-text', 'member-twitch-game', 'member-twitch-viewers', 'member-live-pill'].forEach(id => {
      const el = $(id);
      if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    });
    syncLiveSummary();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
