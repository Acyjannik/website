(() => {
  const $ = (id) => document.getElementById(id);
  const views = {
    home: ['#acy-v18-home', '#member-spotlight', '#member-hub'],
    quests: ['#member-badges-section', '#progression-catalog', '#member-events-section', '#club-wheel-section', '#daily-streak-section', '#club-quests-section', '#club-rewards-section'],
    social: ['#club-messages', '#club-chat', '#social-connections-section', '#member-directory-section'],
    more: ['#member-news-section', '#clips-section', '#member-leaderboard-section', '#stats-section', '#discord-section', '#member-events-section', '#club-wheel-section', '#progression-catalog']
  };

  function targetFor(view) {
    const first = views[view]?.find(id => $(id));
    return first ? $(first) : null;
  }

  function setView(view, scroll = true) {
    if (!views[view]) return;
    document.body.dataset.acyAppView = view;
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item => {
      item.classList.toggle('is-active', item.dataset.dockKey === view);
    });
    if (scroll) {
      const target = targetFor(view);
      if (target) {
        if (target.matches('details')) target.open = true;
        requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      } else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function openTarget(hash, view = 'more') {
    if (!hash?.startsWith('#')) return false;
    const target = document.querySelector(hash);
    if (!target) return false;
    document.body.dataset.acyAppView = view;
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return true;
  }

  function installSmartNavigation() {
    document.addEventListener('click', (event) => {
      const dock = event.target.closest('.mobile-club-dock [data-dock-key]');
      if (dock) {
        const key = dock.dataset.dockKey;
        if (key === 'more') return;
        if (key === 'pet') return;
        event.preventDefault();
        setView(key);
        return;
      }

      const sheetLink = event.target.closest('#mobile-more-sheet-v181 a[href^="#"]');
      if (sheetLink) {
        const hash = sheetLink.getAttribute('href');
        if (openTarget(hash, 'more')) {
          event.preventDefault();
          const sheet = $('mobile-more-sheet-v181');
          const toggle = $('mobile-dock-more-v18');
          if (sheet) sheet.hidden = true;
          document.body.classList.remove('mobile-more-open-v181');
          toggle?.setAttribute('aria-expanded', 'false');
        }
      }
    }, true);

    // Make existing Home / Quests / Social links behave like app tabs too.
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || link.closest('#mobile-more-sheet-v181')) return;
      const hash = link.getAttribute('href');
      const map = { '#acy-v18-home':'home', '#club-quests-section':'quests', '#club-messages':'social' };
      if (map[hash]) {
        event.preventDefault();
        setView(map[hash]);
      }
    }, true);

    // If a user opens a section from another area, keep that section visible.
    document.addEventListener('toggle', (event) => {
      const details = event.target.closest('details.member-fold');
      if (!details || !details.open) return;
      const id = `#${details.id}`;
      if (views.quests.includes(id)) document.body.dataset.acyAppView = 'quests';
      if (views.social.includes(id)) document.body.dataset.acyAppView = 'social';
    }, true);
  }

  function installCompactLayout() {
    if ($('acy-v184-smart-layout')) return;
    const style = document.createElement('style');
    style.id = 'acy-v184-smart-layout';
    style.textContent = `
      /* App views keep the information, they simply move it behind the relevant tab. */
      body[data-acy-app-view="home"] .member-dashboard > details.member-fold,
      body[data-acy-app-view="home"] .member-dashboard > .badges-section-v11 { display:none !important; }
      body[data-acy-app-view="quests"] .member-dashboard > section:not(#member-badges-section),
      body[data-acy-app-view="quests"] .member-dashboard > details:not(#progression-catalog):not(#member-events-section):not(#club-wheel-section):not(#daily-streak-section):not(#club-quests-section):not(#club-rewards-section) { display:none !important; }
      body[data-acy-app-view="social"] .member-dashboard > section,
      body[data-acy-app-view="social"] .member-dashboard > details:not(#club-messages):not(#club-chat):not(#social-connections-section):not(#member-directory-section) { display:none !important; }
      @media (max-width:700px) {
        body[data-acy-app-view="home"] .member-dashboard > #member-spotlight,
        body[data-acy-app-view="home"] .member-dashboard > #member-hub { display:block !important; }
        .member-fold-summary-main small { font-size:12px !important; line-height:1.3 !important; opacity:.72; }
        .member-fold-summary { gap:10px !important; }
        .member-fold-summary-side { flex-shrink:0 !important; }
        .member-card-head p { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      }
      @media (min-width:701px) {
        body[data-acy-app-view="home"] .member-dashboard > details.member-fold,
        body[data-acy-app-view="home"] .member-dashboard > .badges-section-v11 { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    installCompactLayout();
    installSmartNavigation();
    if (!document.body.dataset.acyAppView) document.body.dataset.acyAppView = 'home';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
