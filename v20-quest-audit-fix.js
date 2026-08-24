(() => {
  'use strict';

  let patched = false;
  let bootTimer = null;

  async function syncPetQuests() {
    try {
      if (typeof currentUser === 'undefined' || !currentUser || typeof supabaseClient === 'undefined' || !supabaseClient) return null;
      const { data, error } = await supabaseClient.rpc('sync_pet_quests');
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn('[V20 Quest Audit] Pet quest sync skipped:', error);
      return null;
    }
  }

  function patchQuestFunctions() {
    if (patched) return true;
    if (typeof window.loadQuests !== 'function' || typeof window.progressQuestsForAction !== 'function') return false;

    const originalLoadQuests = window.loadQuests;
    window.loadQuests = async function questAuditLoadQuests(...args) {
      await syncPetQuests();
      return originalLoadQuests.apply(this, args);
    };

    const originalProgressQuests = window.progressQuestsForAction;
    window.progressQuestsForAction = async function questAuditProgress(actionKey, ...args) {
      // weekly_games is derived from distinct server-side game presence.
      // The old client hook counted every save, including the same game repeatedly.
      if (actionKey === 'game_explored') {
        await syncPetQuests();
        return window.loadQuests?.();
      }
      return originalProgressQuests.apply(this, [actionKey, ...args]);
    };

    patched = true;
    console.info('[V20 Quest Audit] Quest tracking hardening active.');
    return true;
  }

  function installPetRecovery() {
    if (document.documentElement.dataset.acyQuestPetRecovery === '1') return;
    document.documentElement.dataset.acyQuestPetRecovery = '1';

    document.addEventListener('click', event => {
      const petAction = event.target.closest?.('[data-pet-action]');
      const petGame = event.target.closest?.('#pet-game-snack, #pet-game-paw');
      if (!petAction && !petGame) return;

      // The pet RPC is asynchronous and some Pet actions use a different
      // backend path (notably feeding). Re-read the authoritative activity log
      // after the action so quests never depend on a client-side callback.
      setTimeout(() => {
        syncPetQuests().then(() => window.loadQuests?.()).catch(() => {});
      }, 900);
    }, true);
  }

  function boot() {
    if (patchQuestFunctions()) {
      installPetRecovery();
      if (bootTimer) clearInterval(bootTimer);
      bootTimer = null;
      setTimeout(() => syncPetQuests().catch(() => {}), 500);
      return;
    }
    if (!bootTimer) {
      bootTimer = setInterval(() => {
        if (patchQuestFunctions()) {
          installPetRecovery();
          clearInterval(bootTimer);
          bootTimer = null;
          setTimeout(() => syncPetQuests().catch(() => {}), 500);
        }
      }, 100);
      setTimeout(() => {
        if (bootTimer) {
          clearInterval(bootTimer);
          bootTimer = null;
        }
      }, 10000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
