(() => {
  'use strict';
  const VERSION = 'V18.9.0';
  const $ = (id) => document.getElementById(id);

  function loadUniversalMobile(){
    if(document.getElementById('acy-v189-universal-mobile-script'))return;
    const script=document.createElement('script');
    script.id='acy-v189-universal-mobile-script';
    script.src='/v18.9-universal-mobile.js?v=1890';
    script.defer=true;
    document.head.appendChild(script);
  }
  function token(){try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;const raw=localStorage.getItem(key);if(!raw)continue;const parsed=JSON.parse(raw);if(parsed?.access_token)return parsed.access_token;}}catch{}return null;}
  async function roleCheck(){const access=token();if(!access)throw new Error('Deine Sitzung ist abgelaufen.');const res=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${access}`},cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||'Rollenprüfung fehlgeschlagen.');return data;}
  function set(id,value){const el=$(id);if(el)el.textContent=value;}
  async function loadTwitchMirror(){if(typeof window.loadTwitch==='function'){try{await window.loadTwitch();}catch{}}const liveText=document.getElementById('member-live-text')?.textContent?.trim()||'';const game=document.getElementById('member-twitch-game')?.textContent?.trim()||'Kein aktuelles Game';const viewers=document.getElementById('member-twitch-viewers')?.textContent?.trim()||'0';const live=/LIVE/i.test(liveText)||document.getElementById('member-live-pill')?.classList.contains('is-live');set('streamer-status',live?'LIVE':'OFFLINE');set('streamer-live-quick',live?'LIVE':'Offline');set('streamer-game',game);set('streamer-game-quick',game);set('streamer-viewers',live?`${viewers} Zuschauer`:'Beim nächsten Stream wieder dabei');set('streamer-live-title',liveText||(live?'ACYJANNIK ist live':'Aktuell offline'));set('streamer-live-chip',live?'LIVE':'OFFLINE');}
  function injectStyles(){if($('streamer-v189-style'))return;const style=document.createElement('style');style.id='streamer-v189-style';style.textContent=`
    .streamer-dashboard{max-width:1100px!important}
    .streamer-hero-card{border-color:rgba(180,108,255,.34)!important;background:linear-gradient(145deg,rgba(30,19,45,.98),rgba(12,12,18,.99))!important}
    .streamer-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}
    .streamer-metric-grid>div{min-width:0;padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}
    .streamer-metric-grid span{color:#a1a1aa}.streamer-metric-grid strong{display:block;margin-top:5px;font-size:18px;overflow-wrap:anywhere}.streamer-metric-grid .button{margin-top:7px;width:100%}
    .streamer-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.streamer-tool-grid .button{min-height:64px;text-align:left}.streamer-tool-grid small{display:block;margin-top:3px;opacity:.65;font-size:11px}
    .streamer-permission-list{display:grid;gap:8px;margin-top:14px;color:#a1a1aa}.streamer-permission-list div{padding:10px 12px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.02);min-width:0;overflow-wrap:anywhere}
    .streamer-version{position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12000;padding:7px 12px;border:1px solid rgba(180,108,255,.35);border-radius:999px;background:rgba(11,11,16,.92);backdrop-filter:blur(16px);font:700 12px/1 system-ui;color:#f7f3ff;letter-spacing:.05em;white-space:nowrap}
    @media(max-width:700px){.streamer-dashboard{padding-left:14px!important;padding-right:14px!important}.streamer-metric-grid{grid-template-columns:1fr}.streamer-tool-grid{grid-template-columns:1fr}.streamer-hero-card .member-quick{grid-template-columns:repeat(3,minmax(0,1fr))}.streamer-metric-grid>div{padding:12px}.streamer-metric-grid strong{font-size:16px}.streamer-tool-grid .button{width:100%;min-height:56px;white-space:normal;overflow-wrap:anywhere}.member-header-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.member-header-actions .button{width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important}}
    @media(max-width:380px){.streamer-hero-card .member-quick{grid-template-columns:1fr}.member-header-actions{grid-template-columns:1fr!important}.streamer-metric-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(style);}
  function init(data){if(!data?.isStreamer){document.body.innerHTML='<main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#0b0b10;color:#f7f3ff;font-family:system-ui"><div style="max-width:520px;text-align:center"><div style="font-size:48px">🔒</div><h1>Streamer Center nicht freigeschaltet</h1><p style="color:#a1a1aa">Dein Account hat keine Streamer-Berechtigung.</p><p><a href="/club-profile.html" style="color:#c084fc">Zurück zum ACY Club</a></p></div></main>';return;}injectStyles();loadUniversalMobile();const badge=document.createElement('div');badge.className='streamer-version';badge.textContent=`${VERSION} · DEV`;document.body.appendChild(badge);const profile=data.profile||{};set('streamer-name',profile.display_name||profile.username||'Streamer');set('streamer-role',data.isAdmin?'Admin + Streamer':'Streamer');set('streamer-role-quick',data.isAdmin?'Admin + Streamer':'Streamer');if(profile.avatar_url){const img=$('streamer-avatar');if(img){img.src=profile.avatar_url;img.hidden=false;$('streamer-avatar-fallback').hidden=true;}}loadTwitchMirror();setInterval(loadTwitchMirror,60000);}
  async function start(){loadUniversalMobile();try{const data=await roleCheck();init(data);}catch(error){const msg=$('streamer-status-message');if(msg){msg.textContent=error.message;msg.className='club-auth-status error';}}$('streamer-logout')?.addEventListener('click',async()=>{try{if(window.supabaseClient?.auth)await window.supabaseClient.auth.signOut();}catch{}location.href='/club.html';});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
