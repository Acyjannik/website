/* ACY V19 PWA install-help cleanup: portal only, never intercept unrelated gestures. */
(() => {
  'use strict';

  const MODAL_ID = 'acy-pwa-install-modal';

  function portalInstallModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || !document.body) return null;
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    return modal;
  }

  function installHelpStyle() {
    if (document.getElementById('acy-v19-install-portal-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v19-install-portal-style';
    style.textContent = `
      #${MODAL_ID}[hidden]{display:none!important}
      #${MODAL_ID}{position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid!important;place-items:center!important;padding:18px!important;background:rgba(3,3,8,.82)!important;pointer-events:auto!important;visibility:visible!important;opacity:1!important}
      #${MODAL_ID} .pwa-install-overlay,#${MODAL_ID} .acy-v19-install-overlay{width:100%;min-height:100%;display:grid!important;place-items:center!important}
      #${MODAL_ID} .pwa-install-dialog,#${MODAL_ID} .acy-v19-install-card{position:relative;width:min(520px,100%);max-height:calc(100dvh - 36px);overflow:auto;padding:26px;border:1px solid rgba(180,108,255,.38);border-radius:24px;background:#111018;color:#f7f3ff;box-shadow:0 30px 100px rgba(0,0,0,.6);pointer-events:auto}
    `;
    document.head.appendChild(style);
  }

  function bindClose() {
    const modal = portalInstallModal();
    if (!modal || modal.dataset.v19PortalCloseBound === '1') return;
    modal.dataset.v19PortalCloseBound = '1';
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.pwa-install-close,.acy-v19-install-close,#acy-pwa-install-close')) {
        modal.hidden = true;
        document.body.classList.remove('pwa-modal-open');
      }
    });
  }

  function init() {
    portalInstallModal();
    installHelpStyle();
    bindClose();
    new MutationObserver(() => {
      const modal = document.getElementById(MODAL_ID);
      if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
    }).observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
