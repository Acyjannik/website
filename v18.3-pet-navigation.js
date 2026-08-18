(() => {
  const ready = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

  ready(() => {
    const petSection = document.getElementById('pet-section');
    const archive = document.getElementById('pet-archive-panel');
    const tabs = [...document.querySelectorAll('.pet-view-tab-v183')];
    if (petSection && tabs.length) {
      const setView = (view, updateHash = true) => {
        petSection.dataset.petView = view;
        tabs.forEach(tab => {
          const active = tab.dataset.petView === view;
          tab.classList.toggle('is-primary', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (archive) archive.open = view === 'archive';
        if (updateHash) history.replaceState(null, '', `#pet-${view}`);
        const target = view === 'archive' ? archive : petSection;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      tabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.petView)));
      const initial = location.hash.match(/^#pet-(home|life|games|archive)$/)?.[1];
      if (initial) setView(initial, false);
      archive?.addEventListener('toggle', () => {
        if (archive.open) setView('archive', false);
      });
      window.addEventListener('hashchange', () => {
        const view = location.hash.match(/^#pet-(home|life|games|archive)$/)?.[1];
        if (view) setView(view, false);
      });
    }

    // V18.5 — Pet UI hardening. The Pet page is the same responsive page on
    // mobile and desktop, so these fixes intentionally apply to both layouts.
    const style = document.createElement('style');
    style.id = 'acy-v185-pet-fixes';
    style.textContent = `
      #pet-active-state[hidden] { display: none !important; }
      #pet-empty-state[hidden] { display: none !important; }
      #pet-shop[hidden] { display: none !important; }
      #pet-shop-open[aria-expanded="false"] { opacity: .96; }
      #pet-shop-open[aria-expanded="true"] { border-color: rgba(168,85,247,.45); }
    `;
    document.head.appendChild(style);

    // After an async release, force the visual state to agree with the server
    // result and refresh Pet Life so the newly archived companion appears.
    const release = document.getElementById('pet-release-toggle');
    if (release) {
      release.addEventListener('click', () => {
        const startedAt = Date.now();
        const syncReleasedState = () => {
          const status = document.getElementById('pet-status');
          const active = document.getElementById('pet-active-state');
          const empty = document.getElementById('pet-empty-state');
          const success = status?.classList.contains('success') && /verabschiedet/i.test(status.textContent || '');
          if (success) {
            if (active) { active.hidden = true; active.style.display = 'none'; }
            if (empty) { empty.hidden = false; empty.style.removeProperty('display'); }
            if (archive) archive.open = false;
            window.loadPetLife?.();
            return;
          }
          if (Date.now() - startedAt < 5000) setTimeout(syncReleasedState, 150);
        };
        setTimeout(syncReleasedState, 150);
      });
    }

    // Pet-Shop is intentionally left to the original V17.9 renderer in
    // club-profile.js. The previous delegated listener here intercepted the
    // click before that renderer could populate the shop, making it appear to vanish.

    // Robust delegated handler for the mobile More button. This survives other
    // scripts re-rendering the dock or stopping direct listeners.
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('#mobile-dock-more-v18');
      if (!toggle) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const sheet = document.getElementById('mobile-more-sheet-v181');
      if (!sheet) return;
      const shouldOpen = sheet.hidden;
      sheet.hidden = !shouldOpen;
      document.body.classList.toggle('mobile-more-open-v181', shouldOpen);
      toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }, true);

    document.addEventListener('click', (event) => {
      const close = event.target.closest('[data-close-more]');
      if (close) {
        const sheet = document.getElementById('mobile-more-sheet-v181');
        const toggle = document.getElementById('mobile-dock-more-v18');
        if (sheet) sheet.hidden = true;
        document.body.classList.remove('mobile-more-open-v181');
        toggle?.setAttribute('aria-expanded', 'false');
      }
    }, true);
  });
})();
