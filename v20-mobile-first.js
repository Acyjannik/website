(() => {
  'use strict';

  // V20 Beta.1: keep the Club homepage focused on the essentials on small screens.
  // Navigation remains owned by v18.6-navigation-isolated.js. This layer only
  // changes presentation and supplies data-target-id entries for the existing More handler.
  const MOBILE_MAX = 700;
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
      ['progression-catalog', '📈 Fortschritt'],
      ['member-badges-section', '🏅 Badges'],
      ['daily-streak-section', '🔥 Daily-Serie'],
      ['club-quests-section', '🎯 Quests'],
      ['club-rewards-section', '🎁 Rewards'],
      ['member-leaderboard-section', '🏆 Ranking'],
      ['stats-section', '📊 Statistik']
    ]],
    ['COMMUNITY', [
      ['member-news-section', '📰 News'],
      ['club-messages', '💌 Nachrichten'],
      ['club-chat', '💬 Club Chat'],
      ['social-connections-section', '👥 Freunde'],
      ['member-directory-section', '🧑‍🤝‍🧑 Mitglieder'],
      ['clips-section', '🎬 Clips'],
      ['hub-community-games', '🎮 Community Games'],
      ['community-poll', '🗳️ Community Vote'],
      ['discord-section', '🎧 Discord']
    ]],
    ['APP & ACCOUNT', [
      ['notification-settings', '🔔 Benachrichtigungen'],
      ['club-settings-section', '⚙️ Einstellungen'],
      ['staff-center', '🛡️ Staff Center', '/staff-center.html']
    ]]
  ];

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

  function buildMoreSheet() {
    const sheet = byId('mobile-more-sheet-v181');
    if (!sheet) return false;
    const grid = sheet.querySelector('.acy-more-grid-v186');
    if (!grid) return false;
    if (grid.dataset.v20MoreBuilt === '1') return true;

    grid.innerHTML = '';
    MORE_GROUPS.forEach(([groupName, entries]) => {
      const label = document.createElement('div');
      label.className = 'v20-more-group-label';
      label.textContent = groupName;
      grid.appendChild(label);

      entries.forEach(([id, text, href]) => {
        const item = document.createElement(href ? 'a' : 'button');
        item.type = href ? undefined : 'button';
        item.className = 'v20-more-item';
        item.textContent = text;
        if (href) {
          item.href = href;
          item.dataset.moreHref = href;
        } else {
          item.dataset.targetId = id;
          item.setAttribute('aria-label', text.replace(/^\S+\s*/, ''));
        }
        grid.appendChild(item);
      });
    });

    grid.dataset.v20MoreBuilt = '1';
    return true;
  }

  function installStyles() {
    if (byId('acy-v20-mobile-first-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v20-mobile-first-style';
    style.textContent = `
      @media (max-width:700px){
        body.club-auth-page{padding-bottom:calc(112px + env(safe-area-inset-bottom))!important}
        .mobile-club-dock{
          min-height:76px!important;
          padding:8px 10px calc(8px + env(safe-area-inset-bottom))!important;
          gap:4px!important;
          border-radius:24px 24px 0 0!important;
          background:rgba(10,9,15,.96)!important;
          backdrop-filter:blur(24px) saturate(1.15)!important;
          -webkit-backdrop-filter:blur(24px) saturate(1.15)!important;
          box-shadow:0 -12px 36px rgba(0,0,0,.34)!important;
        }
        .mobile-club-dock [data-dock-key]{
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
        .mobile-club-dock [data-dock-key]::first-line{font-size:inherit}
        .mobile-club-dock [data-dock-key].is-active{transform:translateY(-2px);background:rgba(171,96,255,.18)!important;box-shadow:0 6px 18px rgba(0,0,0,.22)!important}
        .mobile-club-dock [data-dock-key] > svg,
        .mobile-club-dock [data-dock-key] > i,
        .mobile-club-dock [data-dock-key] .icon,
        .mobile-club-dock [data-dock-key] .dock-icon,
        .mobile-club-dock [data-dock-key] .material-symbols-rounded{
          width:30px!important;height:30px!important;font-size:30px!important;line-height:30px!important;
        }
        #mobile-more-sheet-v181{
          left:10px!important;right:10px!important;
          bottom:calc(86px + env(safe-area-inset-bottom))!important;
          max-height:min(76dvh,680px)!important;
          padding:14px!important;border-radius:26px!important;
        }
        .acy-more-grid-v186{grid-template-columns:1fr 1fr!important;gap:9px!important}
        .v20-more-group-label{grid-column:1/-1;padding:10px 4px 2px;color:rgba(235,220,255,.62);font-size:10px;letter-spacing:.12em;font-weight:800}
        .v20-more-item{min-height:52px!important;border:1px solid rgba(180,108,255,.20)!important;border-radius:16px!important;background:rgba(255,255,255,.045)!important;color:#f8f4ff!important;font:700 14px/1.15 system-ui,sans-serif!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
        .v20-more-item:active{transform:scale(.98)}
        .member-dashboard{gap:14px!important}
        .member-card,.member-hub,.member-hero-card,.v18-app-home{border-radius:22px!important}
        .v18-app-home-head{padding:18px!important}
        .v18-action-grid{gap:9px!important}
        .v18-action-card{min-height:70px!important;padding:12px!important;border-radius:18px!important}
        .member-quick{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media (min-width:701px){
        .v20-more-group-label,.v20-more-item{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    installStyles();
    compactSections();
    buildMoreSheet();

    const observer = new MutationObserver(() => {
      if (isMobile()) {
        compactSections();
        buildMoreSheet();
      }
    });
    if (document.body) observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('resize', compactSections, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  window.ACYV20Mobile = { compactSections, buildMoreSheet, revealTarget };
})();
