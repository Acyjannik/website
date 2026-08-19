(() => {
  'use strict';
  const ready = fn => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  function injectStyles() {
    if (document.getElementById('acy-v19-pet-rc7-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v19-pet-rc7-style';
    style.textContent = `
      #member-leaderboard-list img.member-avatar-img,
      #member-leaderboard-list img.member-avatar,
      #member-leaderboard-list .member-avatar-img,
      #member-leaderboard-list .member-avatar,
      #member-leaderboard-list img,
      #member-leaderboard-list .leaderboard-avatar,
      #member-leaderboard-list .leaderboard-avatar img{
        width:52px!important;height:52px!important;min-width:52px!important;max-width:52px!important;min-height:52px!important;max-height:52px!important;
        border-radius:50%!important;object-fit:cover!important;object-position:center!important;overflow:hidden!important;flex:none!important;
      }
      @media(max-width:700px){
        #member-leaderboard-list .leaderboard-row,
        #member-leaderboard-list .leaderboard-item,
        #member-leaderboard-list>div{
          min-width:0!important;
        }
        #member-leaderboard-list img{width:52px!important;height:52px!important;max-width:52px!important;max-height:52px!important}
        #pet-life-v182 .pet-mobile-fold{min-width:0!important;max-width:100%!important;overflow:hidden!important}
        #pet-life-v182 .pet-mobile-fold>summary{min-width:0!important;gap:10px!important}
        #pet-shop{min-width:0!important;max-width:100%!important;overflow:hidden!important}
        #pet-games-v182 .pet-mini-card-v17{min-width:0!important;max-width:100%!important}
        #pet-games-v182 .pet-mini-card-v17 .button{min-width:96px!important;white-space:normal!important}
      }
    `;
    document.head.appendChild(style);
  }

  function showPetMessage(message, type = 'error') {
    const el = document.getElementById('pet-life-status') || document.getElementById('pet-status');
    if (!el) return;
    el.textContent = message;
    el.className = `club-auth-status ${type}`.trim();
  }

  function setupShopToggle() {
    const button = document.getElementById('pet-shop-open');
    const box = document.getElementById('pet-shop');
    if (!button || !box || button.dataset.acyRc7Bound === '1') return;
    button.dataset.acyRc7Bound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const details = button.closest('details');
      if (!details) return;
      if (!window.petLifeState?.shop?.length && typeof window.loadPetLife === 'function') {
        window.loadPetLife().catch(() => {});
      }
      box.hidden = false;
      details.open = !details.open;
      button.setAttribute('aria-expanded', String(details.open));
      button.textContent = details.open
        ? '⌃ Pet-Shop schließen'
        : `🛍️ Pet-Shop · ${Number(window.petLifeState?.shop?.length || 0)} Artikel`;
    }, true);
  }

  function setupGameButtons() {
    const snack = document.getElementById('pet-game-snack');
    const paw = document.getElementById('pet-game-paw');
    [snack, paw].forEach(button => {
      if (!button || button.dataset.acyRc7GameBound === '1') return;
      button.dataset.acyRc7GameBound = '1';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (button.disabled) {
          showPetMessage('Dieses Minigame wurde heute bereits gespielt. Morgen ist wieder eine Runde verfügbar.', '');
          return;
        }
        const game = button === snack ? 'snack_hunt' : 'lucky_paw';
        if (typeof window.openPetGameOverlay === 'function') {
          window.openPetGameOverlay(game);
        } else if (typeof window.finishPetMiniGame === 'function') {
          window.finishPetMiniGame(game).catch?.(() => {});
        } else {
          showPetMessage('Das Minigame konnte gerade nicht initialisiert werden. Bitte den Pet-Bereich einmal aktualisieren.');
        }
      }, true);
    });
  }

  function setupMysteryBox() {
    const button = document.getElementById('pet-mystery-box');
    if (!button || button.dataset.acyRc7BoxBound === '1') return;
    button.dataset.acyRc7BoxBound = '1';
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.disabled) {
        showPetMessage('Du hast aktuell keine Mystery Box. Öffne den Pet-Shop, um eine zu holen.','');
        const details = button.closest('details');
        if (details) details.open = true;
        return;
      }
      if (typeof window.petLifeRpc !== 'function') {
        showPetMessage('Die Mystery Box ist gerade nicht verbunden. Bitte den Pet-Bereich einmal aktualisieren.');
        return;
      }
      button.disabled = true;
      try {
        const result = await window.petLifeRpc('open_pet_mystery_box', {}, 'Mystery Box geöffnet. 🎁');
        if (result?.reward_label) showPetMessage(`🎁 ${result.reward_label}`, 'success');
      } catch (error) {
        showPetMessage(error?.message || 'Mystery Box konnte nicht geöffnet werden.');
      } finally {
        if (typeof window.loadPetLife === 'function') await window.loadPetLife().catch(() => {});
      }
    }, true);
  }

  function hideAvatarErrorSource() {
    const input = document.getElementById('avatar-input');
    if (input) input.dataset.acyRc7Ready = '1';
  }

  function init() {
    injectStyles();
    setupShopToggle();
    setupGameButtons();
    setupMysteryBox();
    hideAvatarErrorSource();
    const observer = new MutationObserver(() => {
      setupShopToggle();
      setupGameButtons();
      setupMysteryBox();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  ready(init);
})();
