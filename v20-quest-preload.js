(() => {
  'use strict';

  if (!/\/club-profile\.html$/i.test(location.pathname) && location.pathname !== '/') return;

  let attempts = 0;
  let timer = null;
  const MAX_ATTEMPTS = 8;

  function hasQuestRows() {
    return !!document.getElementById('quest-list')?.querySelector('.quest-row');
  }

  function startQuestPreload() {
    if (hasQuestRows() || typeof window.loadQuests !== 'function') return true;
    if (attempts >= MAX_ATTEMPTS) return false;

    attempts += 1;
    try {
      const result = window.loadQuests();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (error) {
      console.warn('[V20] Quest preload skipped:', error);
    }

    if (!hasQuestRows() && attempts < MAX_ATTEMPTS) schedule(450);
    return true;
  }

  function schedule(delay = 900) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      startQuestPreload();
    }, delay);
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
