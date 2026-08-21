/* ACY V19 RC13 — final UX safeguards: reliable install help + notification close. */
(() => {
  'use strict';
  function ensureInstallHelp(){
    let overlay=document.getElementById('acy-pwa-install-modal');
    if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='acy-pwa-install-modal';overlay.hidden=true;
    overlay.innerHTML=`<div class="acy-pwa-help-card" role="dialog" aria-modal="true" aria-labelledby="acy-pwa-help-title"><button type="button" class="button button-secondary acy-pwa-help-close" aria-label="Installationshilfe schließen">×</button><div class="eyebrow">ACY MOBILE</div><h2 id="acy-pwa-help-title">📱 ACY als App installieren</h2><p>Auf dem iPhone geht das direkt über Safari:</p><ol><li>Safari-Menü <strong>Teilen</strong> öffnen.</li><li><strong>Zum Home-Bildschirm</strong> auswählen.</li><li><strong>Hinzufügen</strong> bestätigen.</li><li>Danach ACY über das neue App-Symbol öffnen.</li><li>In der ACY-App anschließend <strong>Push aktivieren</strong>.</li></ol></div>`;
    document.body.appendChild(overlay);
    if(!document.getElementById('acy-rc13-install-style')){
      const style=document.createElement('style');style.id='acy-rc13-install-style';style.textContent=`#acy-pwa-install-modal{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:18px;background:rgba(3,3,7,.78);backdrop-filter:blur(14px)}#acy-pwa-install-modal[hidden]{display:none!important}.acy-pwa-help-card{position:relative;width:min(520px,100%);padding:24px;border:1px solid rgba(180,108,255,.3);border-radius:24px;background:linear-gradient(145deg,#17131f,#0d0d13);box-shadow:0 30px 100px rgba(0,0,0,.55);color:#f7f3ff}.acy-pwa-help-card h2{margin:6px 0 10px}.acy-pwa-help-card p{color:#c4c4cc}.acy-pwa-help-card li{margin:10px 0;line-height:1.45}.acy-pwa-help-close{position:absolute;right:14px;top:14px;width:38px!important;height:38px!important;padding:0!important;border-radius:50%!important}body.pwa-modal-open{overflow:hidden}`;document.head.appendChild(style);
    }
    const close=()=>{overlay.hidden=true;document.body.classList.remove('pwa-modal-open')};
    overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.acy-pwa-help-close'))close()});
    return overlay;
  }
  function patchInstallHelp(){if(window.__acyRc13InstallPatched)return;window.__acyRc13InstallPatched=true;window.openPwaInstallHelp=function(){const modal=ensureInstallHelp();modal.hidden=false;document.body.classList.add('pwa-modal-open')}}
  function closeNotificationPanel(){['#notification-panel','.notification-panel','#notifications-panel','.notifications-panel'].forEach(s=>document.querySelectorAll(s).forEach(el=>{el.hidden=true;el.removeAttribute('open');el.classList.remove('open','is-open','active','visible');el.setAttribute('aria-hidden','true')}))}
  function patchNotifications(){if(window.__acyRc13NotificationsPatched)return;window.__acyRc13NotificationsPatched=true;
    document.addEventListener('click',event=>{const b=event.target.closest('#notification-close,[aria-label="Benachrichtigungen schließen"]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();closeNotificationPanel()},true);
    document.addEventListener('click',event=>{const b=event.target.closest('#notification-read-all,#notification-clear-all');if(!b)return;setTimeout(closeNotificationPanel,300)},true);
    window.addEventListener('keydown',event=>{if(event.key==='Escape')closeNotificationPanel()});
  }
  function patchPetRelease(){if(window.__acyRc13PetReleasePatched)return;window.__acyRc13PetReleasePatched=true;document.addEventListener('click',async event=>{const button=event.target.closest('#pet-release-toggle');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(button.dataset.acyReleaseBusy==='1')return;button.dataset.acyReleaseBusy='1';button.disabled=true;try{const client=window.__acySupabaseClient;if(!client?.rpc)throw new Error('Pet-System noch nicht bereit.');const {error}=await client.rpc('release_club_pet');if(error)throw error;document.getElementById('pet-active-state')?.setAttribute('hidden','');document.getElementById('pet-empty-state')?.removeAttribute('hidden');await window.loadPet?.();await window.loadPetLife?.();const status=document.getElementById('pet-life-status')||document.getElementById('pet-status');if(status){status.textContent='📦 Dein Tier wurde abgegeben und ins Archiv verschoben.';status.className='club-auth-status success'}}catch(error){const status=document.getElementById('pet-life-status')||document.getElementById('pet-status');if(status){status.textContent=`Abgeben: ${error?.message||'Das Tier konnte nicht abgegeben werden.'}`;status.className='club-auth-status error'}}finally{button.dataset.acyReleaseBusy='0';button.disabled=false}},true)}
  function init(){ensureInstallHelp();patchInstallHelp();patchNotifications();patchPetRelease()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
