(() => {
  'use strict';
  const VERSION = 'V19.0.0 · RC6';
  const $ = (id) => document.getElementById(id);
  function token() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const p = JSON.parse(localStorage.getItem(key) || '{}');
        const candidates = [p?.access_token, p?.currentSession?.access_token, p?.session?.access_token, p?.data?.session?.access_token];
        const t = candidates.find(Boolean); if (t) return t;
      }
    } catch {}
    return null;
  }
  async function getToken() {
    const stored = token(); if (stored) return stored;
    try {
      const cfg = await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(r=>r.json());
      if(cfg?.supabaseUrl&&cfg?.supabaseAnonKey&&window.supabase?.createClient){const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);const {data}=await sb.auth.getSession();return data?.session?.access_token||null;}
    } catch {}
    return null;
  }
  async function roleCheck(){
    const access=await getToken();if(!access)throw new Error('Deine Sitzung ist abgelaufen.');
    const res=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${access}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(7000)});
    const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`Rollenprüfung fehlgeschlagen (${res.status}).`);return data;
  }
  function set(id,value){const el=$(id);if(el)el.textContent=value;}
  async function loadTwitchStatus(){
    const status=$('streamer-status-message');
    try{
      const r=await fetch('/api/twitch-status',{cache:'no-store',signal:AbortSignal.timeout(7000)});const d=await r.json().catch(()=>({}));
      if(d?.live){set('streamer-status','LIVE');set('streamer-live-quick','LIVE');set('streamer-game',d.game||'Unbekanntes Game');set('streamer-game-quick',d.game||'Unbekanntes Game');set('streamer-viewers',`${Number(d.viewerCount||0)} Zuschauer`);set('streamer-live-title',d.title||'ACYJANNIK ist live');set('streamer-live-chip','LIVE');}
      else{set('streamer-status','OFFLINE');set('streamer-live-quick','Offline');set('streamer-game','Kein aktuelles Game');set('streamer-game-quick','Kein aktuelles Game');set('streamer-viewers','Beim nächsten Stream wieder dabei');set('streamer-live-title','Aktuell offline');set('streamer-live-chip','OFFLINE');}
      if(status&&/Checking|Live-Status wird geladen/i.test(status.textContent||''))status.textContent='';
    }catch{set('streamer-status','OFFLINE');set('streamer-live-quick','Offline');set('streamer-game','Nicht verfügbar');set('streamer-game-quick','Nicht verfügbar');set('streamer-viewers','Live-Daten momentan nicht verfügbar');set('streamer-live-title','Twitch-Status konnte nicht geladen werden');set('streamer-live-chip','UNAVAILABLE');if(status)status.textContent='Twitch-Livedaten sind momentan nicht verfügbar.';}
  }
  function injectStyles(){
    if($('streamer-v19-rc6-style'))return;const style=document.createElement('style');style.id='streamer-v19-rc6-style';style.textContent=`
      .streamer-dashboard{max-width:1100px!important}.streamer-hero-card{border-color:rgba(180,108,255,.34)!important;background:linear-gradient(145deg,rgba(30,19,45,.98),rgba(12,12,18,.99))!important}
      .streamer-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.streamer-metric-grid>div{min-width:0;padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}.streamer-metric-grid span{color:#a1a1aa}.streamer-metric-grid strong{display:block;margin-top:5px;font-size:18px;line-height:1.2;overflow-wrap:anywhere}.streamer-metric-grid .button{margin-top:7px;width:100%}
      .streamer-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.streamer-tool-grid .button{min-height:64px;text-align:center;white-space:normal;line-height:1.2}.streamer-tool-grid small{display:block;margin-top:4px;opacity:.65;font-size:11px}.streamer-permission-list{display:grid;gap:8px;margin-top:14px;color:#a1a1aa}.streamer-permission-list div{padding:10px 12px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.02);min-width:0;overflow-wrap:anywhere}
      .streamer-version{position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12000;padding:7px 12px;border:1px solid rgba(180,108,255,.35);border-radius:999px;background:rgba(11,11,16,.92);backdrop-filter:blur(16px);font:700 12px/1 system-ui;color:#f7f3ff;letter-spacing:.05em;white-space:nowrap}
      @media(max-width:700px){.streamer-dashboard{padding:0 14px 70px!important}.member-header-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.member-header-actions>*{width:100%!important;min-width:0!important;white-space:normal!important}.streamer-hero-card .member-identity{display:grid!important;grid-template-columns:64px minmax(0,1fr)!important;gap:12px!important}.streamer-hero-card .member-quick{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:14px!important}.streamer-metric-grid,.streamer-tool-grid{grid-template-columns:1fr!important}.streamer-metric-grid>div{padding:12px}.streamer-metric-grid strong{font-size:16px}.streamer-tool-grid .button{width:100%!important;min-height:58px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important}.streamer-tool-grid small{flex:1 0 100%}}
    `;document.head.appendChild(style);
  }
  function init(data){
    if(!data?.isStreamer&&!data?.isAdmin){document.body.innerHTML='<main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#0b0b10;color:#f7f3ff;font-family:system-ui"><div style="max-width:520px;text-align:center"><div style="font-size:48px">🔒</div><h1>Streamer Center nicht freigeschaltet</h1><p style="color:#a1a1aa">Dein Account hat keine Streamer-Berechtigung.</p><p><a href="/club-profile.html" style="color:#c084fc">Zurück zum ACY Club</a></p></div></main>';return;}
    injectStyles();document.querySelectorAll('#acy-build-marker,.streamer-version,#acy-dev-version-badge').forEach(el=>el.remove());const badge=document.createElement('div');badge.className='streamer-version';badge.textContent=`${VERSION} · RC`;document.body.appendChild(badge);
    const profile=data.profile||{};set('streamer-name',profile.display_name||profile.username||'Streamer');set('streamer-role',data.isAdmin?'Admin + Streamer':'Streamer');set('streamer-role-quick',data.isAdmin?'Admin + Streamer':'Streamer');
    if(profile.avatar_url){const img=$('streamer-avatar'),fallback=$('streamer-avatar-fallback');if(img){img.src=profile.avatar_url;img.hidden=false;}if(fallback)fallback.hidden=true;}
    loadTwitchStatus();setInterval(loadTwitchStatus,60000);
  }
  async function start(){try{init(await roleCheck());}catch(error){const msg=$('streamer-status-message');if(msg){msg.textContent=error?.message||'Rolle konnte nicht geprüft werden.';msg.className='club-auth-status error';}set('streamer-live-chip','ERROR');set('streamer-live-title','Streamer-Bereich konnte nicht initialisiert werden');}$('streamer-logout')?.addEventListener('click',async()=>{try{if(window.supabaseClient?.auth)await window.supabaseClient.auth.signOut();}catch{}location.href='/club.html';});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
