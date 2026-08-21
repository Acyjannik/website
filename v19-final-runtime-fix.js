/* ACY V19 final runtime fixes: notifications, PWA help and reliable quest claiming. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let questClaimBusy = false;
  let originalLoadQuests = null;

  function closeNotifications() {
    const panel = $('notification-panel');
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('v181-open', 'open', 'is-open', 'active', 'visible');
    document.body.classList.remove('acy-notifications-open-v182');
    panel.setAttribute('aria-hidden', 'true');
  }

  function patchNotifications() {
    document.addEventListener('click', event => {
      const clear = event.target.closest('#notification-clear-all');
      const read = event.target.closest('#notification-read-all');
      if (!clear && !read) return;
      setTimeout(closeNotifications, 250);
    }, true);
  }

  function ensureInstallHelp() {
    let modal = $('acy-pwa-install-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'acy-pwa-install-modal';
      modal.hidden = true;
      modal.innerHTML = `<div class="acy-v19-install-overlay"><div class="acy-v19-install-card" role="dialog" aria-modal="true" aria-labelledby="acy-v19-install-title"><button type="button" class="acy-v19-install-close" aria-label="Schließen">×</button><div class="eyebrow">ACY MOBILE</div><h2 id="acy-v19-install-title">📱 ACY als App installieren</h2><p><strong>Auf dem iPhone:</strong></p><ol><li>Safari-Teilen öffnen.</li><li><strong>Zum Home-Bildschirm</strong> auswählen.</li><li><strong>Hinzufügen</strong> bestätigen.</li></ol><p>Danach ACY über das neue App-Symbol öffnen und Push aktivieren.</p></div></div>`;
      document.body.appendChild(modal);
    }
    if (!document.getElementById('acy-v19-install-style')) {
      const style = document.createElement('style');
      style.id = 'acy-v19-install-style';
      style.textContent = `#acy-pwa-install-modal[hidden]{display:none!important}#acy-pwa-install-modal{position:fixed;inset:0;z-index:30000;background:rgba(4,3,8,.82);backdrop-filter:blur(16px);display:grid;place-items:center;padding:18px}.acy-v19-install-overlay{width:100%;display:grid;place-items:center}.acy-v19-install-card{position:relative;width:min(520px,100%);padding:26px;border:1px solid rgba(180,108,255,.38);border-radius:24px;background:#111018;color:#f7f3ff;box-shadow:0 30px 100px rgba(0,0,0,.6)}.acy-v19-install-card h2{margin:6px 0 12px}.acy-v19-install-card p,.acy-v19-install-card li{color:#c8c3d2;line-height:1.5}.acy-v19-install-card li{margin:9px 0}.acy-v19-install-close{position:absolute;right:14px;top:14px;width:38px;height:38px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#1b1822;color:#fff;font-size:24px;cursor:pointer}`;
      document.head.appendChild(style);
    }
    if (!modal.dataset.v19Bound) {
      modal.dataset.v19Bound = '1';
      modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('.acy-v19-install-close')) {
          modal.hidden = true;
          document.body.classList.remove('pwa-modal-open');
        }
      });
    }
    return modal;
  }

  function openInstallHelp() {
    const modal = ensureInstallHelp();
    modal.hidden = false;
    document.body.classList.add('pwa-modal-open');
  }

  function patchInstallHelp() {
    window.openPwaInstallHelp = openInstallHelp;
    document.addEventListener('click', event => {
      const button = event.target.closest('#acy-install-pwa');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openInstallHelp();
    }, true);
  }

  function patchQuestLoading() {
    if (typeof window.loadQuests !== 'function' || window.__acyQuestLoadWrapped) return;
    originalLoadQuests = window.loadQuests;
    window.loadQuests = async function wrappedQuestLoad(...args) {
      if (questClaimBusy) return null;
      return originalLoadQuests.apply(this, args);
    };
    window.__acyQuestLoadWrapped = true;
  }

  async function claimQuest(button) {
    if (!button || questClaimBusy || button.dataset.claiming === '1') return;
    const key = String(button.dataset.quest || '').trim();
    if (!key || typeof supabaseClient === 'undefined' || !supabaseClient?.rpc) return;
    const period = typeof questPeriodKey === 'function' ? questPeriodKey(activeQuestTab || 'daily') : null;
    if (!period) return;

    questClaimBusy = true;
    button.dataset.claiming = '1';
    button.disabled = true;
    const reward = Number(button.dataset.reward || 0);
    button.textContent = 'Wird abgeholt…';

    try {
      const { data, error } = await supabaseClient.rpc('claim_quest', {
        p_quest_key: key,
        p_period_start: period
      });
      if (error) throw error;

      const total = Number(data?.total_xp);
      if (Number.isFinite(total) && typeof renderProgress === 'function') renderProgress(total);
      if (typeof playUISound === 'function') playUISound('reward');
      if (typeof triggerClubEffect === 'function') triggerClubEffect('reward', `Quest abgeschlossen! +${Number(data?.reward_xp ?? reward)} XP 🎯`);
      if (typeof checkAchievements === 'function') await checkAchievements();
      if (typeof loadProgressionCatalog === 'function') await loadProgressionCatalog();
      questClaimBusy = false;
      button.dataset.claiming = '0';
      if (originalLoadQuests) await originalLoadQuests().catch(() => {});
    } catch (error) {
      console.warn('V19 quest claim failed:', error);
      const message = $('quest-message');
      if (message) { message.textContent = error?.message || 'Quest konnte nicht abgeholt werden.'; message.className = 'club-auth-status error'; }
      button.disabled = false;
      button.dataset.claiming = '0';
      button.textContent = `+${reward} XP abholen`;
      questClaimBusy = false;
      if (originalLoadQuests) await originalLoadQuests().catch(() => {});
    }
  }

  function patchQuestClaim() {
    patchQuestLoading();
    document.addEventListener('click', event => {
      const button = event.target.closest('.quest-claim');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void claimQuest(button);
    }, true);
  }

  function init() {
    patchNotifications();
    ensureInstallHelp();
    patchInstallHelp();
    patchQuestClaim();
    setTimeout(patchQuestLoading, 300);
    setTimeout(patchQuestLoading, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
