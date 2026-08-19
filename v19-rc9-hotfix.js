/* ACY V19 RC9 — release blocker hotfixes: Pet feed, notification badge, auth/session handoff. */
(() => {
  'use strict';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);

  async function getClient() {
    if (window.__acySupabaseClient) return window.__acySupabaseClient;
    if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
    const cfg = await fetch('/api/config?_=19009', { cache: 'no-store' }).then(r => r.json());
    if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.__acySupabaseClient = client;
    return client;
  }

  async function withSession() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data?.session?.access_token) throw new Error('Keine aktive Anmeldung gefunden.');
    return { client, token: data.session.access_token };
  }

  function setPetStatus(text, type = '') {
    const el = $('pet-life-status') || $('pet-status');
    if (!el) return;
    el.textContent = text;
    el.className = `club-auth-status ${type}`.trim();
  }

  async function refreshPetUi() {
    try { if (typeof window.loadPet === 'function') await window.loadPet(); } catch (e) { console.warn('[RC9] loadPet', e); }
    try { if (typeof window.loadPetLife === 'function') await window.loadPetLife(); } catch (e) { console.warn('[RC9] loadPetLife', e); }
  }

  function patchFeedAction() {
    if (!document.body?.classList.contains('club-auth-page')) return;
    if (document.documentElement.dataset.acyRc9Feed === '1') return;
    document.documentElement.dataset.acyRc9Feed = '1';

    document.addEventListener('click', async event => {
      const button = event.target.closest('.pet-action-btn[data-pet-action="feed"]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.disabled || button.dataset.rc9Busy === '1') return;
      button.dataset.rc9Busy = '1';
      const oldText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '🍖 Füttern <small>Wird ausgeführt…</small>';
      try {
        const { client } = await withSession();
        const { data, error } = await client.rpc('club_pet_action', { p_action: 'feed' });
        if (error) throw error;
        if (data && typeof window.renderPet === 'function') window.renderPet(data);
        setPetStatus('🍖 Dein Tier wurde gefüttert.', 'success');
        await refreshPetUi();
      } catch (error) {
        const msg = error?.message || 'Füttern konnte nicht ausgeführt werden.';
        setPetStatus(`Füttern: ${msg}`, 'error');
        await refreshPetUi();
      } finally {
        button.dataset.rc9Busy = '0';
        button.disabled = false;
        button.innerHTML = oldText;
      }
    }, true);
  }

  async function syncNotificationBadge() {
    if (!document.body?.classList.contains('club-auth-page')) return;
    try {
      const { token } = await withSession();
      const response = await fetch(`/api/club-notifications?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      const list = Array.isArray(payload.notifications) ? payload.notifications : [];
      const unread = list.filter(item => !item.read_at).length;
      const badge = $('notification-count');
      if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread ? String(unread) : '';
        badge.hidden = unread === 0;
        badge.setAttribute('aria-label', unread ? `${unread} ungelesene Benachrichtigungen` : 'Keine ungelesenen Benachrichtigungen');
      }
      ['mobile-notification-badge','mobile-notification-badge-v18','mobile-more-notification-count-v181'].forEach(id => {
        const el = $(id);
        if (!el) return;
        el.textContent = unread > 99 ? '99+' : unread ? String(unread) : '';
        el.hidden = unread === 0;
      });
    } catch (error) {
      console.warn('[RC9] Notification badge unavailable:', error);
    }
  }

  function patchBell() {
    if (!document.body?.classList.contains('club-auth-page')) return;
    syncNotificationBadge();
    setTimeout(syncNotificationBadge, 1200);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNotificationBadge(); });
    document.getElementById('notification-bell')?.addEventListener('click', () => setTimeout(syncNotificationBadge, 200), true);
  }

  function init() {
    patchFeedAction();
    patchBell();
    if (location.pathname.endsWith('club-profile.html')) {
      const timer = setInterval(() => {
        if (window.__acySupabaseClient) { clearInterval(timer); syncNotificationBadge(); }
      }, 300);
      setTimeout(() => clearInterval(timer), 9000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
