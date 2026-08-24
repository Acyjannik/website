/* ACY V20 · Isolated Wheel Controller
 * Owns only the user-facing spin action. Initial state/history remain optional background reads.
 */
(() => {
  'use strict';
  if (window.__acyV20WheelController) return;
  window.__acyV20WheelController = true;

  const boot = () => {
    const root = document.querySelector('[data-wheel-section], #club-wheel-section, .club-wheel-section');
    if (!root) return;
    const button = root.querySelector('[data-wheel-spin], #wheel-spin-btn, .wheel-spin-btn, button[id*="wheel-spin"]');
    if (!button || button.dataset.v20WheelBound === '1') return;
    button.dataset.v20WheelBound = '1';

    let busy = false;
    const setBusy = value => {
      busy = value;
      button.dataset.v20WheelBusy = value ? '1' : '0';
      button.setAttribute('aria-busy', value ? 'true' : 'false');
      if (value) button.classList.add('is-spinning');
      else button.classList.remove('is-spinning');
    };

    const refreshLater = () => {
      const fns = ['loadWheelState', 'loadWheelHistory', 'loadQuests', 'loadProfile'];
      for (const name of fns) {
        try {
          if (typeof window[name] === 'function') Promise.resolve().then(() => window[name]()).catch(() => {});
        } catch {}
      }
    };

    const spin = async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;
      if (!window.supabaseClient) {
        console.warn('[V20 Wheel] Supabase not ready');
        return;
      }

      setBusy(true);
      const started = performance.now();
      root.classList.add('v20-wheel-spinning');
      try {
        const { data, error } = await window.supabaseClient.rpc('spin_club_wheel');
        if (error) throw error;
        if (!data?.ok) {
          if (typeof window.showClubToast === 'function') window.showClubToast('Der nächste Dreh ist noch nicht verfügbar.', 'info');
          return;
        }

        const label = data.reward_label || 'Gewinn';
        if (typeof window.showClubToast === 'function') window.showClubToast(`🎡 ${label}`, 'success');

        // Let the visual result settle without making the user wait for read refreshes.
        root.dataset.v20WheelResult = data.reward_key || '';
        root.dataset.v20WheelReward = label;
      } catch (error) {
        console.error('[V20 Wheel] spin failed:', error);
        if (typeof window.showClubToast === 'function') window.showClubToast(error?.message || 'Der Dreh konnte nicht gestartet werden.', 'error');
      } finally {
        const elapsed = performance.now() - started;
        const minimumVisualTime = 550;
        window.setTimeout(() => {
          root.classList.remove('v20-wheel-spinning');
          setBusy(false);
          refreshLater();
        }, Math.max(0, minimumVisualTime - elapsed));
      }
    };

    button.addEventListener('click', spin, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  new MutationObserver(boot).observe(document.documentElement, { childList: true, subtree: true });
})();
