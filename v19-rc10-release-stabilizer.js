/* ACY CLUB V19 RC10 — release stabilizer: one version badge, Dev Center label, isolated app navigation and resilient Pet bootstrap. */
(() => {
  'use strict';

  const VERSION = 'V19.0.0 · RC10';
  const $ = id => document.getElementById(id);
  const isClub = /(?:^|\/)club-profile\.html$/i.test(location.pathname);
  const isPet = /(?:^|\/)pet\.html$/i.test(location.pathname);
  if (!isClub && !isPet) return;

  let clientPromise = null;
  let petActionBusy = false;

  function getClient() {
    if (window.__acySupabaseClient) return Promise.resolve(window.__acySupabaseClient);
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
      const response = await fetch('/api/config?_=19010', { cache: 'no-store' });
      const cfg = await response.json();
      if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
      const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__acySupabaseClient = sb;
      return sb;
    })();
    return clientPromise;
  }

  function token() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const t = data?.access_token || data?.currentSession?.access_token || data?.session?.access_token || data?.data?.session?.access_token;
        if (t) return t;
      }
    } catch {}
    return null;
  }

  function installStyles() {
    if ($('acy-rc10-stabilizer-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-rc10-stabilizer-style';
    style.textContent = `
      /* Older RC scripts still exist for compatibility. Hide their competing badges. */
      #acy-dev-version-badge,#acy-v19-rc-badge-v2,#acy-v19-rc6-badge,#acy-v19-rc-safe-badge,#acy-v19-rc3-badge,#acy-v19-rc5-badge,#acy-v19-rc6-badge,#acy-v189-version-badge,#acy-build-marker,.streamer-version{display:none!important}
      #acy-canonical-version-badge{position:fixed!important;top:max(8px,env(safe-area-inset-top))!important;right:10px!important;z-index:13050!important;padding:7px 11px!important;border:1px solid rgba(180,108,255,.38)!important;border-radius:999px!important;background:rgba(10,9,15,.94)!important;backdrop-filter:blur(12px)!important;color:#f7f3ff!important;font:800 11px/1.1 system-ui,sans-serif!important;letter-spacing:.04em!important;pointer-events:none!important;white-space:nowrap!important}

      /* App-like section isolation. The bottom dock stays visible. */
      body.acy-section-view-quests .member-dashboard > .member-hero-card,
      body.acy-section-view-quests .member-dashboard > .v18-app-home,
      body.acy-section-view-quests .member-dashboard > .spotlight-card,
      body.acy-section-view-quests .member-dashboard > .member-hub,
      body.acy-section-view-quests .member-dashboard > .current-game-card,
      body.acy-section-view-quests .member-dashboard > .member-section-nav,
      body.acy-section-view-quests .member-dashboard > .pet-teaser-v181,
      body.acy-section-view-social .member-dashboard > .member-hero-card,
      body.acy-section-view-social .member-dashboard > .v18-app-home,
      body.acy-section-view-social .member-dashboard > .spotlight-card,
      body.acy-section-view-social .member-dashboard > .member-hub,
      body.acy-section-view-social .member-dashboard > .current-game-card,
      body.acy-section-view-social .member-dashboard > .member-section-nav,
      body.acy-section-view-social .member-dashboard > .pet-teaser-v181{display:none!important}
      body.acy-section-view-quests .member-grid > *:not(#club-quests-section):not(#club-daily-section):not(#daily-section):not(#club-rewards-section):not(#member-badges-section):not(#club-wheel-section):not(#progression-catalog),
      body.acy-section-view-social .member-grid > *:not(#social-connections-section):not(#club-messages):not(#club-chat):not(#member-directory-section):not(#member-friends-section):not(#club-friends):not(#clips-section){display:none!important}
      body.acy-section-view-home .member-grid > *{display:none!important}
      body.acy-section-view-home .member-dashboard > .current-game-card{display:block!important}
      body.acy-section-view-home .member-dashboard > .member-section-nav{display:none!important}
      body.acy-section-view-home .member-dashboard > .pet-teaser-v181{display:none!important}
      body.acy-section-view-home .member-grid{display:none!important}
      body.acy-section-view-home .member-dashboard > .v18-app-home,
      body.acy-section-view-home .member-dashboard > .spotlight-card,
      body.acy-section-view-home .member-dashboard > .member-hub{display:block!important}
      body.acy-section-view-quests .member-grid,body.acy-section-view-social .member-grid{display:block!important}
      body.acy-section-view-quests .member-grid,body.acy-section-view-social .member-grid{margin-top:0!important}
      body.acy-section-view-quests .member-dashboard > .member-section-nav,body.acy-section-view-social .member-dashboard > .member-section-nav{display:none!important}

      @media(max-width:700px){
        body.acy-section-view-quests .member-dashboard,body.acy-section-view-social .member-dashboard{padding-bottom:110px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installVersionBadge() {
    let badge = $('acy-canonical-version-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-canonical-version-badge';
      badge.setAttribute('aria-hidden', 'true');
      document.body.appendChild(badge);
    }
    badge.textContent = VERSION;
  }

  function cleanHeaderStaffLinks() {
    if (!isClub) return;
    const host = document.querySelector('.member-header-actions');
    if (!host) return;
    host.querySelectorAll('a,button').forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (/admin\s*\/\s*mod|mod\s*center|admin\s*center|streamer\s*center/i.test(text) || /(?:^|\/)admin\.html|(?:^|\/)mod\.html/i.test(href)) el.remove();
    });

    const nav = document.querySelector('.member-section-nav');
    if (!nav) return;
    let dev = nav.querySelector('[data-acy-dev-center]');
    const old = [...nav.querySelectorAll('a,button')].find(el => /admin\s*\/\s*mod|mod\s*center|admin\s*center|streamer\s*center|\bmod\b/i.test((el.textContent || '').trim()) || /(?:^|\/)admin\.html|(?:^|\/)mod\.html/i.test(el.getAttribute('href') || ''));
    if (old) {
      old.textContent = '🛠️ Dev Center';
      old.setAttribute('href', '/staff-center.html');
      old.hidden = false;
      old.removeAttribute('id');
      old.classList.add('dev-center-nav-link');
      old.dataset.acyDevCenter = '1';
      dev = old;
    }
    if (!dev && /member-section-nav/.test(nav.className)) {
      const link = document.createElement('a');
      link.href = '/staff-center.html';
      link.textContent = '🛠️ Dev Center';
      link.className = 'dev-center-nav-link';
      link.dataset.acyDevCenter = '1';
      nav.appendChild(link);
    }
  }

  const VIEW_TARGETS = {
    home: ['acy-v18-home', 'member-spotlight', 'member-hub', 'current-game-card'],
    quests: ['club-quests-section', 'club-daily-section', 'daily-section', 'club-rewards-section', 'member-badges-section', 'club-wheel-section', 'progression-catalog'],
    social: ['social-connections-section', 'club-messages', 'club-chat', 'member-directory-section', 'member-friends-section', 'club-friends', 'clips-section']
  };

  function setSectionView(view) {
    if (!isClub) return;
    const key = VIEW_TARGETS[view] ? view : 'home';
    document.body.classList.remove('acy-section-view-home', 'acy-section-view-quests', 'acy-section-view-social');
    document.body.classList.add(`acy-section-view-${key}`);
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item => {
      const active = item.dataset.dockKey === key;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    history.replaceState(null, '', `#${key}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindDock() {
    if (!isClub || document.documentElement.dataset.acyRc10Dock === '1') return;
    document.documentElement.dataset.acyRc10Dock = '1';
    document.addEventListener('click', event => {
      const item = event.target.closest('.mobile-club-dock [data-dock-key]');
      if (!item) return;
      const key = item.dataset.dockKey;
      if (!VIEW_TARGETS[key]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSectionView(key);
    }, true);
    const hash = location.hash.replace('#', '');
    if (VIEW_TARGETS[hash]) setSectionView(hash); else setSectionView('home');
  }

  function petStatus(message, type = '') {
    const el = $('pet-life-status') || $('pet-status');
    if (!el) return;
    el.textContent = message;
    el.className = `club-auth-status ${type}`.trim();
  }

  async function refreshPet() {
    if (!isPet) return;
    try { if (typeof window.loadPet === 'function') await window.loadPet(); } catch {}
    try { if (typeof window.loadPetLife === 'function') await window.loadPetLife(); } catch {}
  }

  async function petHub(sb) {
    const { data, error } = await sb.rpc('get_pet_life_hub');
    if (error) throw error;
    if (typeof window.renderPetLife === 'function') window.renderPetLife(data || {});
    return data || {};
  }

  function bindPetFallbacks() {
    if (!isPet || document.documentElement.dataset.acyRc10Pet === '1') return;
    document.documentElement.dataset.acyRc10Pet = '1';

    const form = $('pet-create-form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const species = document.querySelector('#pet-choice-grid [data-species].is-selected, #pet-choice-grid [data-species][aria-pressed="true"], #pet-choice-grid [data-species].selected')?.dataset.species;
      const name = $('pet-name-input')?.value?.trim();
      if (!species) { petStatus('Bitte zuerst ein Tier auswählen.', 'error'); return; }
      if (!name || name.length < 2 || name.length > 18) { petStatus('Der Tiername muss 2 bis 18 Zeichen lang sein.', 'error'); return; }
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Tier wird adoptiert…'; }
      try {
        const sb = await getClient();
        const { data, error } = await sb.rpc('create_club_pet', { p_species: species, p_name: name });
        if (error) throw error;
        if (data && typeof window.renderPet === 'function') window.renderPet(data);
        petStatus('🐾 Dein Tier wurde erfolgreich adoptiert.', 'success');
        await refreshPet();
      } catch (error) {
        petStatus(`Tier-Datenbank: ${error?.message || 'Anfrage fehlgeschlagen.'}`, 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Tier adoptieren'; }
      }
    }, true);

    document.addEventListener('click', async event => {
      const action = event.target.closest('.pet-action-btn[data-pet-action]');
      if (action) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (petActionBusy || action.disabled) return;
        petActionBusy = true; action.disabled = true;
        try {
          const sb = await getClient();
          const { data, error } = await sb.rpc('club_pet_action', { p_action: action.dataset.petAction });
          if (error) throw error;
          if (data && typeof window.renderPet === 'function') window.renderPet(data);
          petStatus(`🐾 ${action.dataset.petAction === 'feed' ? 'Dein Tier wurde gefüttert.' : 'Aktion erledigt.'}`, 'success');
          await refreshPet();
        } catch (error) {
          petStatus(error?.message || 'Pet-Aktion konnte nicht ausgeführt werden.', 'error');
        } finally { action.disabled = false; petActionBusy = false; }
        return;
      }

      const buy = event.target.closest('#pet-shop [data-buy-pet]');
      if (buy) {
        event.preventDefault(); event.stopImmediatePropagation();
        try {
          const sb = await getClient();
          const { data, error } = await sb.rpc('buy_pet_item', { p_item_key: buy.dataset.buyPet });
          if (error) throw error;
          if (data?.hub && typeof window.renderPetLife === 'function') window.renderPetLife(data.hub);
          petStatus(`🛍️ ${data?.message || 'Artikel gekauft.'}`, 'success');
        } catch (error) { petStatus(error?.message || 'Kauf konnte nicht abgeschlossen werden.', 'error'); }
        return;
      }

      const mystery = event.target.closest('#pet-mystery-box');
      if (mystery) {
        event.preventDefault(); event.stopImmediatePropagation();
        try {
          const sb = await getClient();
          const { data, error } = await sb.rpc('open_pet_mystery_box');
          if (error) throw error;
          if (data?.hub && typeof window.renderPetLife === 'function') window.renderPetLife(data.hub);
          petStatus(`🎁 ${data?.reward_label || 'Mystery Box geöffnet.'}`, 'success');
        } catch (error) { petStatus(error?.message || 'Mystery Box konnte nicht geöffnet werden.', 'error'); }
        return;
      }

      const game = event.target.closest('#pet-game-snack,#pet-game-paw');
      if (game) {
        event.preventDefault(); event.stopImmediatePropagation();
        try {
          const sb = await getClient();
          const gameKey = game.id === 'pet-game-paw' ? 'lucky_paw' : 'snack_hunt';
          const { data, error } = await sb.rpc('play_pet_minigame', { p_game: gameKey });
          if (error) throw error;
          if (data?.hub && typeof window.renderPetLife === 'function') window.renderPetLife(data.hub);
          petStatus(`🎁 ${data?.reward_label || 'Spiel abgeschlossen.'}`, 'success');
        } catch (error) { petStatus(error?.message || 'Spiel konnte nicht ausgeführt werden.', 'error'); }
      }
    }, true);

    const timer = setInterval(async () => {
      if (window.__acySupabaseClient) { clearInterval(timer); try { await petHub(window.__acySupabaseClient); } catch {} }
    }, 350);
    setTimeout(() => clearInterval(timer), 10000);
  }

  function init() {
    installStyles();
    installVersionBadge();
    cleanHeaderStaffLinks();
    bindDock();
    bindPetFallbacks();
    const observer = new MutationObserver(() => {
      installVersionBadge();
      cleanHeaderStaffLinks();
      bindDock();
      bindPetFallbacks();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
