(() => {
  const $ = (id) => document.getElementById(id);
  const openNotifications = () => {
    const bell = $('notification-bell');
    if (bell) bell.click();
  };

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
    $('v18-open-notifications')?.addEventListener('click', openNotifications);
    $('mobile-dock-notifications-v18')?.addEventListener('click', openNotifications);

    document.querySelectorAll('.mobile-club-dock a[href^="#"]').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelectorAll('.mobile-club-dock a, .mobile-club-dock button').forEach(el => el.classList.remove('is-active'));
        link.classList.add('is-active');
      });
    });
    $('mobile-dock-notifications-v18')?.addEventListener('click', () => {
      document.querySelectorAll('.mobile-club-dock a, .mobile-club-dock button').forEach(el => el.classList.remove('is-active'));
      $('mobile-dock-notifications-v18').classList.add('is-active');
    });

    const observer = new MutationObserver(syncLiveSummary);
    ['member-live-text', 'member-twitch-game', 'member-twitch-viewers', 'member-live-pill'].forEach(id => {
      const el = $(id);
      if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    });
    syncLiveSummary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
