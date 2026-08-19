(()=>{
'use strict';
const VERSION='V19.0.0 · RC3';
const isClub=/club-profile/i.test(location.pathname);
const token=()=>{try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;const p=JSON.parse(localStorage.getItem(k)||'{}');const t=p?.access_token||p?.currentSession?.access_token||p?.session?.access_token||p?.data?.session?.access_token;if(t)return t;}}catch{}return null;};
function style(){if(document.getElementById('acy-v19-rc3-style'))return;const s=document.createElement('style');s.id='acy-v19-rc3-style';s.textContent=`
html,body{max-width:100%;overflow-x:hidden}
.acy-v19-rc3-badge{position:fixed;top:max(8px,env(safe-area-inset-top));right:10px;z-index:11991;padding:7px 11px;border:1px solid rgba(180,108,255,.4);border-radius:999px;background:rgba(10,9,15,.96);backdrop-filter:blur(12px);color:#f7f3ff;font:800 11px/1.1 system-ui,sans-serif;white-space:nowrap;pointer-events:none}
@media(max-width:700px){
 .pet-progression{width:100%!important;min-width:0!important;padding:14px!important}
 .pet-progression-head{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:5px!important;min-width:0!important;text-align:left!important}
 .pet-progression-head .eyebrow{font-size:11px!important;letter-spacing:.16em!important}
 .pet-progression-head strong{font-size:18px!important;line-height:1.2!important;white-space:normal!important;overflow-wrap:normal!important}
 .pet-progression-summary{display:grid!important;grid-template-columns:1fr!important;gap:4px!important;margin-top:10px!important;min-width:0!important}
 .pet-progression-summary span{display:block!important;width:100%!important;font-size:13px!important;line-height:1.25!important;white-space:normal!important;overflow-wrap:normal!important}
 .pet-progression-summary span:last-child{color:#aaa6b3!important}
 .pet-progression-bar{height:9px!important;margin:10px 0 12px!important}
 .pet-progression .pet-levels-fold summary{min-height:46px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;white-space:normal!important}
 .pet-progression-steps{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
 .pet-prog-step{min-width:0!important;padding:10px!important}.pet-prog-step small{white-space:normal!important;overflow-wrap:normal!important;line-height:1.2!important}
 .pet-main{min-width:0!important}.pet-identity{min-width:0!important}.pet-identity #pet-level-text{font-size:14px!important;line-height:1.3!important;white-space:normal!important}
 .pet-core-anchor-v182,.pet-section{min-width:0!important;max-width:100%!important}
 .pet-world-hero-v181 p{font-size:15px!important;line-height:1.45!important;max-width:100%!important}
}
@media(max-width:390px){.pet-progression{padding:12px!important}.pet-progression-head strong{font-size:17px!important}.pet-progression-summary span{font-size:12px!important}.pet-progression-steps{grid-template-columns:1fr!important}}
`;
document.head.appendChild(s)}
function removeAdminMod(){if(!isClub)return;document.querySelectorAll('a,button').forEach(el=>{const text=(el.textContent||'').replace(/\s+/g,' ').trim();const href=(el.getAttribute('href')||'').toLowerCase();if(/^⚙️?\s*admin\s*\/\s*mod$/i.test(text)||/^admin\s*\/\s*mod$/i.test(text)||(/admin\.html|mod\.html/.test(href)&&/admin|mod/i.test(text)))el.remove();});}
async function ensureStaff(){if(!isClub)return;const grid=document.querySelector('.mobile-more-grid-v181');if(!grid)return;let link=grid.querySelector('[data-v19-safe-staff],[data-v19-staff-entry]');if(link){link.href='/staff-center.html';link.dataset.v19Rc3Staff='1';link.innerHTML='<span>🛡️</span><strong>Staff Center</strong><small>Admin · Mod · Streamer</small>';return;}const t=token();if(!t)return;try{const r=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok||!(d.isAdmin||d.isModerator||d.isStreamer))return;link=document.createElement('a');link.href='/staff-center.html';link.dataset.v19Rc3Staff='1';link.innerHTML='<span>🛡️</span><strong>Staff Center</strong><small>Admin · Mod · Streamer</small>';grid.appendChild(link);}catch{} }
function badge(){document.querySelectorAll('#acy-build-marker,.streamer-version,#acy-dev-version-badge,.acy-v19-rc-badge,.acy-v19-rc-badge-v2,.acy-v19-rc-safe-badge,.acy-v19-rc3-badge').forEach(e=>e.remove());const b=document.createElement('div');b.id='acy-v19-rc3-badge';b.className='acy-v19-rc3-badge';b.textContent=VERSION;document.body.appendChild(b)}
function init(){style();removeAdminMod();badge();ensureStaff();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
