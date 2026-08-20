/* ACY V19 RC11 — canonical version, Pet DB recovery, isolated mobile navigation. */
(() => {
  'use strict';
  const VERSION = 'V19.0.0 · RC11';
  const PET_PATH = /\/pet\.html$/i.test(location.pathname);
  const CLUB_PATH = /\/club-profile\.html$/i.test(location.pathname);
  const $ = (id) => document.getElementById(id);

  function removeOldVersionBadges() {
    const selectors = [
      '#acy-build-marker', '#acy-v19-rc6-badge', '#acy-dev-version-badge',
      '#acy-v189-version-badge', '#acy-v19-rc-badge', '#acy-v19-rc-badge-v2',
      '#acy-v19-rc-safe-badge', '#acy-v19-rc3-badge', '#acy-v19-rc5-badge',
      '#acy-canonical-version-badge', '#acy-v19-canonical-version',
      '.streamer-version', '[data-acy-version-badge]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').trim();
      if (/^(?:V18\.[0-9.]+\s*·\s*DEV|V19\.0\.0\s*·\s*RC\d+)$/.test(text)) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || rect.width < 260 || el.className?.toString().toLowerCase().includes('version')) el.remove();
      }
    });
  }

  function installCanonicalBadge() {
    removeOldVersionBadges();
    let badge = $('acy-v19-canonical-version');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-v19-canonical-version';
      badge.dataset.acyVersionBadge = '1';
      document.body.appendChild(badge);
    }
    badge.textContent = VERSION;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = [
      'position:fixed','top:max(8px,env(safe-area-inset-top))','right:10px','z-index:13000',
      'padding:7px 11px','border:1px solid rgba(180,108,255,.42)','border-radius:999px',
      'background:rgba(10,9,15,.94)','backdrop-filter:blur(14px)','color:#f7f3ff',
      'font:800 11px/1.1 system-ui,sans-serif','letter-spacing:.04em','pointer-events:none',
      'white-space:nowrap','box-shadow:0 8px 30px rgba(0,0,0,.28)'
    ].join(';');
  }

  async function getSupabaseClient() {
    if (window.__acySupabaseClient) return window.__acySupabaseClient;
    if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
    const response = await fetch(`/api/config?_=19010`, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
    const cfg = await response.json().catch(() => ({}));
    if (!response.ok || !cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.__acySupabaseClient = client;
    return client;
  }

  async function getSession() {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) throw new Error('Keine aktive Anmeldung gefunden.');
    return { client, session: data.session };
  }

  function setPetStatus(text, type = '') {
    const el = $('pet-status') || $('pet-life-status');
    if (!el) return;
    el.textContent = text;
    el.className = `club-auth-status ${type}`.trim();
  }

  async function loadPetRobust() {
    if (!PET_PATH && !CLUB_PATH) return;
    try {
      const { client, session } = await getSession();
      let pet = null;
      let rpcError = null;
      try {
        const rpc = await client.rpc('get_club_pet');
        pet = rpc.data;
        rpcError = rpc.error;
      } catch (error) {
        rpcError = error;
      }

      if (rpcError) {
        const direct = await client
          .from('club_pets')
          .select('user_id,species,name,hunger,happiness,energy,pet_xp,created_at,updated_at,last_interaction_at')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (direct.error) throw rpcError;
        pet = direct.data;
      }

      if (typeof window.renderPet === 'function') window.renderPet(pet || null);
      else if (typeof renderPet === 'function') renderPet(pet || null);
      if (!pet) setPetStatus('', '');
      return pet || null;
    } catch (error) {
      console.warn('[RC11] Pet DB recovery:', error);
      setPetStatus(`Tier-Datenbank konnte nicht geladen werden: ${error?.message || 'Unbekannter Fehler'}`, 'error');
      return null;
    }
  }

  async function loadPetLifeRobust() {
    if (!PET_PATH && !CLUB_PATH) return;
    try {
      const { client } = await getSession();
      const { data, error } = await client.rpc('get_pet_life_hub');
      if (error) throw error;
      if (typeof window.renderPetLife === 'function') window.renderPetLife(data || {});
      return data || {};
    } catch (error) {
      console.warn('[RC11] Pet Life DB recovery:', error);
      const status = $('pet-life-status');
      if (status) {
        status.textContent = `Pet Life konnte nicht geladen werden: ${error?.message || 'Unbekannter Fehler'}`;
        status.className = 'club-auth-status error';
      }
      return null;
    }
  }

  function patchPetLoading() {
    if (!PET_PATH) return;
    window.loadPet = loadPetRobust;
    window.loadPetLife = loadPetLifeRobust;
    const run = () => {
      loadPetRobust();
      loadPetLifeRobust();
    };
    if (document.readyState === 'complete') setTimeout(run, 50);
    else window.addEventListener('load', run, { once: true });
  }

  function patchPetCreate() {
    if (!PET_PATH || document.documentElement.dataset.acyRc10PetCreate === '1') return;
    const form = $('pet-create-form');
    if (!form) return;
    document.documentElement.dataset.acyRc10PetCreate = '1';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const species = form.querySelector('input[name="pet-species"]:checked')?.value || '';
      const name = ($('pet-name-input')?.value || '').trim();
      const button = form.querySelector('button[type="submit"]');
      if (!species) return setPetStatus('Bitte wähle zuerst ein Tier.', 'error');
      if (name.length < 2 || name.length > 18) return setPetStatus('Der Tiername muss 2 bis 18 Zeichen lang sein.', 'error');
      if (button) { button.disabled = true; button.textContent = 'Tier wird adoptiert…'; }
      try {
        const { client } = await getSession();
        const { data, error } = await client.rpc('create_club_pet', { p_species: species, p_name: name });
        if (error) throw error;
        if (typeof window.renderPet === 'function') window.renderPet(data);
        setPetStatus('🐾 Dein neuer Begleiter ist da.', 'success');
        await Promise.allSettled([loadPetLifeRobust()]);
      } catch (error) {
        setPetStatus(`Adoption fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`, 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Tier adoptieren'; }
      }
    }, true);
  }

  const GROUPS = {
    home: new Set(['acy-v18-home','member-spotlight','member-hub','current-game-card','member-news-section','member-games-section']),
    quests: new Set(['club-quests-section','club-daily-section','daily-section','daily-streak-section','club-rewards-section','progression-catalog','member-badges-section','club-wheel-section','member-events-section','community-poll']),
    social: new Set(['social-connections-section','club-messages','club-chat','member-directory-section','member-friends-section','club-friends','clips-section','member-leaderboard-section']),
    more: new Set(['member-news-section','clips-section','member-leaderboard-section','stats-section','discord-section','club-settings-section'])
  };

  function isTopNavOrShell(el) {
    if (!el) return true;
    if (el.id === 'member-hub') return false;
    if (el.closest('.club-auth-header') || el.closest('.mobile-club-dock') || el.closest('.mobile-more-sheet-v181')) return true;
    return el.matches('.member-header-actions,.member-section-nav,.member-top-nav,.member-tabs,.member-subnav');
  }

  function buildNavIsolationIndex() {
    if (!CLUB_PATH) return [];
    const nodes = [...document.querySelectorAll('main > section, main > details, main > div.member-card, main > div.member-fold, .member-content > section, .member-content > details')];
    return nodes.filter(el => !isTopNavOrShell(el));
  }

  function classifySection(el) {
    const id = el.id || '';
    for (const [group, ids] of Object.entries(GROUPS)) if (ids.has(id)) return group;
    const text = (el.querySelector('h1,h2,h3,summary')?.textContent || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (/Nachrichten|Chat|Freunde|Mitglieder|Ranking|Clips|Social/i.test(text)) return 'social';
    if (/Quest|Daily|Reward|Belohn|Fortschritt|Achievement|Badges|Glücksrad|Event|Community Vote/i.test(text)) return 'quests';
    if (/News|Discord|Einstellungen|Statistik/i.test(text)) return 'more';
    if (/Spotlight|Club-Fortschritt|Dein Club|Willkommen|Aktuelles Game/i.test(text)) return 'home';
    return 'home';
  }

  function applySectionIsolation(group) {
    if (!CLUB_PATH || !group) return;
    const nodes = buildNavIsolationIndex();
    document.body.dataset.acyMobileSection = group;
    nodes.forEach(el => {
      const belongs = group === 'more' ? classifySection(el) === 'more' : classifySection(el) === group;
      el.classList.toggle('acy-nav-isolation-hidden', !belongs);
    });
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item => {
      const active = item.dataset.dockKey === group || (group === 'more' && item.dataset.dockKey === 'more');
      item.classList.toggle('is-active', active);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function installNavIsolationStyles() {
    if ($('acy-rc10-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-rc10-nav-style';
    style.textContent = `.acy-nav-isolation-hidden{display:none!important}@media(max-width:700px){main > section.member-card.acy-nav-isolation-hidden,main > details.acy-nav-isolation-hidden,main > div.member-card.acy-nav-isolation-hidden,main > div.member-fold.acy-nav-isolation-hidden{display:none!important}}`;
    document.head.appendChild(style);
  }

  function installDockIsolation() {
    if (!CLUB_PATH || document.documentElement.dataset.acyRc10Dock === '1') return;
    document.documentElement.dataset.acyRc10Dock = '1';
    document.addEventListener('click', event => {
      const item = event.target.closest('.mobile-club-dock [data-dock-key]');
      if (!item) return;
      const key = item.dataset.dockKey;
      if (!['home','quests','social'].includes(key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applySectionIsolation(key);
    }, true);
    setTimeout(() => applySectionIsolation('home'), 900);
  }

  function removeAdminModHeader() {
    if (!CLUB_PATH) return;
    document.querySelectorAll('a,button,[role="button"]').forEach(el => {
      if (el.id === 'mobile-dock-more-v18') return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (/^⚙️?\s*Admin\s*\/\s*Mod$/i.test(text) || /^Admin\s*\/\s*Mod$/i.test(text) || href.includes('/admin.html') || href.includes('/mod.html')) {
        el.remove();
      }
    });
  }

  function init() {
    installCanonicalBadge();
    installNavIsolationStyles();
    removeAdminModHeader();
    installDockIsolation();
    if (PET_PATH) {
      patchPetLoading();
      patchPetCreate();
      setTimeout(() => { patchPetCreate(); loadPetRobust(); loadPetLifeRobust(); }, 700);
    }
    const observer = new MutationObserver(() => {
      removeOldVersionBadges();
      installCanonicalBadge();
      removeAdminModHeader();
      if (PET_PATH) patchPetCreate();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
