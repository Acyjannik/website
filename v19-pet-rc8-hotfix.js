/* ACY CLUB V19 RC8 — Pet runtime, shop and navigation hotfixes. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function petState() {
    return typeof petLifeState !== 'undefined' ? petLifeState : null;
  }

  function setPetMessage(message, type = 'success') {
    const status = $('pet-life-status') || $('pet-status');
    if (!status) return;
    status.textContent = message;
    status.className = `club-auth-status ${type}`.trim();
  }

  async function refreshSlowPetData() {
    const tasks = [];
    if (typeof loadProfile === 'function') tasks.push(Promise.resolve().then(() => loadProfile()));
    if (typeof loadProgressionCatalog === 'function') tasks.push(Promise.resolve().then(() => loadProgressionCatalog()));
    if (typeof loadQuests === 'function') tasks.push(Promise.resolve().then(() => loadQuests()));
    await Promise.allSettled(tasks);
  }

  function patchPetRpc() {
    if (window.__acyPetRpcRc8Patched) return true;
    if (typeof supabaseClient === 'undefined' || !supabaseClient?.rpc) return false;

    window.petLifeRpc = async function rc8PetLifeRpc(fn, args = {}, success = 'Erledigt. 🐾') {
      if (window.__acyPetRpcRc8Pending) return null;
      window.__acyPetRpcRc8Pending = true;
      try {
        const { data, error } = await supabaseClient.rpc(fn, args);
        if (error) throw error;
        if (typeof renderPetLife === 'function') renderPetLife(data?.hub || data || {});
        if (data?.pet && typeof renderPet === 'function') renderPet(data.pet);
        const visibleMessage = data?.reward_label ? `🎁 ${data.reward_label}` : (data?.message || success);
        setPetMessage(visibleMessage, 'success');
        void refreshSlowPetData();
        return data;
      } catch (error) {
        setPetMessage(error?.message || 'Pet-Aktion konnte nicht ausgeführt werden.', 'error');
        throw error;
      } finally {
        window.__acyPetRpcRc8Pending = false;
      }
    };
    window.__acyPetRpcRc8Patched = true;
    return true;
  }

  async function loadShopDirect() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient?.from) throw new Error('Datenbank nicht bereit.');
    const { data, error } = await supabaseClient
      .from('club_pet_items')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    const normalized = (data || []).map(item => ({ ...item, key: item.key || item.item_key }));
    const state = petState();
    if (state) state.shop = normalized;
    return normalized;
  }

  function renderShopDirect(items) {
    const box = $('pet-shop');
    const toggle = $('pet-shop-open');
    if (!box) return;
    box.innerHTML = items.length
      ? items.map(item => `
        <div class="pet-shop-item-v177">
          <span class="pet-shop-icon-v177">${String(item.icon || '📦')}</span>
          <div>
            <strong>${String(item.name || item.item_key || '')}</strong>
            <small>${String(item.detail || '')}</small>
            <em>${Number(item.cost || 0)} AC Coins</em>
          </div>
          <button class="button button-small button-secondary" type="button" data-buy-pet="${String(item.key || '')}">Kaufen</button>
        </div>`).join('')
      : '<div class="club-content-empty">Aktuell sind keine Shop-Artikel verfügbar.</div>';
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!box.hidden));
      toggle.textContent = box.hidden ? `🛍️ Pet-Shop · ${items.length} Artikel` : '⌃ Pet-Shop schließen';
    }
  }

  async function openShop() {
    const box = $('pet-shop');
    if (!box) return;

    if (!box.hidden) {
      box.hidden = true;
      const toggle = $('pet-shop-open');
      toggle?.setAttribute('aria-expanded', 'false');
      if (toggle) toggle.textContent = `🛍️ Pet-Shop · ${(petState()?.shop || []).length} Artikel`;
      const parentDetails = box.closest('details');
      if (parentDetails) parentDetails.open = false;
      return;
    }

    try {
      const parentDetails = box.closest('details');
      if (parentDetails) parentDetails.open = true;
      if (typeof loadPetLife === 'function') await loadPetLife();
      let items = petState()?.shop || [];
      if (!items.length) items = await loadShopDirect();
      box.hidden = false;
      renderShopDirect(items);
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      box.hidden = false;
      renderShopDirect([]);
      setPetMessage(error?.message || 'Pet-Shop konnte nicht geladen werden.', 'error');
    }
  }

  function patchPetNavigation() {
    const petSection = $('pet-section');
    const tabs = [...document.querySelectorAll('.pet-view-tab-v183')];
    const games = $('pet-games-v182');
    const life = $('pet-life-v182');
    const archive = $('pet-archive-panel');
    if (!petSection || !tabs.length) return;

    petSection.removeAttribute('data-pet-view');

    const setView = (view) => {
      petSection.removeAttribute('data-pet-view');
      tabs.forEach(tab => {
        const active = tab.dataset.petView === view;
        tab.classList.toggle('is-primary', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      if (view === 'games') {
        archive && (archive.open = false);
        games && (games.open = true);
        games?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (view === 'archive') {
        games && (games.open = false);
        archive && (archive.open = true);
        archive?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (view === 'life') {
        archive && (archive.open = false);
        games && (games.open = false);
        life?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        archive && (archive.open = false);
        games && (games.open = false);
        petSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      history.replaceState(null, '', `#pet-${view}`);
    };

    tabs.forEach(tab => {
      if (tab.dataset.rc8Bound === '1') return;
      tab.dataset.rc8Bound = '1';
      tab.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setView(tab.dataset.petView || 'home');
      });
    });

    const hashView = location.hash.match(/^#pet-(home|life|games|archive)$/)?.[1];
    if (hashView) setView(hashView);
  }

  function ensureAvatarFallback() {
    if ($('avatar-input')) return;
    const input = document.createElement('input');
    input.id = 'avatar-input';
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.hidden = true;
    document.body?.appendChild(input);
  }

  function injectCompactPetStyles() {
    if ($('acy-pet-rc8-compact-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-pet-rc8-compact-style';
    style.textContent = `
      @media (max-width: 600px) {
        .club-auth-page .pet-section { padding: 16px!important; border-radius: 20px!important; }
        .club-auth-page .pet-section .member-card-head { margin-bottom: 12px!important; }
        .club-auth-page .pet-section .member-card-head p { display:none!important; }
        .club-auth-page .pet-section .member-card-head h2 { margin:2px 0!important; }
        .club-auth-page .pet-section .pet-main { grid-template-columns:58px minmax(0,1fr)!important; gap:10px!important; }
        .club-auth-page .pet-section .pet-avatar { width:58px!important; height:58px!important; }
        .club-auth-page .pet-section .pet-identity h3 { font-size:22px!important; margin:0!important; }
        .club-auth-page .pet-section .pet-trait-v176 { margin-top:6px!important; padding:7px!important; }
        .club-auth-page .pet-section .pet-manage-actions { grid-column:1 / -1!important; display:grid!important; grid-template-columns:1fr 1fr 1fr!important; gap:6px!important; }
        .club-auth-page .pet-section .pet-manage-actions .button { width:100%!important; min-height:38px!important; padding:7px 5px!important; }
        .club-auth-page .pet-section .pet-progression { margin-top:12px!important; padding:12px!important; }
        .club-auth-page .pet-section .pet-stats { gap:7px!important; margin-top:10px!important; }
        .club-auth-page .pet-section .pet-stat { padding:9px!important; }
        .club-auth-page .pet-section .pet-actions { grid-template-columns:1fr 1fr!important; gap:7px!important; margin-top:10px!important; }
        .club-auth-page .pet-section .pet-action-btn { min-height:54px!important; padding:8px!important; font-size:12px!important; }
        .club-auth-page .pet-section .pet-action-btn small { font-size:8px!important; }
        .club-auth-page .pet-section .pet-life-panel-v17 { margin-top:12px!important; padding:0!important; }
        .club-auth-page .pet-section .pet-life-head-v17 { padding:11px!important; }
        .club-auth-page .pet-section .pet-mobile-fold { margin-top:7px!important; }
        .club-auth-page .pet-section .pet-archive-panel-v176 { margin-top:8px!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    ensureAvatarFallback();
    injectCompactPetStyles();
    patchPetNavigation();
    patchPetRpc();

    document.addEventListener('click', async event => {
      const shopButton = event.target.closest('#pet-shop-open');
      if (shopButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        await openShop();
        return;
      }
    }, true);

    const observer = new MutationObserver(() => {
      ensureAvatarFallback();
      injectCompactPetStyles();
      patchPetNavigation();
      patchPetRpc();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
