/* ACY V19 emergency Pet feed UX fix. Keep the feed control clickable so a full pet shows an explanation instead of appearing dead. */
(() => {
  'use strict';

  const selector = '.pet-action-btn[data-pet-action="feed"]';
  const sync = () => {
    document.querySelectorAll(selector).forEach(button => {
      if (button.dataset.acyFeedUiFix === '1') return;
      button.dataset.acyFeedUiFix = '1';
      button.removeAttribute('disabled');
      button.setAttribute('aria-disabled', 'false');
      const small = button.querySelector('small');
      if (small && !button.dataset.acyFeedOriginalMeta) {
        button.dataset.acyFeedOriginalMeta = small.textContent || 'Futter auswählen';
      }
      const hungerText = document.getElementById('pet-hunger-value')?.textContent || '';
      const hunger = Number.parseInt(hungerText.replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(hunger) && hunger >= 100) {
        if (small) small.textContent = 'Tier ist satt · antippen für Info';
        button.title = 'Dein Tier ist bereits satt. Antippen für Details.';
      } else {
        if (small) small.textContent = button.dataset.acyFeedOriginalMeta || 'Futter auswählen';
        button.title = 'Futter auswählen';
      }
    });
  };

  const init = () => {
    sync();
    setInterval(sync, 150);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
