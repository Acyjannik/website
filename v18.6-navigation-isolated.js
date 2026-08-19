(() => {
  'use strict';

  // V18.6.3: isolated navigation + visual polish loader.
  const $ = (id) => document.getElementById(id);
  const MOBILE_MAX = 700;
  const isPetPage = /\/pet\.html$/i.test(location.pathname);

  const TARGETS = {
    home: ['acy-v18-home', 'member-spotlight', 'member-hub'],
    quests: ['club-quests-section', 'club-daily-section', 'daily-section', 'club-rewards-section', 'member-badges-section'],
    social: ['social-connections-section', 'club-messages', 'club-chat', 'member-directory-section', 'member-friends-section', 'club-friends'],
  };

  function visible(el) {
    return !!el && !el.hidden && !el.closest('[hidden]') && el.getClientRects().length > 0;
  }

  function findTarget(key) {
    for (const id of TARGETS[key] || []) {
      const el = $(id);
      if (visible(el)) return el;
    }
    const pattern = key === 'social'
      ? /Nachrichten|Direktnachrichten|Chat|Freunde|Mitglieder/i
      : /Quests|Daily|Rewards|Belohnungen|Badges|Glücksrad/i;
    return [...document.querySelectorAll('details.member-card, details.member-fold, section.member-card, section.member-fold, .member-card, .member-fold')]
      .find((el) => pattern.test((el.querySelector('summary')?.textContent || el.textContent || '').trim()) && visible(el)) || null;
  }

  function closeMore() {
    const sheet = $('mobile-more-sheet-v181');
    const toggle = $('mobile-dock-more-v18');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.classList.remove('is-open');
  }

  function ensureMoreSheet() {
    let sheet = $('mobile-more-sheet-v181');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'mobile-more-sheet-v181';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Mehr');
    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px 14px">
        <strong style="font-size:20px">Mehr</strong>
        <button type="button" data-close-more aria-label="Mehr schließen" style="font-size:22px">×</button>
      </div>
      <div class="acy-more-grid-v186">
        <button type="button" data-more-target="news">📣 News</button>
        <button type="button" data-more-target="clips">🎬 Clips</button>
        <button type="button" data-more-target="ranking">🏆 Ranking</button>
        <button type="button" data-more-target="stats">📊 Club-Fortschritt</button>
        <button type="button" data-more-target="discord">🎧 Discord</button>
        <button type="button" data-more-target="settings">⚙️ Einstellungen</button>
      </div>`;
    document.body.appendChild(sheet);
    return sheet;
  }

  function openMore() {
    const sheet = ensureMoreSheet();
    const toggle = $('mobile-dock-more-v18');
    sheet.hidden = false;
    document.body.classList.add('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.classList.add('is-open');
    return true;
  }

  function toggleMore() {
    const sheet = ensureMoreSheet();
    if (!sheet.hidden) {
      closeMore();
      return false;
    }
    return openMore();
  }

  function setActive(key) {
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach((item) => {
      const active = item.dataset.dockKey === key;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function scrollToTarget(target) {
    if (!target) return false;
    const details = target.closest('details');
    if (details) details.open = true;
    const offset = window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches ? 112 : 96;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }));
    return true;
  }

  function navigate(key) {
    if (key === 'more') {
      setActive('more');
      return toggleMore();
    }
    if (key === 'home') {
      closeMore();
      if (isPetPage) {
        window.location.assign('/club-profile.html');
        return true;
      }
      setActive('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    if (key === 'pet') {
      closeMore();
      setActive('pet');
      if (!isPetPage) window.location.assign('/pet.html');
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    const target = findTarget(key);
    if (!target) return false;
    closeMore();
    setActive(key);
    return scrollToTarget(target);
  }

  function findMoreTarget(key) {
    const patterns = {
      news: /\bNews\b/i,
      clips: /\bClips\b/i,
      ranking: /Ranking|Leaderboard/i,
      stats: /Club-Fortschritt|Statistik|Fortschritt/i,
      discord: /Discord/i,
      settings: /Einstellungen|Settings/i,
    };
    const pattern = patterns[key];
    if (!pattern) return null;
    return [...document.querySelectorAll('details.member-card, details.member-fold, section.member-card, section.member-fold, .member-card, .member-fold')]
      .find((el) => pattern.test((el.querySelector('summary')?.textContent || el.textContent || '').trim()) && visible(el)) || null;
  }

  function handleMoreAction(event) {
    const closeButton = event.target.closest('[data-close-more]');
    if (closeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMore();
      return;
    }
    const item = event.target.closest('#mobile-more-sheet-v181 [data-more-target], #mobile-more-sheet-v181 [data-target-id]');
    if (item) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = item.dataset.targetId ? $(item.dataset.targetId) : findMoreTarget(item.dataset.moreTarget);
      closeMore();
      if (!target) return;
      const details = target.closest('details');
      if (details) details.open = true;
      scrollToTarget(target);
      return;
    }
    const interactive = event.target.closest('#mobile-more-sheet-v181 button, #mobile-more-sheet-v181 a, #mobile-more-sheet-v181 [role="button"]');
    if (interactive) closeMore();
  }

  function hardenDockMarkup() {
    const dock = document.querySelector('.mobile-club-dock');
    if (!dock) return;
    dock.querySelectorAll('[data-dock-key]').forEach((item) => {
      const key = item.dataset.dockKey;
      if (!key) return;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', key === 'more' ? 'Mehr' : key === 'pet' ? 'Pet' : key === 'quests' ? 'Quests' : key === 'social' ? 'Social' : 'Home');
      item.removeAttribute('target');
      item.removeAttribute('download');
      item.removeAttribute('href');
    });
  }

  function installStyles() {
    if ($('acy-v186-navigation-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v186-navigation-style';
    style.textContent = `
      #mobile-more-sheet-v181{position:fixed!important;z-index:11500!important;left:12px!important;right:12px!important;bottom:calc(92px + env(safe-area-inset-bottom))!important;max-height:72dvh!important;overflow:auto!important;padding:14px!important;border:1px solid rgba(180,108,255,.28)!important;border-radius:26px!important;background:rgba(13,12,19,.98)!important;box-shadow:0 -18px 60px rgba(0,0,0,.5)!important;backdrop-filter:blur(26px)!important}
      #mobile-more-sheet-v181[hidden]{display:none!important}
      .acy-more-grid-v186{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .acy-more-grid-v186 button{min-height:54px;border:1px solid rgba(180,108,255,.22);border-radius:16px;background:rgba(255,255,255,.04);color:#f7f3ff;font:600 15px/1.2 system-ui,sans-serif;touch-action:manipulation}
      body.mobile-more-open-v181:before{content:"";position:fixed;inset:0;z-index:11490;background:rgba(0,0,0,.46);pointer-events:none}
      @media(min-width:701px){#mobile-more-sheet-v181{left:50%!important;right:auto!important;bottom:94px!important;transform:translateX(-50%)!important;width:min(560px,calc(100vw - 48px))!important}}
    `;
    document.head.appendChild(style);
  }

  function loadPolishLayer() {
    if (document.querySelector('script[data-acy-v1863-polish]')) return;
    const script = document.createElement('script');
    script.src = '/v18.6-pet-member-polish.js?v=18.6.3';
    script.defer = true;
    script.dataset.acyV1863Polish = '1';
    document.head.appendChild(script);
  }

  function installGuard() {
    if (document.documentElement.dataset.acyNavGuard === '1863') return;
    document.documentElement.dataset.acyNavGuard = '1863';
    document.addEventListener('click', (event) => {
      const dockItem = event.target.closest('.mobile-club-dock [data-dock-key]');
      if (dockItem) {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate(dockItem.dataset.dockKey || '');
        return;
      }
      if (event.target.closest('#mobile-more-sheet-v181')) handleMoreAction(event);
    }, true);
  }

  function init() {
    installStyles();
    ensureMoreSheet();
    hardenDockMarkup();
    loadPolishLayer();
    installGuard();
    const observer = new MutationObserver(() => hardenDockMarkup());
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
