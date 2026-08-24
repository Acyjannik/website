(() => {
  'use strict';

  const VERSION = '20.0.3';
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);

  if (root.dataset.acyV20Stability === VERSION) return;
  root.dataset.acyV20Stability = VERSION;

  let gameInitPromise = null;
  let gamesCache = null;
  let currentGameId = null;
  let originalLoadQuests = null;
  let questRefreshTimer = null;
  let questRefreshInFlight = null;

  function installStyles() {
    if ($('acy-v20-stability-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v20-stability-style';
    style.textContent = `
      @media (max-width:700px){
        #current-game-card .current-game-controls{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important;align-items:stretch!important}
        #current-game-select{min-width:0!important;width:100%!important;min-height:48px!important;font-size:16px!important}
        #current-game-save{min-height:48px!important;white-space:nowrap!important}
        #current-game-card .current-game-preview{margin-top:12px!important}
      }
      #current-game-select:disabled{opacity:.7}
      #current-game-save.is-saving{pointer-events:none;opacity:.75}
    `;
    document.head.appendChild(style);
  }

  function getSupabaseGlobals() {
    try {
      const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
      const user = typeof currentUser !== 'undefined' ? currentUser : null;
      return client && user ? { client, user } : null;
    } catch {
      return null;
    }
  }

  async function waitForClient(timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ready = getSupabaseGlobals();
      if (ready) return ready;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function fetchGamesOnce(client) {
    if (gamesCache) return gamesCache;
    if (gameInitPromise) return gameInitPromise;
    gameInitPromise = (async () => {
      const { data, error } = await client
        .from('games')
        .select('id,name,tag,image_url,description')
        .eq('enabled', true)
        .order('name', { ascending: true });
      if (error) throw error;
      gamesCache = Array.isArray(data) ? data : [];
      return gamesCache;
    })();
    try {
      return await gameInitPromise;
    } finally {
      gameInitPromise = null;
    }
  }

  function renderGamePreview(game) {
    const box = $('current-game-preview');
    const img = $('current-game-preview-img');
    const name = $('current-game-preview-name');
    const tag = $('current-game-preview-tag');
    const status = $('current-game-status');
    if (!box || !img || !name || !tag || !status) return;
    if (!game) {
      box.hidden = true;
      status.textContent = 'Noch nicht gesetzt';
      return;
    }
    box.hidden = false;
    img.src = game.image_url || '';
    img.alt = game.name || '';
    name.textContent = game.name || 'Unbekanntes Game';
    tag.textContent = game.tag || game.description || '';
    status.textContent = 'Aktiv';
  }

  async function loadCurrentGameFast() {
    const select = $('current-game-select');
    if (!select) return;
    const ready = await waitForClient();
    if (!ready) return;
    const { client, user } = ready;

    const [games, presenceResult] = await Promise.all([
      fetchGamesOnce(client),
      client.from('club_game_presence').select('game_id').eq('user_id', user.id).maybeSingle()
    ]);
    if (presenceResult.error && presenceResult.error.code !== 'PGRST116') throw presenceResult.error;
    currentGameId = presenceResult.data?.game_id || null;

    const fragment = document.createDocumentFragment();
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Ich spiele gerade nichts / ausblenden';
    fragment.appendChild(none);

    for (const game of games) {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      fragment.appendChild(option);
    }

    select.replaceChildren(fragment);
    select.value = currentGameId || '';
    renderGamePreview(games.find(game => String(game.id) === String(currentGameId)) || null);
  }

  async function saveCurrentGameFast() {
    const select = $('current-game-select');
    const button = $('current-game-save');
    if (!select || !button) return;
    const ready = await waitForClient();
    if (!ready) return;
    const { client, user } = ready;
    const nextGameId = select.value || null;
    button.disabled = true;
    button.classList.add('is-saving');
    const oldText = button.textContent;
    button.textContent = 'Speichert…';
    try {
      if (nextGameId) {
        const { error } = await client.from('club_game_presence').upsert({ user_id: user.id, game_id: nextGameId, updated_at: new Date().toISOString() });
        if (error) throw error;
      } else {
        const { error } = await client.from('club_game_presence').delete().eq('user_id', user.id);
        if (error) throw error;
      }

      currentGameId = nextGameId;
      const game = (gamesCache || []).find(item => String(item.id) === String(nextGameId)) || null;
      renderGamePreview(game);
      window.ACY_V20?.refreshQuests?.({ delay: 150, silent: true });
    } catch (error) {
      console.warn('[V20 Stability] Game presence save failed:', error);
      const status = $('current-game-status');
      if (status) status.textContent = 'Speichern fehlgeschlagen';
    } finally {
      button.disabled = false;
      button.classList.remove('is-saving');
      button.textContent = oldText;
    }
  }

  function installGamePicker() {
    const select = $('current-game-select');
    const button = $('current-game-save');
    if (!select || !button || select.dataset.v20GameReady === '1') return;
    select.dataset.v20GameReady = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      saveCurrentGameFast().catch(() => {});
    });
    loadCurrentGameFast().catch(error => console.warn('[V20 Stability] Game picker load failed:', error));
  }

  function installQuestStability() {
    originalLoadQuests = typeof window.loadQuests === 'function' ? window.loadQuests : null;
    if (!originalLoadQuests || originalLoadQuests.__acyV20Stable) return;

    const stableLoadQuests = async function stableQuestLoad(...args) {
      if (questRefreshInFlight) return questRefreshInFlight;
      questRefreshInFlight = Promise.resolve()
        .then(() => originalLoadQuests.apply(this, args))
        .finally(() => { questRefreshInFlight = null; });
      return questRefreshInFlight;
    };
    stableLoadQuests.__acyV20Stable = true;
    window.loadQuests = stableLoadQuests;

    window.ACY_V20 = window.ACY_V20 || {};
    window.ACY_V20.refreshQuests = ({ delay = 250 } = {}) => {
      clearTimeout(questRefreshTimer);
      questRefreshTimer = setTimeout(() => {
        if (typeof window.loadQuests === 'function') window.loadQuests().catch?.(() => {});
      }, Math.max(0, Number(delay) || 0));
    };
  }

  function lazyLoadSectionData(details) {
    if (!details?.open || details.dataset.acyV20Preloaded === '1') return;
    details.dataset.acyV20Preloaded = '1';
    if (details.id === 'club-quests-section') window.ACY_V20?.refreshQuests?.({ delay: 0 });
    if (details.id === 'club-wheel-section') {
      window.loadWheelState?.();
      window.loadWheelHistory?.();
    }
    if (details.id === 'club-rewards-section') window.loadMyRewards?.();
  }

  function installLazySectionPreloads() {
    document.addEventListener('toggle', event => {
      if (event.target instanceof HTMLDetailsElement) lazyLoadSectionData(event.target);
    }, true);
    document.querySelectorAll('details.member-fold').forEach(details => {
      if (details.open) lazyLoadSectionData(details);
    });
  }

  function installPetQuestRefreshBridge() {
    if (root.dataset.acyV20PetQuestBridge === '1') return;
    root.dataset.acyV20PetQuestBridge = '1';
    document.addEventListener('click', event => {
      const petAction = event.target.closest?.('[data-pet-action], #pet-game-snack, #pet-game-paw');
      if (!petAction) return;
      window.ACY_V20?.refreshQuests?.({ delay: 250, silent: true });
    }, false);
  }

  function boot() {
    installStyles();
    installQuestStability();
    installPetQuestRefreshBridge();
    installLazySectionPreloads();
    installGamePicker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
