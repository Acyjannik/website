(() => {
  'use strict';

  // V20 Beta.2: mobile-first Club presentation and a single, reliable More menu.
  // IMPORTANT: this layer belongs to club-profile.html only. Pet stays untouched.
  const MOBILE_MAX = 700;
  const IS_CLUB_PAGE = /\/club-profile\.html$/i.test(location.pathname) || location.pathname === '/';
  const DEFERRED = [
    ['member-spotlight', '✨ Spotlight'],
    ['twitch-section', '🔴 Live'],
    ['current-game-card', '🎮 Aktuelles Game'],
    ['progression-catalog', '📈 Fortschritt'],
    ['member-badges-section', '🏅 Badges'],
    ['member-events-section', '📅 Events'],
    ['club-wheel-section', '🎡 Glücksrad'],
    ['daily-streak-section', '🔥 Daily-Serie'],
    ['club-quests-section', '🎯 Quests'],
    ['club-rewards-section', '🎁 Rewards'],
    ['member-news-section', '📰 News'],
    ['club-messages', '💌 Nachrichten'],
    ['club-chat', '💬 Club Chat'],
    ['social-connections-section', '👥 Freunde'],
    ['member-directory-section', '🧑‍🤝‍🧑 Mitglieder'],
    ['clips-section', '🎬 Clips'],
    ['member-leaderboard-section', '🏆 Ranking'],
    ['stats-section', '📊 Statistik'],
    ['discord-section', '🎧 Discord'],
    ['hub-community-games', '🎮 Community Games'],
    ['community-poll', '🗳️ Community Vote'],
    ['notification-settings', '🔔 Benachrichtigungen'],
    ['club-settings-section', '⚙️ Einstellungen']
  ];

  const MORE_GROUPS = [
    ['STREAM & CLUB', [
      ['twitch-section', '🔴 Live'],
      ['current-game-card', '🎮 Aktuelles Game'],
      ['member-spotlight', '✨ Spotlight'],
      ['member-events-section', '📅 Events']
    ]],
    ['PROGRESSION', [
      ['club-wheel-section', '🎡 Glücksrad'],
      ['daily-streak-section', '🔥 Daily-Serie'],
      ['club-quests-section', '🎯 Quests'],
      ['club-rewards-section', '🎁 Rewards'],
      ['progression-catalog', '📈 Fortschritt'],
      ['member-badges-section', '🏅 Badges'],
      ['member-leaderboard-section', '🏆 Ranking'],
      ['stats-section', '📊 Statistik']
    ]],
    ['COMMUNITY', [
      ['member-news-section', '📰 News'],
      ['club-messages', '💌 Privat'],
      ['club-chat', '💬 Club Chat'],
      ['social-connections-section', '👥 Freunde'],
      ['member-directory-section', '🧑‍🤝‍🧑 Mitglieder'],
      ['clips-section', '🎬 Clips'],
      ['hub-community-games', '🎮 Community Games'],
      ['community-poll', '🗳️ Community Vote'],
      ['discord-section', '🎧 Discord']
    ]],
    ['APP & ACCOUNT', [
      ['notification-settings', '🔔 Hinweise'],
      ['club-settings-section', '⚙️ Einstellungen'],
      ['staff-center', '🛡️ Staff Center', '/staff-center.html']
    ]]
  ];

  if (!IS_CLUB_PAGE) return;

  const isMobile = () => window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches;
  const byId = (id) => document.getElementById(id);

  function compactSections() {
    const mobile = isMobile();
    DEFERRED.forEach(([id]) => {
      const el = byId(id);
      if (!el) return;
      if (mobile) {
        if (el.dataset.v20MobileRevealed !== '1') {
          el.hidden = true;
          el.dataset.v20MobileDeferred = '1';
        }
      } else if (el.dataset.v20MobileDeferred === '1') {
        el.hidden = false;
        delete el.dataset.v20MobileDeferred;
      }
    });
  }

  function revealTarget(id) {
    const el = byId(id);
    if (!el) return null;
    el.hidden = false;
    el.dataset.v20MobileRevealed = '1';
    delete el.dataset.v20MobileDeferred;
    return el;
  }

  function closeMore() {
    const sheet = byId('mobile-more-sheet-v181');
    const toggle = byId('mobile-dock-more-v18');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.classList.remove('is-open');
  }

  function buildMoreSheet() {
    const sheet = byId('mobile-more-sheet-v181');
    if (!sheet) return false;
    const grid = sheet.querySelector('.acy-more-grid-v186');
    if (!grid) return false;

    // Legacy scripts may recreate the grid. Version the generated markup so it
    // is rebuilt instead of trusting a stale data flag.
    if (grid.dataset.v20MoreBuilt === '2' && grid.querySelector('[data-v20-more-item]')) return true;

    grid.innerHTML = '';
    MORE_GROUPS.forEach(([groupName, entries]) => {
      const label = document.createElement('div');
      label.className = 'v20-more-group-label';
      label.textContent = groupName;
      grid.appendChild(label);

      entries.forEach(([id, text, href]) => {
        const item = document.createElement(href ? 'a' : 'button');
        item.className = 'v20-more-item';
        item.setAttribute('data-v20-more-item', '1');
        item.setAttribute('aria-label', text.replace(/^\S+\s*/, ''));
        if (href) {
          item.href = href;
          item.dataset.moreHref = href;
        } else {
          item.type = 'button';
          item.dataset.targetId = id;
        }
        item.innerHTML = `<span class="v20-more-icon">${text.match(/^\S+/)?.[0] || ''}</span><span class="v20-more-text">${text.replace(/^\S+\s*/, '')}</span>`;
        grid.appendChild(item);
      });
    });

    grid.dataset.v20MoreBuilt = '2';
    return true;
  }

  function scrollToTarget(target) {
    if (!target) return false;
    revealTarget(target.id);
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const offset = isMobile() ? 112 : 96;
      const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }));
    return true;
  }

  function handleV20MoreClick(event) {
    const item = event.target.closest('#mobile-more-sheet-v181 [data-v20-more-item]');
    if (!item) return;

    // The legacy V18.6 handler also listens on this sheet. Capture phase owns
    // V20 items so the old target-pattern fallback cannot steal the click.
    event.preventDefault();
    event.stopImmediatePropagation();

    if (item.dataset.moreHref) {
      closeMore();
      window.location.assign(item.dataset.moreHref);
      return;
    }

    const target = byId(item.dataset.targetId);
    closeMore();
    if (target) {
      scrollToTarget(target);
      const dock = document.querySelector('.mobile-club-dock');
      dock?.querySelectorAll('[data-dock-key]').forEach((dockItem) => {
        dockItem.classList.remove('is-active');
        dockItem.removeAttribute('aria-current');
      });
    }
  }

  function installMoreHandler() {
    if (document.documentElement.dataset.acyV20MoreGuard === '2') return;
    document.documentElement.dataset.acyV20MoreGuard = '2';
    document.addEventListener('click', handleV20MoreClick, true);
  }

  function installStyles() {
    if (byId('acy-v20-mobile-first-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v20-mobile-first-style';
    style.textContent = `
      @media (max-width:700px){
        body.club-auth-page{padding-bottom:calc(112px + env(safe-area-inset-bottom))!important}

        body.club-auth-page .mobile-club-dock{
          min-height:76px!important;
          padding:8px 10px calc(8px + env(safe-area-inset-bottom))!important;
          gap:4px!important;
          border-radius:24px 24px 0 0!important;
          background:rgba(10,9,15,.96)!important;
          backdrop-filter:blur(24px) saturate(1.15)!important;
          -webkit-backdrop-filter:blur(24px) saturate(1.15)!important;
          box-shadow:0 -12px 36px rgba(0,0,0,.34)!important;
        }
        body.club-auth-page .mobile-club-dock [data-dock-key]{
          min-width:56px!important;
          min-height:58px!important;
          border-radius:18px!important;
          padding:6px 8px!important;
          gap:3px!important;
          font-size:12px!important;
          font-weight:700!important;
          touch-action:manipulation!important;
          -webkit-tap-highlight-color:transparent!important;
        }
        body.club-auth-page .mobile-club-dock [data-dock-key].is-active{transform:translateY(-2px);background:rgba(171,96,255,.18)!important;box-shadow:0 6px 18px rgba(0,0,0,.22)!important}
        body.club-auth-page .mobile-club-dock [data-dock-key] > svg,
        body.club-auth-page .mobile-club-dock [data-dock-key] > i,
        body.club-auth-page .mobile-club-dock [data-dock-key] .icon,
        body.club-auth-page .mobile-club-dock [data-dock-key] .dock-icon,
        body.club-auth-page .mobile-club-dock [data-dock-key] .material-symbols-rounded{
          width:30px!important;height:30px!important;font-size:30px!important;line-height:30px!important;
        }

        body.club-auth-page #mobile-more-sheet-v181{
          left:10px!important;right:10px!important;
          bottom:calc(86px + env(safe-area-inset-bottom))!important;
          max-height:min(80dvh,720px)!important;
          padding:14px!important;border-radius:26px!important;
        }
        body.club-auth-page .acy-more-grid-v186{grid-template-columns:1fr 1fr!important;gap:9px!important}
        body.club-auth-page .v20-more-group-label{grid-column:1/-1;padding:10px 4px 2px;color:rgba(235,220,255,.62);font-size:10px;letter-spacing:.12em;font-weight:800}
        body.club-auth-page .v20-more-item{
          min-height:58px!important;
          display:flex!important;align-items:center!important;justify-content:flex-start!important;
          gap:9px!important;padding:10px 11px!important;
          border:1px solid rgba(180,108,255,.20)!important;border-radius:16px!important;
          background:rgba(255,255,255,.045)!important;color:#f8f4ff!important;
          font:700 14px/1.15 system-ui,sans-serif!important;
          text-align:left!important;touch-action:manipulation!important;
          -webkit-tap-highlight-color:transparent!important;
        }
        body.club-auth-page .v20-more-item:active{transform:scale(.98)}
        body.club-auth-page .v20-more-icon{font-size:21px;line-height:1;flex:0 0 24px;text-align:center}
        body.club-auth-page .v20-more-text{min-width:0}

        /* V20 layout polish is intentionally scoped to Club only. */
        body.club-auth-page .member-dashboard{gap:14px!important}
        body.club-auth-page .member-card,
        body.club-auth-page .member-hub,
        body.club-auth-page .member-hero-card,
        body.club-auth-page .v18-app-home{border-radius:22px!important}
        body.club-auth-page .v18-app-home-head{padding:18px!important}
        body.club-auth-page .v18-action-grid{gap:9px!important}
        body.club-auth-page .v18-action-card{min-height:70px!important;padding:12px!important;border-radius:18px!important}
        body.club-auth-page .member-quick{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media (min-width:701px){
        body.club-auth-page .v20-more-group-label,
        body.club-auth-page .v20-more-item{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    installStyles();
    compactSections();
    buildMoreSheet();
    installMoreHandler();

    const observer = new MutationObserver(() => {
      if (!isMobile()) return;
      compactSections();
      buildMoreSheet();
    });
    if (document.body) observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('resize', compactSections, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  window.ACYV20Mobile = { compactSections, buildMoreSheet, revealTarget };
})();
