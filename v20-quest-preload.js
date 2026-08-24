(() => {
  'use strict';

  if (!/\/club-profile\.html$/i.test(location.pathname) && location.pathname !== '/') return;

  let started = false;
  let timer = null;

  function startQuestPreload() {
    if (started || typeof window.loadQuests !== 'function') return false;
    const list = document.getElementById('quest-list');
    if (list?.querySelector('.quest-row')) return false;

    started = true;
    try {
      const result = window.loadQuests();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (error) {
      console.warn('[V20] Quest preload skipped:', error);
    }
    return true;
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      startQuestPreload();
    }, 900);
  }

  window.ACYV20QuestPreload = {
    start: startQuestPreload,
    schedule
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
