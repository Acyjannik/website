(() => {
  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  ready(() => {
    const petSection = document.getElementById('pet-section');
    const lifePanel = document.getElementById('pet-life-v182');
    const gamesPanel = document.getElementById('pet-games-v182');
    const archive = document.getElementById('pet-archive-panel');
    const tabs = [...document.querySelectorAll('.pet-view-tab-v183')];

    if (petSection && tabs.length) {
      const scrollToTarget = (target) => {
        if (!target) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const top = target.getBoundingClientRect().top + window.scrollY - 18;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          });
        });
      };

      const setView = (view, updateHash = true) => {
        // IMPORTANT: do not write data-pet-view on the main Pet section.
        // styles.css uses that attribute as a visibility switch, which made
        // the Games tab hide the rest of the Pet UI until a reload.
        petSection.removeAttribute('data-pet-view');

        tabs.forEach(tab => {
          const active = tab.dataset.petView === view;
          tab.classList.toggle('is-primary', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        if (view === 'archive') {
          if (archive) archive.open = true;
          if (gamesPanel) gamesPanel.open = false;
          scrollToTarget(archive);
        } else if (view === 'games') {
          if (archive) archive.open = false;
          if (gamesPanel) gamesPanel.open = true;
          scrollToTarget(gamesPanel || lifePanel || petSection);
        } else if (view === 'life') {
          if (archive) archive.open = false;
          if (gamesPanel) gamesPanel.open = false;
          scrollToTarget(lifePanel || petSection);
        } else {
          if (archive) archive.open = false;
          if (gamesPanel) gamesPanel.open = false;
          scrollToTarget(petSection);
        }

        if (updateHash) history.replaceState(null, '', `#pet-${view}`);
      };

      tabs.forEach(tab => tab.addEventListener('click', (event) => {
        event.preventDefault();
        setView(tab.dataset.petView);
      }));

      const initial = location.hash.match(/^#pet-(home|life|games|archive)$/)?.[1];
      if (initial) setView(initial, false);
      else petSection.removeAttribute('data-pet-view');

      archive?.addEventListener('toggle', () => {
        if (archive.open) setView('archive', false);
      });

      gamesPanel?.addEventListener('toggle', () => {
        if (gamesPanel.open) setView('games', false);
      });

      window.addEventListener('hashchange', () => {
        const view = location.hash.match(/^#pet-(home|life|games|archive)$/)?.[1];
        if (view) setView(view, false);
      });
    }

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
