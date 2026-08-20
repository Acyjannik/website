/* ACY CLUB V19 RC11 — Pet hunger UX only. No pet action logic changes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  async function syncFeedButton() {
    const buttons = [...document.querySelectorAll('.pet-action-btn[data-pet-action="feed"]')];
    if (!buttons.length || !window.__acySupabaseClient?.rpc) return;
    try {
      const { data, error } = await window.__acySupabaseClient.rpc('get_club_pet');
      if (error || !data) return;
      const full = Number(data.hunger) >= 100;
      buttons.forEach(button => {
        button.disabled = full;
        button.setAttribute('aria-disabled', String(full));
        button.title = full ? 'Dein Tier ist bereits satt.' : 'Futter auswählen';
        const label = button.querySelector('strong') || button;
        if (!button.dataset.originalFeedLabel) button.dataset.originalFeedLabel = label.textContent || '🍖 Füttern';
        label.textContent = full ? '🍖 Satt' : button.dataset.originalFeedLabel;
      });
      const status = $('pet-life-status') || $('pet-status');
      if (status && full) {
        status.textContent = '🐾 Dein Tier ist bereits satt. Es braucht gerade kein Futter.';
        status.className = 'club-auth-status';
      }
    } catch {}
  }

  function schedule() {
    setTimeout(syncFeedButton, 300);
    setTimeout(syncFeedButton, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  const observer = new MutationObserver(() => syncFeedButton());
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
