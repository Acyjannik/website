(() => {
  const $ = (id) => document.getElementById(id);

  function loadV182Polish() {
    if (document.getElementById('acy-v182-polish-script')) return;
    const script = document.createElement('script');
    script.id = 'acy-v182-polish-script';
    script.src = '/v18.2-app-polish.js?v=1821';
    script.defer = true;
    document.head.appendChild(script);
    const ui = document.createElement('script');
    ui.id = 'acy-v185-ui-script';
    ui.src = '/v18.5-app-ui.js?v=1854';
    ui.defer = true;
    document.head.appendChild(ui);
  }

  function openNotifications() {
    const panel = $('notification-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('v181-open');
    document.body.classList.add('acy-notifications-open-v182');
    if (typeof window.loadNotifications === 'function') window.loadNotifications().catch(() => {});
  }
  function closeNotifications() {
    const panel = $('notification-panel');
    if (panel) { panel.hidden = true; panel.classList.remove('v181-open'); }
    document.body.classList.remove('acy-notifications-open-v182');
  }
  function getSupabaseAccessToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const raw = localStorage.getItem(key); if (!raw) continue;
        const parsed = JSON.parse(raw); if (parsed?.access_token) return parsed.access_token;
      }
    } catch (error) { console.warn('[V18.2] Could not read auth session:', error); }
    return null;
  }
  async function notificationAction(action) {
    const token = getSupabaseAccessToken();
    if (!token) throw new Error('Deine Sitzung ist abgelaufen.');
    const response = await fetch(`/api/club-notifications?action=${encodeURIComponent(action)}`, { method:'POST', headers:{Authorization:`Bearer ${token}`}, cache:'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Benachrichtigungen konnten nicht aktualisiert werden.');
    return data;
  }
  async function handleNotificationAction(action, button) {
    if (button?.disabled) return; if (button) button.disabled = true;
    try { await notificationAction(action); if (typeof window.loadNotifications === 'function') await window.loadNotifications(); }
    catch (error) { console.warn(`[V18.2] Notification action ${action} failed:`, error); if (typeof window.setAcyRefreshStatus === 'function') window.setAcyRefreshStatus(error?.message || 'Benachrichtigungen konnten nicht aktualisiert werden.', 'error'); }
    finally { if (button) button.disabled = false; }
  }
  function injectNotificationMobileFixes() {
    if ($('acy-v182-notification-mobile-fixes')) return;
    const style = document.createElement('style'); style.id='acy-v182-notification-mobile-fixes';
    style.textContent=`#notification-panel[hidden]{display:none!important}@media(max-width:700px){#notification-panel{position:fixed!important;z-index:10050!important;top:max(12px,env(safe-area-inset-top))!important;left:12px!important;right:12px!important;width:auto!important;max-height:calc(100dvh - 92px)!important;overflow:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-bottom:max(18px,env(safe-area-inset-bottom))!important}#notification-panel .notification-panel-head{position:sticky!important;top:0!important;z-index:4!important;gap:10px!important;flex-wrap:wrap!important;background:rgba(11,11,16,.96)!important;backdrop-filter:blur(18px)!important}#notification-panel .notification-panel-head>strong{flex:1 1 100%!important;font-size:22px!important}#notification-panel .notification-panel-actions{display:flex!important;width:100%!important;gap:8px!important}#notification-panel .notification-panel-actions button{min-height:42px!important;padding:9px 13px!important;flex:1 1 auto!important;touch-action:manipulation!important}#notification-panel .notification-panel-actions #notification-close{flex:0 0 44px!important;font-size:22px!important}#notification-panel .notification-filter-row{position:sticky!important;top:96px!important;z-index:3!important;background:rgba(11,11,16,.94)!important}#notification-panel #notifications-list{position:relative!important;z-index:1!important}#notification-panel #notifications-list button{touch-action:manipulation!important}}`;
    document.head.appendChild(style);
  }
  function initNotifications() {
    injectNotificationMobileFixes();
    document.addEventListener('click',(event)=>{
      const bell=event.target.closest('#notification-bell'); if(bell){event.preventDefault();event.stopImmediatePropagation();const panel=$('notification-panel');if(panel?.hidden)openNotifications();else closeNotifications();return;}
      const close=event.target.closest('#notification-close'); if(close){event.preventDefault();event.stopImmediatePropagation();closeNotifications();return;}
      const readAll=event.target.closest('#notification-read-all'); if(readAll){event.preventDefault();event.stopImmediatePropagation();handleNotificationAction('mark_all_read',readAll);return;}
      const clearAll=event.target.closest('#notification-clear-all'); if(clearAll){event.preventDefault();event.stopImmediatePropagation();handleNotificationAction('clear_all',clearAll);return;}
      const openCard=event.target.closest('#v18-open-notifications'); if(openCard){event.preventDefault();openNotifications();return;}
      const dockNotification=event.target.closest('#mobile-dock-notifications-v18'); if(dockNotification){event.preventDefault();openNotifications();}
    },true);
    $('mobile-more-notification-count-v181')?.setAttribute('aria-live','polite');
  }
  function initMoreSheet() {
    const sheet=$('mobile-more-sheet-v181'),toggle=$('mobile-dock-more-v18'); if(!sheet||!toggle)return;
    const close=()=>{sheet.hidden=true;document.body.classList.remove('mobile-more-open-v181');toggle.setAttribute('aria-expanded','false')};
    const open=()=>{sheet.hidden=false;document.body.classList.add('mobile-more-open-v181');toggle.setAttribute('aria-expanded','true')};
    toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();if(sheet.hidden)open();else close()},false);
    sheet.addEventListener('click',(event)=>{const c=event.target.closest('[data-close-more]');if(c)close();const n=event.target.closest('[data-open-notifications-v181]');if(n){close();openNotifications()}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }
  function initDock(){document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item=>item.addEventListener('click',()=>{if(item.dataset.dockKey==='more')return;document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(el=>el.classList.remove('is-active'));item.classList.add('is-active')}))}
  function syncLiveSummary(){const target=$('v18-live-summary');if(!target)return;const liveText=$('member-live-text')?.textContent?.trim(),game=$('member-twitch-game')?.textContent?.trim(),viewers=$('member-twitch-viewers')?.textContent?.trim();if(liveText==='LIVE'||liveText==='LIVE NOW'||$('member-live-pill')?.classList.contains('is-live'))target.textContent=`LIVE${game&&game!=='–'?` · ${game}`:''}${viewers&&viewers!=='–'?` · ${viewers} Zuschauer`:''}`;else if(liveText&&liveText!=='CHECKING')target.textContent='Offline · beim nächsten Stream wieder dabei'}
  function init(){loadV182Polish();initNotifications();initMoreSheet();initDock();const observer=new MutationObserver(syncLiveSummary);['member-live-text','member-twitch-game','member-twitch-viewers','member-live-pill'].forEach(id=>{const el=$(id);if(el)observer.observe(el,{childList:true,subtree:true,attributes:true,characterData:true})});syncLiveSummary()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();