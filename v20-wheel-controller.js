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
    const findButton = () => root.querySelector(
      '[data-wheel-spin], #wheel-spin-btn, #wheel-spin, #spin-wheel, .wheel-spin-btn, button[id*="wheel-spin"], button'
    );
    const button = findButton();
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

    const getClient = async () => {
      if (window.__acySupabaseClient?.rpc) return window.__acySupabaseClient;
      if (window.__acyV20WheelClientPromise) return window.__acyV20WheelClientPromise;

      window.__acyV20WheelClientPromise = (async () => {
        if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
        const cfg = await fetch('/api/config', { cache: 'default' }).then(r => r.json());
        if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
        const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        window.__acySupabaseClient = client;
        return client;
      })();

      return window.__acyV20WheelClientPromise;
    };

    // Warm the client while the Club is loading, not on the first wheel click.
    void getClient().catch(() => {});

    const refreshLater = () => {
      const fns = ['loadWheelState', 'loadWheelHistory', 'loadQuests', 'loadProfile'];
      for (const name of fns) {
        try {
          if (typeof window[name] === 'function') Promise.resolve().then(() => window[name]()).catch(() => {});
        } catch {}
      }
    };

    const showResult = (label, type = 'success') => {
      if (typeof window.showClubToast === 'function') {
        window.showClubToast(label, type);
        return;
      }
      const status = document.getElementById('club-wheel-status') || document.getElementById('wheel-status');
      if (status) {
        status.textContent = label;
        status.className = `club-auth-status ${type}`.trim();
      }
    };

    const spin = async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;

      setBusy(true);
      root.classList.remove('v20-wheel-spinning');
      void root.offsetWidth;
      root.classList.add('v20-wheel-spinning');

      const started = performance.now();
      try {
        const client = await getClient();
        const { data, error } = await client.rpc('spin_club_wheel');
        if (error) throw error;
        if (!data?.ok) {
          showResult('Der nächste Dreh ist noch nicht verfügbar.', 'info');
          return;
        }

        const label = data.reward_label || 'Gewinn';
        root.dataset.v20WheelResult = data.reward_key || '';
        root.dataset.v20WheelReward = label;
        showResult(`🎡 ${label}`, 'success');

        // Never hold the interaction open for secondary reads.
        queueMicrotask(refreshLater);
      } catch (error) {
        console.error('[V20 Wheel] spin failed:', error);
        showResult(error?.message || 'Der Dreh konnte nicht gestartet werden.', 'error');
      } finally {
        const elapsed = performance.now() - started;
        const minimumVisualTime = 550;
        window.setTimeout(() => {
          root.classList.remove('v20-wheel-spinning');
          setBusy(false);
        }, Math.max(0, minimumVisualTime - elapsed));
      }
    };

    button.addEventListener('click', spin, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  new MutationObserver(boot).observe(document.documentElement, { childList: true, subtree: true });
})();