(() => {
  'use strict';

  const ROUTES = {
    home: {
      label: 'Home', icon: '⌂',
      ids: ['acy-v18-home', 'member-spotlight', 'member-hub', 'current-game-card']
    },
    pet: {
      label: 'Pet', icon: '🐾',
      ids: ['pet-section']
    },
    quests: {
      label: 'Quests', icon: '🎯',
      ids: ['progression-catalog', 'daily-streak-section', 'club-quests-section', 'club-rewards-section']
    },
    social: {
      label: 'Social', icon: '♡',
      ids: ['social-connections-section', 'member-directory-section', 'club-messages', 'club-chat']
    },
    more: {
      label: 'Mehr', icon: '•••',
      ids: [
        'member-badges-section', 'twitch-section', 'member-events-section',
        'member-news-section', 'clips-section', 'member-leaderboard-section',
        'stats-section', 'discord-section', 'community-poll', 'hub-community-games',
        'notification-settings', 'club-settings-section'
      ]
    }
  };

  const TARGET_ROUTE = {};
  Object.entries(ROUTES).forEach(([route, config]) => {
    config.ids.forEach(id => { TARGET_ROUTE[id] = route; });
  });

  function $(id) { return document.getElementById(id); }

  function injectStyles() {
    if ($('acy-v183-app-shell-styles')) return;
    const style = document.createElement('style');
    style.id = 'acy-v183-app-shell-styles';
    style.textContent = `
      :root {
        --acy-shell-bg: rgba(12, 10, 18, .86);
        --acy-shell-line: rgba(183, 105, 255, .18);
        --acy-shell-accent: #a96cff;
        --acy-shell-accent-soft: rgba(169,108,255,.14);
      }

      body.acy-app-shell-ready { padding-bottom: 0; }
      body.acy-app-shell-ready .mobile-club-dock { display: none !important; }

      .acy-app-nav {
        position: sticky;
        top: 10px;
        z-index: 90;
        width: min(1180px, calc(100% - 32px));
        margin: 14px auto 18px;
        padding: 7px;
        display: flex;
        gap: 6px;
        border: 1px solid var(--acy-shell-line);
        border-radius: 22px;
        background: var(--acy-shell-bg);
        backdrop-filter: blur(22px) saturate(130%);
        -webkit-backdrop-filter: blur(22px) saturate(130%);
        box-shadow: 0 18px 50px rgba(0,0,0,.24);
      }

      .acy-app-nav button {
        appearance: none;
        border: 0;
        min-height: 48px;
        flex: 1 1 0;
        padding: 8px 14px;
        border-radius: 16px;
        color: rgba(255,255,255,.68);
        background: transparent;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition: background .18s ease, color .18s ease, transform .18s ease;
        touch-action: manipulation;
      }

      .acy-app-nav button:hover { color: #fff; background: rgba(255,255,255,.06); }
      .acy-app-nav button:active { transform: scale(.98); }
      .acy-app-nav button.is-active {
        color: #fff;
        background: linear-gradient(135deg, rgba(169,108,255,.28), rgba(112,66,180,.16));
        box-shadow: inset 0 0 0 1px rgba(190,130,255,.2), 0 8px 24px rgba(80,40,130,.18);
      }
      .acy-app-nav .acy-nav-icon { display: inline-block; margin-right: 7px; font-size: 17px; }
      .acy-app-nav .acy-nav-label { font-size: 14px; }

      .acy-app-view-head {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto 16px;
        padding: 4px 2px;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 14px;
      }
      .acy-app-view-head .eyebrow { color: #b982ff; }
      .acy-app-view-head h2 { margin: 3px 0 0; font-size: clamp(25px, 3vw, 36px); }
      .acy-app-view-head p { margin: 5px 0 0; color: rgba(255,255,255,.58); }
      .acy-app-view-status {
        flex: 0 0 auto;
        padding: 8px 12px;
        border: 1px solid var(--acy-shell-line);
        border-radius: 999px;
        color: rgba(255,255,255,.68);
        background: rgba(169,108,255,.08);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      body.acy-app-route-sub .member-hero-card { display: none !important; }
      body.acy-app-route-sub .acy-v18-app-home { display: none !important; }
      body.acy-app-route-sub .member-dashboard { padding-top: 0; }

      .acy-route-hidden { display: none !important; }
      .acy-route-visible { animation: acyRouteIn .2s ease both; }
      @keyframes acyRouteIn { from { opacity: .25; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

      @media (max-width: 760px) {
        body.acy-app-shell-ready { padding-bottom: 88px; }
        .acy-app-nav {
          position: fixed;
          left: 10px;
          right: 10px;
          bottom: max(10px, env(safe-area-inset-bottom));
          top: auto;
          width: auto;
          margin: 0;
          padding: 6px;
          border-radius: 24px;
          z-index: 10040;
          box-shadow: 0 16px 45px rgba(0,0,0,.5), 0 0 0 1px rgba(169,108,255,.08);
        }
        .acy-app-nav button { min-height: 58px; padding: 7px 4px; border-radius: 18px; }
        .acy-app-nav .acy-nav-icon { display: block; margin: 0 0 2px; font-size: 18px; line-height: 20px; }
        .acy-app-nav .acy-nav-label { display: block; font-size: 10px; }
        .acy-app-view-head { width: calc(100% - 28px); margin-bottom: 12px; align-items: center; }
        .acy-app-view-head h2 { font-size: 25px; }
        .acy-app-view-head p { display: none; }
        .acy-app-view-status { display: none; }
        .acy-app-shell-ready .club-auth-header { padding-bottom: 4px; }
      }

      @media (min-width: 761px) {
        .acy-app-shell-ready .member-dashboard { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
      }

      @media (prefers-reduced-motion: reduce) {
        .acy-route-visible { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function createNav() {
    if ($('acy-app-nav')) return $('acy-app-nav');
    const nav = document.createElement('nav');
    nav.id = 'acy-app-nav';
    nav.className = 'acy-app-nav';
    nav.setAttribute('aria-label', 'ACY Club Navigation');
    Object.entries(ROUTES).forEach(([route, config]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.route = route;
      button.innerHTML = `<span class="acy-nav-icon" aria-hidden="true">${config.icon}</span><span class="acy-nav-label">${config.label}</span>`;
      button.addEventListener('click', () => navigate(route));
      nav.appendChild(button);
    });

    const header = document.querySelector('.club-auth-header');
    if (header?.parentNode) header.parentNode.insertBefore(nav, header.nextSibling);
    else document.body.prepend(nav);
    return nav;
  }

  function ensureViewHeads() {
    Object.entries(ROUTES).forEach(([route, config]) => {
      if (route === 'home') return;
      const first = config.ids.map(id => $(id)).find(Boolean);
      if (!first || $(`acy-view-head-${route}`)) return;
      const head = document.createElement('div');
      head.id = `acy-view-head-${route}`;
      head.className = 'acy-app-view-head';
      head.innerHTML = `<div><span class="eyebrow">ACY CLUB</span><h2>${config.label}</h2><p>${viewDescription(route)}</p></div><span class="acy-app-view-status">APP VIEW</span>`;
      first.parentNode.insertBefore(head, first);
    });
  }

  function viewDescription(route) {
    return ({
      pet: 'Dein Begleiter, Pflege, Energie und Fortschritt.',
      quests: 'XP sammeln, tägliche Serien halten und Belohnungen holen.',
      social: 'Freunde, Mitglieder, private Nachrichten und Live-Chat.',
      more: 'Weitere Club-Funktionen, Statistiken und Einstellungen.'
    })[route] || '';
  }

  function resolveRoute(raw) {
    const value = String(raw || '').replace(/^#/, '').trim().toLowerCase();
    if (ROUTES[value]) return value;
    if (TARGET_ROUTE[value]) return TARGET_ROUTE[value];
    return 'home';
  }

  function setRouteVisibility(route) {
    Object.entries(ROUTES).forEach(([key, config]) => {
      const active = key === route;
      config.ids.forEach(id => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle('acy-route-hidden', !active);
        el.classList.toggle('acy-route-visible', active);
        if (!active && el.tagName === 'DETAILS') el.open = false;
      });
      const head = $(`acy-view-head-${key}`);
      if (head) head.classList.toggle('acy-route-hidden', !active);
      document.querySelectorAll(`[data-route="${key}"]`).forEach(button => {
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
      });
    });

    document.body.classList.toggle('acy-app-route-sub', route !== 'home');
    document.body.dataset.acyAppRoute = route;
  }

  function navigate(route, { replace = false, scroll = true } = {}) {
    const safeRoute = ROUTES[route] ? route : 'home';
    const url = `#${safeRoute}`;
    if (replace) history.replaceState({ acyRoute: safeRoute }, '', url);
    else history.pushState({ acyRoute: safeRoute }, '', url);
    setRouteVisibility(safeRoute);
    if (scroll) window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function bindLegacyLinks() {
    document.addEventListener('click', event => {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor) return;
      const target = anchor.getAttribute('href')?.slice(1);
      const route = TARGET_ROUTE[target];
      if (!route) return;
      event.preventDefault();
      navigate(route);
    }, true);
  }

  function init() {
    if (!document.body?.classList.contains('club-auth-page')) return;
    injectStyles();
    createNav();
    ensureViewHeads();
    bindLegacyLinks();
    document.body.classList.add('acy-app-shell-ready');

    const initial = resolveRoute(location.hash);
    navigate(initial, { replace: true, scroll: false });
    window.addEventListener('popstate', () => setRouteVisibility(resolveRoute(location.hash)));
    window.addEventListener('hashchange', () => setRouteVisibility(resolveRoute(location.hash)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
