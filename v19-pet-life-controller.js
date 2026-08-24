/* ACY V19.2 — Pet Life controller.
 * One deterministic interaction layer for the Pet page.
 * Owns Pet actions, rewards, games, shop and view tabs so older handlers cannot
 * silently swallow clicks or leave the page half-alive.
 */
(() => {
  'use strict';

  if (!/\/(pet\.html|club-profile\.html)$/i.test(location.pathname)) return;
  if (document.documentElement.dataset.acyPetLifeController === '1') return;
  document.documentElement.dataset.acyPetLifeController = '1';

  const $ = id => document.getElementById(id);
  let clientPromise = null;
  let busy = false;

  const status = (message, type = '') => {
    const el = $('pet-life-status') || $('pet-status');
    if (!el) return;
    el.textContent = message || '';
    el.className = `club-auth-status ${type}`.trim();
  };

  async function getClient() {
    if (window.__acySupabaseClient?.rpc) return window.__acySupabaseClient;
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
      const response = await fetch('/api/config?pet_controller=19200', { cache: 'no-store' });
      const cfg = await response.json();
      if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__acySupabaseClient = client;
      return client;
    })();
    return clientPromise;
  }

  // Refresh is deliberately non-blocking. The action result updates the UI first;
  // background reloads reconcile Pet/Quest data afterwards without making buttons
  // look stuck while secondary reads are still running.
  function refresh() {
    const jobs = [
      typeof window.loadPet === 'function' ? window.loadPet() : Promise.resolve(),
      typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve()
    ];
    return Promise.allSettled(jobs);
  }

  async function rpc(name, args = {}) {
    const client = await getClient();
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  function applyResult(data) {
    if (data?.pet && typeof window.renderPet === 'function') window.renderPet(data.pet);
    if (data?.hub && typeof window.renderPetLife === 'function') window.renderPetLife(data.hub);
    return data;
  }

  async function run(action, button) {
    if (busy || button?.disabled) return;
    busy = true;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    try {
      if (action === 'feed') {
        await openFoodPicker();
        return;
      }
      const data = await rpc('club_pet_action', { p_action: action });
      applyResult(data);
      status(data?.message || 'Dein Tier freut sich. 🐾', 'success');
      void refresh();
    } catch (error) {
      status(error?.message || 'Pet-Aktion konnte nicht ausgeführt werden.', 'error');
      void refresh();
    } finally {
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
      busy = false;
    }
  }

  async function openFoodPicker() {
    let picker = $('acy-pet-controller-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'acy-pet-controller-picker';
      picker.style.cssText = 'position:fixed;inset:0;z-index:15000;display:grid;place-items:center;padding:16px;background:rgba(3,3,7,.78);backdrop-filter:blur(12px)';
      picker.innerHTML = '<div style="width:min(620px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px;border:1px solid rgba(180,108,255,.28);border-radius:22px;background:#121018;color:#f7f3ff;box-shadow:0 30px 100px rgba(0,0,0,.55)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong style="font-size:20px">🍖 Futter auswählen</strong><div style="color:#a1a1aa;font-size:12px;margin-top:4px">Wähle ein Futter aus deinem Inventar.</div></div><button type="button" data-food-close style="width:36px;height:36px;border-radius:50%">×</button></div><div id="acy-pet-controller-food-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px"></div></div>';
      document.body.appendChild(picker);
      picker.addEventListener('click', event => {
        if (event.target === picker || event.target.closest('[data-food-close]')) picker.remove();
      });
    }
    picker.hidden = false;
    const grid = $('acy-pet-controller-food-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="padding:16px;color:#a1a1aa">Inventar wird geladen…</div>';
    try {
      const [hub, pet] = await Promise.all([rpc('get_pet_life_hub'), rpc('get_club_pet')]);
      const foods = (Array.isArray(hub?.inventory) ? hub.inventory : []).filter(item => item?.item_type === 'food' && Number(item.quantity) > 0);
      if (!foods.length) { grid.innerHTML = '<div style="padding:16px;color:#a1a1aa">Du hast aktuell kein Futter im Inventar.</div>'; return; }
      const full = Number(pet?.hunger ?? 0) >= 100;
      grid.innerHTML = (full ? '<div style="grid-column:1/-1;padding:12px;border-radius:14px;background:rgba(248,113,113,.08);color:#fecaca">Dein Tier ist bereits satt.</div>' : '') + foods.map(item => `<button type="button" data-food-key="${escapeHtml(item.key)}" ${full ? 'disabled' : ''} style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025);color:inherit;text-align:left"><span style="font-size:24px">${escapeHtml(item.icon || '🍖')}</span><span><strong>${escapeHtml(item.name)}</strong><small style="display:block;color:#a1a1aa;margin-top:3px">+${Number(item.hunger || 0)} Hunger</small></span><b>×${Number(item.quantity)}</b></button>`).join('');
      if (!full) grid.querySelectorAll('[data-food-key]').forEach(button => button.addEventListener('click', () => useFood(button.dataset.foodKey, button), { once: true }));
    } catch (error) {
      grid.innerHTML = `<div style="padding:16px;color:#fecaca">${escapeHtml(error?.message || 'Inventar konnte nicht geladen werden.')}</div>`;
    }
  }

  async function useFood(itemKey, button) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    try {
      const data = await rpc('use_pet_item', { p_item_key: itemKey });
      applyResult(data);
      $('acy-pet-controller-picker')?.remove();
      status(`🍖 ${data?.message || 'Futter verwendet.'}`, 'success');
      void refresh();
    } catch (error) {
      status(`Füttern: ${error?.message || 'Futter konnte nicht verwendet werden.'}`, 'error');
      void refresh();
    } finally {
      busy = false;
    }
  }

  async function claimDaily(button) {
    if (busy || button.disabled) return;
    busy = true; button.disabled = true;
    try { const data = await rpc('claim_pet_daily_supply'); applyResult(data); status(data?.message || '+2 Snacks und +10 AC Coins. 🎁', 'success'); void refresh(); }
    catch (error) { status(error?.message || 'Tagesvorrat konnte nicht abgeholt werden.', 'error'); void refresh(); }
    finally { button.disabled = false; busy = false; }
  }

  async function mystery(button) {
    if (busy || button.disabled) return;
    busy = true; button.disabled = true;
    try { const data = await rpc('open_pet_mystery_box'); applyResult(data); status(data?.reward_label ? `🎁 ${data.reward_label}` : 'Mystery Box geöffnet. 🎁', 'success'); void refresh(); }
    catch (error) { status(error?.message || 'Mystery Box konnte nicht geöffnet werden.', 'error'); void refresh(); }
    finally { button.disabled = false; busy = false; }
  }

  async function game(gameKey, button) {
    if (busy || button.disabled) return;
    busy = true; button.disabled = true;
    try { const data = await rpc('play_pet_minigame', { p_game: gameKey }); applyResult(data); status(data?.reward_label ? `🎮 ${data.reward_label}` : 'Spiel abgeschlossen. 🎁', 'success'); void refresh(); }
    catch (error) { status(error?.message || 'Spiel konnte nicht gestartet werden.', 'error'); void refresh(); }
    finally { button.disabled = false; busy = false; }
  }

  async function openShop() {
    const box = $('pet-shop');
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    try {
      const hub = await rpc('get_pet_life_hub');
      const shop = Array.isArray(hub?.shop) ? hub.shop : [];
      box.hidden = false;
      box.innerHTML = shop.length ? shop.map(item => `<div class="pet-shop-item-v177"><span class="pet-shop-icon-v177">${escapeHtml(item.icon || '📦')}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail || '')}</small><em>${Number(item.cost || 0)} AC Coins</em></div><button class="button button-small button-secondary" type="button" data-buy-pet="${escapeHtml(item.key)}">Kaufen</button></div>`).join('') : '<div class="club-content-empty">Aktuell sind keine Shop-Artikel verfügbar.</div>';
    } catch (error) { box.hidden = false; status(error?.message || 'Pet-Shop konnte nicht geladen werden.', 'error'); }
  }

  async function buy(itemKey, button) {
    if (busy || button.disabled) return;
    busy = true; button.disabled = true;
    try { const data = await rpc('buy_pet_item', { p_item_key: itemKey }); applyResult(data); status(data?.message || `${itemKey} gekauft. 🛍️`, 'success'); void refresh(); }
    catch (error) { status(error?.message || 'Artikel konnte nicht gekauft werden.', 'error'); void refresh(); }
    finally { button.disabled = false; busy = false; }
  }

  function switchView(view) {
    const section = $('pet-section');
    if (!section) return;
    section.dataset.petView = view;
    document.querySelectorAll('[data-pet-view]').forEach(el => {
      if (el.tagName === 'BUTTON') el.setAttribute('aria-selected', String(el.dataset.petView === view));
    });
    if (view === 'life') document.getElementById('pet-life-v182')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (view === 'games') { const games = $('pet-games-v182'); if (games) { games.open = true; games.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    if (view === 'archive') $('pet-archive-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  }

  function bind() {
    if (document.documentElement.dataset.acyPetLifeControllerBound === '1') return;
    document.documentElement.dataset.acyPetLifeControllerBound = '1';
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.matches('.pet-action-btn[data-pet-action]')) {
        event.preventDefault(); event.stopImmediatePropagation(); void run(target.dataset.petAction, target); return;
      }
      if (target.id === 'pet-daily-supply') { event.preventDefault(); event.stopImmediatePropagation(); void claimDaily(target); return; }
      if (target.id === 'pet-mystery-box') { event.preventDefault(); event.stopImmediatePropagation(); void mystery(target); return; }
      if (target.id === 'pet-game-snack') { event.preventDefault(); event.stopImmediatePropagation(); void game('snack_hunt', target); return; }
      if (target.id === 'pet-game-paw') { event.preventDefault(); event.stopImmediatePropagation(); void game('lucky_paw', target); return; }
      if (target.id === 'pet-shop-open') { event.preventDefault(); event.stopImmediatePropagation(); void openShop(); return; }
      if (target.matches('[data-buy-pet]')) { event.preventDefault(); event.stopImmediatePropagation(); void buy(target.dataset.buyPet, target); return; }
      if (target.matches('[data-pet-view]')) { event.preventDefault(); event.stopImmediatePropagation(); switchView(target.dataset.petView); return; }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
