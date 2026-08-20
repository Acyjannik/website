/* ACY V19 RC12 — Pet interactions: reliable food picker + standalone shop section. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  let clientPromise = null;
  let busy = false;

  if (!document.body?.classList.contains('club-auth-page')) return;

  async function getClient() {
    if (window.__acySupabaseClient) return window.__acySupabaseClient;
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (!window.supabase?.createClient) throw new Error('Supabase-Bibliothek fehlt.');
      const cfg = await fetch('/api/config?_=19120', { cache: 'no-store' }).then(r => r.json());
      if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Supabase-Konfiguration fehlt.');
      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__acySupabaseClient = client;
      return client;
    })();
    return clientPromise;
  }

  function status(message, type = '') {
    const el = $('pet-life-status') || $('pet-status');
    if (!el) return;
    el.textContent = message;
    el.className = `club-auth-status ${type}`.trim();
  }

  function ensureStyles() {
    if ($('acy-rc12-pet-interaction-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-rc12-pet-interaction-style';
    style.textContent = `
      .notification-bell{position:relative!important;overflow:visible!important;isolation:isolate}
      .notification-bell .notification-count{position:absolute!important;top:-5px!important;right:-5px!important;z-index:5!important;display:grid!important;place-items:center!important;min-width:18px!important;height:18px!important;padding:0 4px!important;box-sizing:border-box!important;border-radius:999px!important;line-height:1!important;font-size:10px!important;font-weight:900!important;white-space:nowrap!important;overflow:visible!important;transform:none!important}

      #acy-pet-food-picker{position:fixed;inset:0;z-index:14000;display:grid;place-items:center;padding:20px;background:rgba(3,3,7,.72);backdrop-filter:blur(12px)}
      #acy-pet-food-picker[hidden]{display:none!important}
      .acy-food-picker-card{width:min(620px,100%);max-height:min(760px,calc(100vh - 40px));overflow:auto;padding:20px;border:1px solid rgba(180,108,255,.28);border-radius:24px;background:linear-gradient(145deg,#17131f,#0d0d13);box-shadow:0 30px 100px rgba(0,0,0,.5)}
      .acy-food-picker-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
      .acy-food-picker-head h3{margin:0;font-size:22px;letter-spacing:-.02em}
      .acy-food-picker-head p{margin:5px 0 0;color:#a1a1aa;font-size:12px}
      .acy-food-picker-close{width:36px!important;height:36px!important;padding:0!important;border-radius:50%!important;flex:0 0 36px}
      .acy-food-picker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .acy-food-choice{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025);color:#f7f3ff;text-align:left;cursor:pointer}
      .acy-food-choice:hover{border-color:rgba(180,108,255,.42);background:rgba(168,85,247,.08)}
      .acy-food-choice:disabled{opacity:.55;cursor:wait}
      .acy-food-choice-icon{font-size:25px}
      .acy-food-choice strong{display:block;font-size:13px}
      .acy-food-choice small{display:block;margin-top:3px;color:#a1a1aa;font-size:10px;line-height:1.35}
      .acy-food-choice-qty{min-width:30px;padding:5px 7px;border-radius:999px;background:rgba(168,85,247,.12);color:#e9d5ff;font-size:11px;font-weight:900;text-align:center}
      .acy-food-empty{padding:18px;border:1px dashed rgba(255,255,255,.12);border-radius:16px;color:#a1a1aa;text-align:center;font-size:13px}

      #pet-rewards-panel{margin-top:8px}
      #pet-shop-panel{margin-top:8px;border-color:rgba(180,108,255,.30)!important;background:linear-gradient(135deg,rgba(168,85,247,.075),rgba(255,255,255,.018))!important}
      #pet-shop-panel > summary{min-height:72px!important;padding:17px 20px!important}
      #pet-shop-panel > summary strong{display:block;font-size:15px}
      #pet-shop-panel > summary small{display:block;margin-top:3px;color:#a1a1aa;font-size:11px;font-weight:500}
      #pet-shop-panel .pet-shop-v19-wrap{padding:0 20px 20px}
      #pet-shop-panel #pet-shop-open{width:100%;margin-bottom:10px;min-height:48px}
      #pet-shop-panel #pet-shop{margin-top:0}
      @media(max-width:650px){
        #acy-pet-food-picker{padding:12px}
        .acy-food-picker-card{padding:16px;border-radius:20px;max-height:calc(100vh - 24px)}
        .acy-food-picker-grid{grid-template-columns:1fr}
        #pet-shop-panel > summary{min-height:64px!important;padding:14px 16px!important}
        #pet-shop-panel .pet-shop-v19-wrap{padding:0 16px 16px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePicker() {
    let picker = $('acy-pet-food-picker');
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = 'acy-pet-food-picker';
    picker.hidden = true;
    picker.innerHTML = `
      <div class="acy-food-picker-card" role="dialog" aria-modal="true" aria-labelledby="acy-food-picker-title">
        <div class="acy-food-picker-head">
          <div><h3 id="acy-food-picker-title">🍖 Futter auswählen</h3><p>Wähle genau das Futter aus deinem Inventar, das dein Tier bekommen soll.</p></div>
          <button class="button button-secondary acy-food-picker-close" type="button" aria-label="Futterauswahl schließen">×</button>
        </div>
        <div class="acy-food-picker-grid" id="acy-pet-food-picker-grid"></div>
      </div>`;
    document.body.appendChild(picker);
    picker.addEventListener('click', event => {
      if (event.target === picker || event.target.closest('.acy-food-picker-close')) closeFoodPicker();
    });
    return picker;
  }

  function closeFoodPicker() {
    const picker = $('acy-pet-food-picker');
    if (picker) picker.hidden = true;
  }

  async function refreshPet() {
    try { if (typeof window.loadPet === 'function') await window.loadPet(); } catch {}
    try { if (typeof window.loadPetLife === 'function') await window.loadPetLife(); } catch {}
  }

  async function useFood(item, button) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.querySelector('.acy-food-choice-qty')?.replaceChildren(document.createTextNode('…'));
    try {
      const itemKey = String(item?.key || item?.item_key || '').trim();
      if (!itemKey) throw new Error('Futter-Artikel konnte nicht eindeutig bestimmt werden.');
      const client = await getClient();
      const { data, error } = await client.rpc('use_pet_item', { p_item_key: itemKey });
      if (error) throw error;
      if (data?.pet && typeof window.renderPet === 'function') window.renderPet(data.pet);
      if (data?.hub && typeof window.renderPetLife === 'function') window.renderPetLife(data.hub);
      closeFoodPicker();
      status(`🍖 ${data?.message || `${item.name} verwendet.`}`, 'success');
      await refreshPet();
    } catch (error) {
      status(`Füttern: ${error?.message || 'Futter konnte nicht verwendet werden.'}`, 'error');
      await refreshPet();
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  async function openFoodPicker() {
    const picker = ensurePicker();
    const grid = $('acy-pet-food-picker-grid');
    if (!grid) return;
    picker.hidden = false;
    grid.innerHTML = '<div class="acy-food-empty">Inventar wird geladen…</div>';
    try {
      const client = await getClient();
      const { data, error } = await client.rpc('get_pet_life_hub');
      if (error) throw error;
      const foods = (Array.isArray(data?.inventory) ? data.inventory : [])
        .filter(item => item?.item_type === 'food' && Number(item.quantity) > 0);

      if (!foods.length) {
        grid.innerHTML = '<div class="acy-food-empty">Du hast aktuell kein Futter im Inventar.</div>';
        return;
      }

      grid.innerHTML = foods.map(item => `
        <button class="acy-food-choice" type="button" data-food-key="${esc(item.key || item.item_key)}">
          <span class="acy-food-choice-icon">${esc(item.icon || '🍖')}</span>
          <span><strong>${esc(item.name)}</strong><small>+${Number(item.hunger || 0)} Hunger${Number(item.happiness || 0) ? ` · +${Number(item.happiness)} Laune` : ''}${Number(item.energy || 0) ? ` · ${Number(item.energy) > 0 ? '+' : ''}${Number(item.energy)} Energie` : ''}</small></span>
          <span class="acy-food-choice-qty">×${Number(item.quantity)}</span>
        </button>`).join('');

      grid.querySelectorAll('[data-food-key]').forEach(button => {
        const item = foods.find(entry => String(entry.key || entry.item_key) === String(button.dataset.foodKey));
        if (item) button.addEventListener('click', () => useFood({ ...item, key: item.key || item.item_key }, button), { once: true });
      });
    } catch (error) {
      grid.innerHTML = `<div class="acy-food-empty">${esc(error?.message || 'Inventar konnte nicht geladen werden.')}</div>`;
    }
  }

  function separateShopFromRewards() {
    const shopButton = $('pet-shop-open');
    const shopBox = $('pet-shop');
    if (!shopButton || !shopBox) return;
    if ($('pet-shop-panel')) return;

    const rewardsDetails = shopButton.closest('details.pet-life-fold');
    if (!rewardsDetails) return;

    const actions = shopButton.closest('.pet-life-actions-v17');
    if (actions) actions.removeChild(shopButton);

    const summary = rewardsDetails.querySelector(':scope > summary');
    if (summary) summary.innerHTML = '🎁 Belohnungen <b>⌄</b>';
    rewardsDetails.id = 'pet-rewards-panel';

    const shopDetails = document.createElement('details');
    shopDetails.className = 'pet-mobile-fold pet-life-fold pet-shop-fold-v19';
    shopDetails.id = 'pet-shop-panel';
    shopDetails.innerHTML = `
      <summary>🛍️ <strong>Pet-Shop</strong><small>Futter, Boosts, Spielzeug & mehr</small><b>⌄</b></summary>
      <div class="pet-shop-v19-wrap"></div>`;
    rewardsDetails.after(shopDetails);

    const wrap = shopDetails.querySelector('.pet-shop-v19-wrap');
    wrap.appendChild(shopButton);
    wrap.appendChild(shopBox);
    shopBox.hidden = true;
    shopButton.setAttribute('aria-expanded', 'false');
    shopButton.textContent = '🛍️ Shop öffnen';

    shopDetails.addEventListener('toggle', () => {
      if (!shopDetails.open) {
        shopBox.hidden = true;
        shopButton.setAttribute('aria-expanded', 'false');
        shopButton.textContent = '🛍️ Shop öffnen';
      }
    });
  }

  async function toggleShop(event) {
    const button = event.target.closest('#pet-shop-open');
    if (!button) return false;
    const box = $('pet-shop');
    if (!box) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!box.hidden) {
      box.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.textContent = '🛍️ Shop öffnen';
      return true;
    }

    try {
      const client = await getClient();
      const { data, error } = await client.rpc('get_pet_life_hub');
      if (error) throw error;
      const shop = Array.isArray(data?.shop) ? data.shop : [];
      box.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.textContent = '⌃ Shop schließen';
      box.innerHTML = shop.length ? shop.map(item => `
        <div class="pet-shop-item-v177">
          <span class="pet-shop-icon-v177">${esc(item.icon || '📦')}</span>
          <div><strong>${esc(item.name)}</strong><small>${esc(item.detail || '')}</small><em>${Number(item.cost || 0)} AC Coins</em></div>
          <button class="button button-small button-secondary" type="button" data-buy-pet="${esc(item.key || item.item_key)}">Kaufen</button>
        </div>`).join('') : '<div class="club-content-empty">Aktuell sind keine Shop-Artikel verfügbar.</div>';
    } catch (error) {
      box.hidden = false;
      status(error?.message || 'Pet-Shop konnte nicht geladen werden.', 'error');
    }
    return true;
  }

  function bind() {
    if (document.documentElement.dataset.acyRc12PetInteraction === '1') return;
    document.documentElement.dataset.acyRc12PetInteraction = '1';
    ensureStyles();
    ensurePicker();
    separateShopFromRewards();

    // Window capture runs before legacy document/body handlers. This prevents the old
    // RC9/RC10 feed handlers from calling club_pet_action('feed'), which the database
    // intentionally rejects because feeding must use an inventory item.
    window.addEventListener('click', event => {
      const feed = event.target.closest('.pet-action-btn[data-pet-action="feed"]');
      if (feed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!feed.disabled) void openFoodPicker();
        return;
      }
      void toggleShop(event);
    }, true);

    setTimeout(separateShopFromRewards, 250);
    setTimeout(separateShopFromRewards, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
