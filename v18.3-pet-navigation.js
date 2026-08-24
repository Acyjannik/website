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

    const loadV20MobileLayer = () => {
      if (document.getElementById('acy-v20-mobile-first-script')) return;
      const script = document.createElement('script');
      script.id = 'acy-v20-mobile-first-script';
      script.src = '/v20-mobile-first.js?v=2003';
      script.defer = true;
      document.head.appendChild(script);
    };

    loadV20MobileLayer();
    if (!petSection || !tabs.length) return;

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
  });
})();
