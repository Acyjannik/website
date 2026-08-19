(() => {
  'use strict';

  const VERSION = 'V18.8.1';
  const RETRY_DELAYS = [350, 900];
  let retryInstalled = false;
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function injectStyles() {
    if (document.getElementById('acy-v186-global-audit-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v186-global-audit-style';
    style.textContent = `
      html{scroll-behavior:smooth;overflow-x:hidden}body{overflow-x:hidden;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
      img{max-width:100%;height:auto}button,a.button,input,select,textarea,summary{touch-action:manipulation}
      .club-auth-page .eyebrow{font-size:12px;line-height:1.35;letter-spacing:.16em}.club-auth-page p,.club-auth-page small{line-height:1.5}
      .club-auth-page .member-count-chip,.club-auth-page .member-glow-title,.club-auth-page .v18-status-pill{max-width:100%;white-space:normal;overflow-wrap:anywhere}
      .club-auth-page .button{min-height:44px}.club-auth-page summary{min-height:52px}
      .acy-v186-version{position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12010;padding:7px 12px;border:1px solid rgba(180,108,255,.42);border-radius:999px;background:rgba(11,11,16,.94);backdrop-filter:blur(18px);color:#f7f3ff;font:700 12px/1 system-ui,sans-serif;letter-spacing:.05em;pointer-events:none;white-space:nowrap}
      .acy-v186-version i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#b46cff;box-shadow:0 0 12px rgba(180,108,255,.8)}
      .club-auth-page .member-avatar-img,.club-auth-page .member-avatar,.club-auth-page .member-directory-avatar,.club-auth-page .member-card-avatar,.club-auth-page .public-member-avatar,.club-auth-page .public-member-avatar img,.club-auth-page .pet-avatar,.club-auth-page .member-directory-card img,.club-auth-page .member-directory-item img{object-fit:cover;object-position:center;aspect-ratio:1/1}
      .club-auth-page .member-avatar-img,.club-auth-page .member-avatar,.club-auth-page .member-directory-avatar,.club-auth-page .member-card-avatar{overflow:hidden;border-radius:50%}
      @media(min-width:701px){.club-auth-page .member-dashboard,.club-auth-page .pet-world-main-v181{max-width:1240px;margin-left:auto;margin-right:auto}.club-auth-page .member-card,.club-auth-page .member-hub,.club-auth-page .v18-app-home,.club-auth-page .pet-section{min-width:0}.club-auth-page .v18-action-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:700px){
        .club-auth-page{font-size:15px;padding-left:max(0px,env(safe-area-inset-left));padding-right:max(0px,env(safe-area-inset-right))}.club-auth-page .club-auth-shell{width:100%;max-width:100%;overflow-x:clip}
        .club-auth-page .member-dashboard,.club-auth-page .pet-world-main-v181{width:100%;max-width:100%;padding-left:14px;padding-right:14px}
        .club-auth-page h1{font-size:clamp(29px,8.5vw,38px);line-height:1.05;letter-spacing:-.035em}.club-auth-page h2{font-size:clamp(23px,6.5vw,30px);line-height:1.1;letter-spacing:-.025em}.club-auth-page h3{font-size:clamp(19px,5vw,23px);line-height:1.15}
        .club-auth-page .member-card,.club-auth-page .member-hub,.club-auth-page .v18-app-home{border-radius:22px}.club-auth-page .member-card{padding-left:16px;padding-right:16px}.club-auth-page .member-card-head{gap:14px;align-items:flex-start}.club-auth-page .member-card-head p{font-size:14px}
        .club-auth-page .member-identity{gap:12px;align-items:flex-start}.club-auth-page .member-quick{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.club-auth-page .member-quick>div{min-width:0}.club-auth-page .member-quick span,.club-auth-page .member-quick strong{overflow-wrap:anywhere}
        .club-auth-page .member-card img,.club-auth-page .member-hub img{max-width:100%}.club-auth-page .v18-action-grid{grid-template-columns:1fr;gap:10px}.club-auth-page .v18-action-card{min-width:0}
        .club-auth-page .pet-mobile-hub-v182{overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.club-auth-page .pet-mobile-hub-v182::-webkit-scrollbar{display:none}.club-auth-page .pet-hub-card-v182{min-width:176px}
        .club-auth-page .pet-main{min-width:0}.club-auth-page .pet-stats{grid-template-columns:1fr;gap:10px}.club-auth-page .pet-actions{grid-template-columns:1fr;gap:10px}.club-auth-page .pet-action-btn{min-height:58px;text-align:left;padding:14px 16px}.club-auth-page .pet-action-btn small{display:block;margin-top:4px;line-height:1.35}
        .club-auth-page .pet-life-panel-v17{margin-top:14px}.club-auth-page .pet-life-head-v17{gap:12px;flex-direction:column;align-items:flex-start}.club-auth-page .pet-coins-v17{align-self:stretch;justify-content:center}
        .club-auth-page .pet-inventory-v17,.club-auth-page .pet-perks-list-v177,.club-auth-page .pet-minigames-v17,.club-auth-page .pet-archive-list-v176{min-width:0}.club-auth-page .pet-mini-card-v17{grid-template-columns:auto 1fr;gap:12px;align-items:center}.club-auth-page .pet-mini-card-v17 .button{grid-column:1/-1;width:100%}.club-auth-page .pet-archive-head-v176{gap:12px;align-items:flex-start}
        .club-auth-page .notification-panel{max-width:calc(100vw - 24px)}.club-auth-page .settings-grid-v10{grid-template-columns:1fr}.club-auth-page .notification-settings-grid,.club-auth-page .notification-category-grid{grid-template-columns:1fr}.club-auth-page .notification-settings-foot{gap:12px;align-items:stretch;flex-direction:column}.club-auth-page .notification-settings-foot .button{width:100%}
        .acy-staff-entry{font-size:12px!important;padding:9px 11px!important;white-space:nowrap}
      }
      @media(max-width:380px){.club-auth-page .member-dashboard,.club-auth-page .pet-world-main-v181{padding-left:10px;padding-right:10px}.club-auth-page .member-card{padding-left:12px;padding-right:12px}.club-auth-page .button{font-size:13px}.club-auth-page .pet-hub-card-v182{min-width:160px}}
      .acy-db-recovery{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12020;display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100vw - 28px));padding:10px 12px;border:1px solid rgba(248,113,113,.34);border-radius:14px;background:rgba(18,12,18,.96);backdrop-filter:blur(18px);box-shadow:0 16px 48px rgba(0,0,0,.42);color:#f7f3ff;font:600 13px/1.35 system-ui,sans-serif}.acy-db-recovery button{border:1px solid rgba(180,108,255,.3);background:rgba(180,108,255,.12);color:#fff;border-radius:10px;padding:8px 10px;font-weight:700}
      #acy-staff-entry{margin-left:auto}
    `;
    document.head.appendChild(style);
  }

  function installVersion() {
    if (!location.pathname.endsWith('club-profile.html') && !location.pathname.endsWith('pet.html')) return;
    let badge = document.getElementById('acy-dev-version-badge');
    if (!badge) { badge = document.createElement('div'); badge.id = 'acy-dev-version-badge'; document.body.appendChild(badge); }
    badge.className = 'acy-v186-version';
    badge.innerHTML = `<i></i><span>${VERSION} · DEV</span>`;
  }

  function getAccessToken(){
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';
        if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
        const raw=localStorage.getItem(key); if(!raw)continue;
        const parsed=JSON.parse(raw); if(parsed?.access_token)return parsed.access_token;
      }
    }catch{}
    return null;
  }

  async function installStaffEntry(){
    if(!location.pathname.endsWith('club-profile.html'))return;
    const host=document.querySelector('.member-header-actions');
    const old=[...document.querySelectorAll('.member-header-actions a,.member-header-actions button')].find(el=>/admin\s*\/\s*mod|mod\s*center|admin\s*center/i.test(el.textContent||''));
    old?.remove();
    if(document.getElementById('acy-staff-entry'))return;
    const token=getAccessToken();
    if(!token||!host)return;
    try{
      const response=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.ok||!data?.isStaff)return;
      const link=document.createElement('a');
      link.id='acy-staff-entry'; link.className='button button-secondary'; link.href='/staff.html';
      link.textContent=data.isAdmin?'🛡️ Admin / Mod':data.isModerator?'🛡️ Mod Center':'🎥 Streamer Center';
      host.appendChild(link);
    }catch(error){console.warn('[V18.8.1] Staff entry unavailable:',error);}
  }

  function showRecovery(message) {
    let bar = document.getElementById('acy-db-recovery');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'acy-db-recovery'; bar.className = 'acy-db-recovery';
      bar.innerHTML = '<span></span><button type="button">Erneut versuchen</button>';
      bar.querySelector('button').addEventListener('click', () => {
        if (typeof window.runAcyRefreshAll === 'function') window.runAcyRefreshAll().finally(() => bar.remove()); else location.reload();
      });
      document.body.appendChild(bar);
    }
    bar.querySelector('span').textContent = message;
  }

  function onlineState() {
    if (navigator.onLine === false) { showRecovery('Keine Verbindung. Deine Daten konnten gerade nicht aktualisiert werden.'); return; }
    document.getElementById('acy-db-recovery')?.remove();
    if (typeof window.runAcyRefreshAll === 'function') setTimeout(() => window.runAcyRefreshAll().catch(() => {}), 500);
  }

  async function callWithRetry(entry) {
    let lastError = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try { if (navigator.onLine === false) throw new Error('Offline'); return await entry.__acyOriginal(); }
      catch (error) { lastError = error; if (attempt >= RETRY_DELAYS.length) break; await sleep(RETRY_DELAYS[attempt]); }
    }
    throw lastError || new Error('Request failed');
  }

  function installRefreshRetries() {
    if (retryInstalled || typeof ACY_REFRESH_REGISTRY === 'undefined') return false;
    ACY_REFRESH_REGISTRY.forEach(entry => { if (!entry || entry.__acyRetryWrapped || typeof entry.fn !== 'function') return; entry.__acyOriginal = entry.fn; entry.fn = () => callWithRetry(entry); entry.__acyRetryWrapped = true; });
    retryInstalled = true;
    return true;
  }

  function watchForRegistry() {
    let tries = 0; const timer = setInterval(() => { tries += 1; if (installRefreshRetries() || tries > 12) clearInterval(timer); }, 400);
  }

  function improveImages() {
    document.querySelectorAll('img:not([loading])').forEach(img => { if (!img.closest('.member-avatar-wrap,.public-member-avatar,.pet-avatar')) img.loading = 'lazy'; img.decoding = 'async'; });
  }

  function init() {
    injectStyles(); installVersion(); improveImages(); watchForRegistry(); installStaffEntry();
    window.addEventListener('offline', () => showRecovery('Keine Verbindung. Die Anzeige bleibt erhalten, bis du wieder online bist.'));
    window.addEventListener('online', onlineState);
    if (navigator.onLine === false) showRecovery('Keine Verbindung. Bitte prüfe deine Internetverbindung.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
