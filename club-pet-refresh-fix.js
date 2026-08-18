/* ACY Pet refresh compatibility fix.
 * Loaded after club-profile.js so successful Pet Life actions always re-read
 * the canonical hub state and refresh quest progress in the visible UI.
 */
(() => {
  const install = () => {
    if (typeof window.petLifeRpc === 'function' && !window.__acyPetLifeRpcRefreshPatched) {
      const originalPetLifeRpc = window.petLifeRpc;
      window.petLifeRpc = async function patchedPetLifeRpc(fn, args = {}, success = 'Erledigt. 🐾') {
        const result = await originalPetLifeRpc(fn, args, success);
        await Promise.allSettled([
          typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve(),
          typeof window.loadQuests === 'function' ? window.loadQuests() : Promise.resolve()
        ]);
        return result;
      };
      window.__acyPetLifeRpcRefreshPatched = true;
    }

    if (typeof window.performPetAction === 'function' && !window.__acyPerformPetActionRefreshPatched) {
      const originalPerformPetAction = window.performPetAction;
      window.performPetAction = async function patchedPerformPetAction(action, button) {
        const result = await originalPerformPetAction(action, button);
        await Promise.allSettled([
          typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve(),
          typeof window.loadQuests === 'function' ? window.loadQuests() : Promise.resolve()
        ]);
        return result;
      };
      window.__acyPerformPetActionRefreshPatched = true;
    }
  };

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    setTimeout(install, 0);
  }
})();
