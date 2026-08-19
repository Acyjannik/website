(() => {
  'use strict';

  // V18.6: isolated navigation layer.
  // This file intentionally does not modify the existing V18 app shell,
  // Supabase loading, profile rendering or notification logic.

  const $ = (id) => document.getElementById(id);
  const MOBILE_MAX = 700;

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

    // Crucial: do not use href/hash navigation. That was the source of the
    // repeated jump-to-top behaviour on the Club page.
    const offset = window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches ? 112 : 96;
    const targetY = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      });
    });

    return true;
  }

  function navigate(key) {
    if (key === 'more') {
      setActive('more');
      return openMore();
    }

    if (key === 'pet') {
      setActive('pet');
      window.location.assign('/pet.html');
      return true;
    }

    if (key === 'home') {
      closeMore();
      setActive('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }

    const target = findTarget(key);
    if (!target) return false;

    closeMore();
    setActive(key);
    return scrollToTarget(target);
  }

  function handleDockClick(event) {
    const item = event.target.closest('.mobile-club-dock [data-dock-key]');
    if (!item) return;

    const key = item.dataset.dockKey;
    if (!key) return;

    // Capture phase: stop every legacy handler before it can process the old
    // href/hash behaviour. No page reload, no hash, no accidental top jump.
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(key);
  }

  function handleMoreLink(event) {
    const link = event.target.closest('#mobile-more-sheet-v181 a[href^="#"], #mobile-more-sheet-v181 [data-target-id]');
    if (!link) return;

    const id = link.dataset.targetId || (link.getAttribute('href') || '').slice(1);
    const target = id ? $(id) : null;
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const details = target.closest('details');
    if (details) details.open = true;
    closeMore();
    scrollToTarget(target);
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
      if (key === 'more') item.setAttribute('aria-haspopup', 'dialog');
    });
  }

  function removeLegacyHashFromCurrentUrl() {
    if (!window.location.hash) return;
    try {
      history.replaceState(history.state, document.title, window.location.pathname + window.location.search);
    } catch (_) {}
  }

  function init() {
    removeLegacyHashFromCurrentUrl();
    hardenDockMarkup();

    document.addEventListener('click', handleDockClick, true);
    document.addEventListener('click', handleMoreLink, true);

    // The dock can be rendered/re-rendered by existing Club code. Re-harden
    // the markup without touching the rest of the page.
    const observer = new MutationObserver(() => hardenDockMarkup());
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
