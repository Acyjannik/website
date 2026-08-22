(() => {
  'use strict';

  const SHEET_ID = 'mobile-more-sheet-v181';
  const TOGGLE_ID = 'mobile-dock-more-v18';

  const ensureStaffEntry = (sheet) => {
    if (!sheet || sheet.querySelector('[data-more-href="/staff-center.html"]')) return;
    const grid = sheet.querySelector('.acy-more-grid-v186') || sheet;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-more-href', '/staff-center.html');
    button.textContent = '🛡️ Staff Center';
    grid.appendChild(button);
  };

  const ensureSheet = () => {
    let sheet = document.getElementById(SHEET_ID);
    if (sheet) {
      ensureStaffEntry(sheet);
      return sheet;
    }

    sheet = document.createElement('div');
    sheet.id = SHEET_ID;
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
        <button type="button" data-more-href="/staff-center.html">🛡️ Staff Center</button>
      </div>`;
    document.body.appendChild(sheet);
    return sheet;
  };

  const closeMore = () => {
    const sheet = document.getElementById(SHEET_ID);
    const toggle = document.getElementById(TOGGLE_ID);
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.classList.remove('is-open');
  };

  const openMore = () => {
    const sheet = ensureSheet();
    const toggle = document.getElementById(TOGGLE_ID);
    sheet.hidden = false;
    document.body.classList.add('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.classList.add('is-open');
  };

  const findTarget = (key) => {
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
      .find((el) => pattern.test((el.querySelector('summary')?.textContent || el.textContent || '').trim()) && !el.hidden) || null;
  };

  const handleWindowClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest(`#${TOGGLE_ID}`);
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const sheet = ensureSheet();
      sheet.hidden ? openMore() : closeMore();
      return;
    }

    const sheet = target.closest(`#${SHEET_ID}`);
    if (!sheet) return;

    const closeButton = target.closest('[data-close-more]');
    if (closeButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeMore();
      return;
    }

    const hrefItem = target.closest('[data-more-href]');
    if (hrefItem) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const href = hrefItem.getAttribute('data-more-href');
      closeMore();
      if (href) window.location.assign(href);
      return;
    }

    const item = target.closest('[data-more-target]');
    if (!item) return;

    const key = item.getAttribute('data-more-target');
    const section = findTarget(key);
    if (!section) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeMore();
    const details = section.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => {
      const offset = window.matchMedia('(max-width: 700px)').matches ? 112 : 96;
      const y = Math.max(0, section.getBoundingClientRect().top + window.scrollY - offset);
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  };

  const init = () => {
    ensureSheet();
    window.addEventListener('click', handleWindowClick, true);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMore();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
