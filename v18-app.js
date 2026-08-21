(() => {
  const $ = (id) => document.getElementById(id);
  if (!document.getElementById('avatar-input')) {
    const input = document.createElement('input');
    input.id = 'avatar-input'; input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true;
    (document.body || document.documentElement).appendChild(input);
  }
  const addScript=(id,src)=>{if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.defer=true;document.head.appendChild(s);};
  const getToken=()=>{try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;const p=JSON.parse(localStorage.getItem(k)||'{}');const t=p?.access_token||p?.currentSession?.access_token||p?.session?.access_token||p?.data?.session?.access_token;if(t)return t;}}catch{}return null;};
  const openNotifications=()=>{const p=$('notification-panel');if(!p)return;p.hidden=false;p.classList.add('v181-open');document.body.classList.add('acy-notifications-open-v182');window.loadNotifications?.().catch?.(()=>{});};
  const closeNotifications=()=>{const p=$('notification-panel');if(p){p.hidden=true;p.classList.remove('v181-open');}document.body.classList.remove('acy-notifications-open-v182');};
  async function notificationAction(action){const token=getToken();if(!token)throw new Error('Deine Sitzung ist abgelaufen.');const r=await fetch(`/api/club-notifications?action=${encodeURIComponent(action)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||'Benachrichtigungen konnten nicht aktualisiert werden.');return d;}
  async function handleNotificationAction(action,btn){if(btn?.disabled)return;btn&&(btn.disabled=true);try{await notificationAction(action);if(action==='clear_all'||action==='mark_all_read')closeNotifications();void window.loadNotifications?.();}catch(e){window.setAcyRefreshStatus?.(e?.message||'Benachrichtigungen konnten nicht aktualisiert werden.','error');}finally{btn&&(btn.disabled=false);}}
  function notificationMobileFix(){if($('acy-notify-mobile-189'))return;const s=document.createElement('style');s.id='acy-notify-mobile-189';s.textContent=`#notification-panel[hidden]{display:none!important}@media(max-width:700px){#notification-panel{position:fixed!important;inset:max(12px,env(safe-area-inset-top)) 12px auto 12px!important;width:auto!important;max-height:calc(100dvh - 92px)!important;overflow:auto!important;z-index:12000!important}.notification-panel-head{flex-wrap:wrap!important}.notification-panel-head>strong{flex:1 1 100%!important}.notification-panel-actions{display:flex!important;width:100%!important;gap:8px!important}.notification-panel-actions button{min-height:42px!important;flex:1!important}.notification-panel-actions #notification-close{flex:0 0 44px!important}.notification-filter-row{position:sticky!important;top:96px!important;z-index:3!important;background:rgba(11,11,16,.96)!important}}`;document.head.appendChild(s);}
  function initNotifications(){notificationMobileFix();document.addEventListener('click',e=>{const bell=e.target.closest('#notification-bell');if(bell){e.preventDefault();e.stopImmediatePropagation();const p=$('notification-panel');p?.hidden?openNotifications():closeNotifications();return;}const close=e.target.closest('#notification-close');if(close){e.preventDefault();e.stopImmediatePropagation();closeNotifications();return;}const read=e.target.closest('#notification-read-all');if(read){e.preventDefault();e.stopImmediatePropagation();handleNotificationAction('mark_all_read',read);return;}const clear=e.target.closest('#notification-clear-all');if(clear){e.preventDefault();e.stopImmediatePropagation();handleNotificationAction('clear_all',clear);return;}const card=e.target.closest('#v18-open-notifications');if(card){e.preventDefault();openNotifications();}},true);}
  function initMore(){const sheet=$('mobile-more-sheet-v181'),toggle=$('mobile-dock-more-v18');if(!sheet||!toggle)return;const close=()=>{sheet.hidden=true;document.body.classList.remove('mobile-more-open-v181');toggle.setAttribute('aria-expanded','false');};const open=()=>{sheet.hidden=false;document.body.classList.add('mobile-more-open-v181');toggle.setAttribute('aria-expanded','true');};toggle.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();sheet.hidden?open():close();},true);sheet.addEventListener('click',e=>{if(e.target.closest('[data-close-more]'))close();if(e.target.closest('[data-open-notifications-v181]')){close();openNotifications();}});document.addEventListener('keydown',e=>e.key==='Escape'&&close());}
  function initDock(){document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item=>item.addEventListener('click',()=>{if(item.dataset.dockKey==='more')return;document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(x=>x.classList.remove('is-active'));item.classList.add('is-active');}));}
  function syncLive(){const t=$('v18-live-summary');if(!t)return;const live=$('member-live-text')?.textContent?.trim(),game=$('member-twitch-game')?.textContent?.trim(),v=$('member-twitch-viewers')?.textContent?.trim();if(/LIVE/i.test(live||'')||$('member-live-pill')?.classList.contains('is-live'))t.textContent=`LIVE${game&&game!=='–'?` · ${game}`:''}${v&&v!=='–'?` · ${v} Zuschauer`:''}`;else if(live)t.textContent='Offline · beim nächsten Stream wieder dabei';}
  function init(){
    addScript('acy-v192-pwa-script','/pwa.js?v=1920');
    addScript('acy-v182-polish-script','/v18.2-app-polish.js?v=1821');
    addScript('acy-v186-navigation-script','/v18.6-navigation-isolated.js?v=1863');
    addScript('acy-v186-global-audit-script','/v18.6-global-audit.js?v=1865');
    addScript('acy-v186-mobile-pass-script','/v18.6-mobile-pass.js?v=1866');
    addScript('acy-v186-stream-center-script','/v18.6-stream-center.js?v=1867');
    addScript('acy-v187-streamer-entry-script','/v18.7-streamer-entry.js?v=1871');
    addScript('acy-v19-safe-mobile-script','/v19-mobile-ux-safe.js?v=19009');
    addScript('acy-v19-rc6-hotfix-script','/v19-rc6-mobile-hotfix.js?v=19009');
    addScript('acy-v19-pet-rc8-hotfix-script','/v19-pet-rc7-hotfix.js?v=19009');
    addScript('acy-v19-final-runtime-fix','/v19-final-runtime-fix.js?v=19002');
    addScript('acy-v19-install-portal-fix','/v19-install-portal-fix.js?v=19001');
    addScript('acy-v19-member-card-css','/v19-mobile-member-card.css?v=19002');
    initNotifications();initMore();initDock();
    const mo=new MutationObserver(syncLive);['member-live-text','member-twitch-game','member-twitch-viewers','member-live-pill'].forEach(id=>{const el=$(id);el&&mo.observe(el,{childList:true,subtree:true,attributes:true,characterData:true});});
    syncLive();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
// Rollback checkpoint: keep the known-good RC10 runtime while V19 is repaired.
