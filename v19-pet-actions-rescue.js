/* ACY V19 — Pet action rescue.
 * Last-resort delegated handlers for the seven core Pet Life actions.
 * This intentionally bypasses the older UI binding chain and calls the canonical RPC directly.
 */
(() => {
  'use strict';

  const ACTIONS = new Set(['feed','play','pet','groom','sleep','train','explore']);
  let clientPromise = null;
  let busy = false;

  const $ = id => document.getElementById(id);

  if (!document.body?.classList.contains('club-auth-page')) return;
  if (!/\/(pet\.html|club-profile\.html)$/i.test(location.pathname)) return;

  function status(message, type = '') {
    const el = $('pet-life-status') || $('pet-status');
    if (!el) return;
    el.textContent = message;
    el.className = `club-auth-status ${type}`.trim();
  }

  async function getClient() {
    if (window.__acySupabaseClient?.rpc) return window.__acySupabaseClient;
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
      const cfg = await fetch('/api/config?pet_rescue=19140', { cache: 'no-store' }).then(r => r.json());
      if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__acySupabaseClient = client;
      return client;
    })();
    return clientPromise;
  }

  async function refresh() {
    try { await window.loadPet?.(); } catch {}
    try { await window.loadPetLife?.(); } catch {}
  }

  async function runAction(action, button) {
    if (busy || button.disabled) return;
    busy = true;
    const oldText = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const client = await getClient();
      const { data, error } = await client.rpc('club_pet_action', { p_action: action });
      if (error) throw error;
      if (data?.pet && typeof window.renderPet === 'function') window.renderPet(data.pet);
      if (data?.hub && typeof window.renderPetLife === 'function') window.renderPetLife(data.hub);
      const message = data?.message || 'Dein Tier freut sich. 🐾';
      status(message, 'success');
      await refresh();
    } catch (error) {
      status(error?.message || 'Pet-Aktion konnte nicht ausgeführt werden.', 'error');
      await refresh();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (!button.isConnected) return;
      button.innerHTML = oldText;
      busy = false;
    }
  }

  function bind() {
    if (document.documentElement.dataset.acyPetActionsRescue === '1') return;
    document.documentElement.dataset.acyPetActionsRescue = '1';

    document.addEventListener('click', event => {
      const button = event.target.closest('.pet-action-btn[data-pet-action]');
      if (!button) return;
      const action = String(button.dataset.petAction || '').trim();
      if (!ACTIONS.has(action)) return;

      // Take ownership of the core action buttons. Older handlers are allowed to remain
      // loaded, but must not receive this click and accidentally double-submit an action.
      event.preventDefault();
      event.stopImmediatePropagation();
      void runAction(action, button);
    }, true);

    // Make the rescue visible in diagnostics without changing the UI.
    window.__acyPetActionsRescue = {
      version: 'V19.0.1',
      actions: [...ACTIONS],
      run: runAction
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
