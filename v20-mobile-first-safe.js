(() => {
  'use strict';
  const MOBILE_MAX = 700;
  const IS_CLUB_PAGE = /\/club-profile\.html$/i.test(location.pathname) || location.pathname === '/';
  const IS_PET_PAGE = /\/pet\.html$/i.test(location.pathname);
  if (!IS_CLUB_PAGE && !IS_PET_PAGE) return;

  const $ = id => document.getElementById(id);
  const isMobile = () => window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches;
  const DEFERRED = [
    'member-spotlight','twitch-section','current-game-card','progression-catalog','member-badges-section','member-events-section',
    'club-wheel-section','daily-streak-section','club-quests-section','club-rewards-section','member-news-section','club-messages',
    'club-chat','social-connections-section','member-directory-section','clips-section','member-leaderboard-section','stats-section',
    'discord-section','hub-community-games','community-poll','notification-settings','club-settings-section'
  ];
  const CLUB_MORE = [
    ['STREAM & CLUB', [['twitch-section','🔴 Live'],['current-game-card','🎮 Aktuelles Game'],['member-spotlight','✨ Spotlight'],['member-events-section','📅 Events']]],
    ['PROGRESSION', [['club-wheel-section','🎡 Glücksrad'],['daily-streak-section','🔥 Daily-Serie'],['club-quests-section','🎯 Quests'],['club-rewards-section','🎁 Rewards'],['progression-catalog','📈 Fortschritt'],['member-badges-section','🏅 Badges'],['member-leaderboard-section','🏆 Ranking'],['stats-section','📊 Statistik']]],
    ['COMMUNITY', [['member-news-section','📰 News'],['club-messages','💌 Privat'],['club-chat','💬 Club Chat'],['social-connections-section','👥 Freunde'],['member-directory-section','🧑‍🤝‍🧑 Mitglieder'],['clips-section','🎬 Clips'],['hub-community-games','🎮 Community Games'],['community-poll','🗳️ Community Vote'],['discord-section','🎧 Discord']]],
    ['APP & ACCOUNT', [['notification-settings','🔔 Hinweise'],['club-settings-section','⚙️ Einstellungen'],['staff-center','🛡️ Staff Center','/staff-center.html']]]
  ];
  const MORE_GROUPS = IS_PET_PAGE
    ? CLUB_MORE.map(([g,e]) => [g,e.map(([id,text,href]) => [id,text,href || `/club-profile.html#${id}`])])
    : CLUB_MORE;

  function labelBetaVersion() {
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent.trim() === 'V19.0.0') el.textContent = 'V20.0 BETA';
    });
  }

  function compactSections() {
    if (!IS_CLUB_PAGE) return;
    DEFERRED.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (isMobile()) {
        if (el.dataset.v20MobileRevealed !== '1' && !el.hidden) {
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
    const el = $(id);
    if (!el) return null;
    el.hidden = false;
    el.dataset.v20MobileRevealed = '1';
    delete el.dataset.v20MobileDeferred;
    return el;
  }

  function buildMoreSheet() {
    const sheet = $('mobile-more-sheet-v181');
    if (!sheet) return false;
    const grid = sheet.querySelector('.acy-more-grid-v186,.mobile-more-grid-v181');
    if (!grid) return false;
    if (grid.dataset.v20MoreBuilt === 'safe2' && grid.querySelector('[data-v20-more-item]')) return true;
    grid.innerHTML = '';
    MORE_GROUPS.forEach(([groupName, entries]) => {
      const label = document.createElement('div');
      label.className = 'v20-more-group-label';
      label.textContent = groupName;
      grid.appendChild(label);
      entries.forEach(([id,text,href]) => {
        const item = document.createElement(href ? 'a' : 'button');
        item.className = 'v20-more-item';
        item.dataset.v20MoreItem = '1';
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
    grid.dataset.v20MoreBuilt = 'safe2';
    return true;
  }

  function closeMore() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded','false');
    toggle?.classList.remove('is-open');
  }

  function scrollToTarget(target) {
    if (!target) return false;
    revealTarget(target.id);
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const offset = isMobile() ? 112 : 96;
      window.scrollTo({
        top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset),
        behavior: 'smooth'
      });
    }));
    return true;
  }

  function handleMoreItemClick(event) {
    const item = event.target.closest('#mobile-more-sheet-v181 [data-v20-more-item]');
    if (!item) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (item.dataset.moreHref) {
      const href = item.dataset.moreHref;
      closeMore();
      window.location.assign(href);
      return;
    }

    const target = $(item.dataset.targetId);
    closeMore();
    if (target) scrollToTarget(target);
  }

  function handleHashNavigation() {
    if (!IS_CLUB_PAGE) return;
    const hash = decodeURIComponent(location.hash.replace(/^#/,'')).trim();
    if (!hash) return;
    const target = $(hash);
    if (!target) return;
    setTimeout(() => scrollToTarget(target), 60);
  }

  function installStyles() {
    if ($('acy-v20-mobile-first-safe-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v20-mobile-first-safe-style';
    style.textContent = `
      @media(max-width:700px){
        body.club-auth-page .mobile-club-dock{min-height:76px!important;padding:8px 10px calc(8px + env(safe-area-inset-bottom))!important;gap:4px!important;border-radius:24px 24px 0 0!important;background:rgba(10,9,15,.96)!important;backdrop-filter:blur(24px) saturate(1.15)!important;-webkit-backdrop-filter:blur(24px) saturate(1.15)!important;box-shadow:0 -12px 36px rgba(0,0,0,.34)!important}
        body.club-auth-page .mobile-club-dock [data-dock-key]{min-width:56px!important;min-height:58px!important;border-radius:18px!important;padding:6px 8px!important;gap:3px!important;font-size:12px!important;font-weight:700!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
        body.club-auth-page .mobile-club-dock [data-dock-key].is-active{transform:translateY(-2px);background:rgba(171,96,255,.18)!important;box-shadow:0 6px 18px rgba(0,0,0,.22)!important}
        body.club-auth-page .mobile-club-dock [data-dock-key] > svg,body.club-auth-page .mobile-club-dock [data-dock-key] > i,body.club-auth-page .mobile-club-dock [data-dock-key] .icon,body.club-auth-page .mobile-club-dock [data-dock-key] .dock-icon,body.club-auth-page .mobile-club-dock [data-dock-key] .material-symbols-rounded{width:30px!important;height:30px!important;font-size:30px!important;line-height:30px!important}
        body.club-auth-page #mobile-more-sheet-v181{left:10px!important;right:10px!important;bottom:calc(86px + env(safe-area-inset-bottom))!important;max-height:min(80dvh,720px)!important;padding:14px!important;border-radius:26px!important}
        body.club-auth-page .acy-more-grid-v186,body.club-auth-page .mobile-more-grid-v181{grid-template-columns:1fr 1fr!important;gap:9px!important}
        body.club-auth-page .v20-more-group-label,body.pet-world-page-v182 .v20-more-group-label{grid-column:1/-1;padding:10px 4px 2px;color:rgba(235,220,255,.62);font-size:10px;letter-spacing:.12em;font-weight:800}
        body.club-auth-page .v20-more-item,body.pet-world-page-v182 .v20-more-item{min-height:58px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;padding:10px 11px!important;border:1px solid rgba(180,108,255,.20)!important;border-radius:16px!important;background:rgba(255,255,255,.045)!important;color:#f8f4ff!important;font:700 14px/1.15 system-ui,sans-serif!important;text-align:left!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
        body.club-auth-page .v20-more-icon,body.pet-world-page-v182 .v20-more-icon{font-size:21px;line-height:1;flex:0 0 24px;text-align:center}
        body.club-auth-page .v20-more-text,body.pet-world-page-v182 .v20-more-text{min-width:0}
        body.club-auth-page .member-dashboard{gap:14px!important}
        body.club-auth-page .member-card,body.club-auth-page .member-hub,body.club-auth-page .member-hero-card,body.club-auth-page .v18-app-home{border-radius:22px!important}
        body.club-auth-page .v18-app-home-head{padding:18px!important}
        body.club-auth-page .v18-action-grid{gap:9px!important}
        body.club-auth-page .v18-action-card{min-height:70px!important;padding:12px!important;border-radius:18px!important}
        body.club-auth-page .member-quick{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        body.pet-world-page-v182 #mobile-more-sheet-v181{position:fixed!important;z-index:11500!important;left:10px!important;right:10px!important;bottom:calc(86px + env(safe-area-inset-bottom))!important;max-height:min(80dvh,720px)!important;overflow:auto!important;padding:14px!important;border-radius:26px!important;background:rgba(13,12,19,.98)!important;box-shadow:0 -18px 60px rgba(0,0,0,.5)!important;backdrop-filter:blur(26px)!important;-webkit-backdrop-filter:blur(26px)!important}
        body.pet-world-page-v182 .acy-more-grid-v186,body.pet-world-page-v182 .mobile-more-grid-v181{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important}
        body.pet-world-page-v182 .pet-mobile-hub-v183{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important;overflow:visible!important}
        body.pet-world-page-v182 .pet-mobile-hub-v183 .pet-hub-card-v182{min-width:0!important;width:100%!important;box-sizing:border-box!important;overflow:hidden!important;padding:14px 10px!important}
        body.pet-world-page-v182 .pet-mobile-hub-v183 .pet-hub-card-v182 strong{font-size:15px!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere!important}
        body.pet-world-page-v182 .pet-mobile-hub-v183 .pet-hub-card-v182 small{font-size:11px!important;line-height:1.25!important;overflow-wrap:anywhere!important}
        body.pet-world-page-v182 .pet-mobile-hub-v183 .pet-hub-card-v182 > b{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    labelBetaVersion();
    installStyles();
    compactSections();
    buildMoreSheet();
    document.addEventListener('click', handleMoreItemClick, true);
    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);
    window.ACYV20Mobile = { compactSections, buildMoreSheet, revealTarget };
    window.addEventListener('resize', compactSections, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();