(() => {
  'use strict';
  const VERSION = 'V19.0.0 · RC5';
  const isClub = /club-profile\.html$/i.test(location.pathname) || /club-profile/i.test(location.pathname);

  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function storedToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue;
        const p = JSON.parse(localStorage.getItem(k) || '{}');
        const t = p?.access_token || p?.currentSession?.access_token || p?.session?.access_token || p?.data?.session?.access_token;
        if (t) return t;
      }
    } catch {}
    return null;
  }

  async function sessionToken() {
    const existing = storedToken();
    if (existing) return existing;
    try {
      const cfg = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(r => r.json());
      if (cfg?.supabaseUrl && cfg?.supabaseAnonKey && window.supabase?.createClient) {
        const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const { data } = await sb.auth.getSession();
        return data?.session?.access_token || null;
      }
    } catch {}
    return null;
  }

  function styles() {
    if (document.getElementById('acy-v19-rc5-style')) return;
    const s = document.createElement('style');
    s.id = 'acy-v19-rc5-style';
    s.textContent = `
      html,body{max-width:100%;overflow-x:hidden}*,*::before,*::after{box-sizing:border-box}
      .acy-v19-rc5-badge{position:fixed;top:max(8px,env(safe-area-inset-top));right:10px;z-index:12050;padding:7px 11px;border:1px solid rgba(180,108,255,.38);border-radius:999px;background:rgba(10,9,15,.94);backdrop-filter:blur(12px);color:#f7f3ff;font:800 11px/1.1 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;white-space:nowrap}
      .member-avatar-img,.member-avatar,.member-directory-avatar img,.social-avatar img,.member-list-avatar img,.profile-avatar img,.profile-avatar{width:100%;height:100%;object-fit:cover;object-position:center;border-radius:50%!important;overflow:hidden}
      .member-avatar-wrap,.member-directory-avatar,.social-avatar,.member-list-avatar,.profile-avatar{overflow:hidden;border-radius:50%!important}
      @media(max-width:700px){
        .member-header-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important;min-width:0!important}.member-header-actions>*{min-width:0!important;max-width:100%!important;width:100%!important;min-height:44px!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center!important}
        .member-fold>summary,.member-fold-summary{display:grid!important;grid-template-columns:56px minmax(0,1fr) 40px!important;gap:10px!important;align-items:center!important;width:100%!important;min-width:0!important;padding:13px!important;text-align:left!important}.member-fold-art-wrap,.member-fold-art{width:56px!important;height:56px!important;min-width:56px!important;border-radius:15px!important;object-fit:cover!important}.member-fold-summary-main{min-width:0!important;width:100%!important;text-align:left!important}.member-fold-summary-main strong{display:block!important;font-size:20px!important;line-height:1.12!important;white-space:normal!important;overflow-wrap:anywhere!important}.member-fold-summary-main small{display:block!important;margin-top:5px!important;font-size:13px!important;line-height:1.28!important;white-space:normal!important;overflow-wrap:anywhere!important}.member-fold-summary-side{display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:6px!important;min-width:0!important}.member-fold-summary-side .member-fold-chevron{width:36px!important;height:36px!important;display:grid!important;place-items:center!important;border-radius:12px!important}
        .member-count-chip,.level-chip,.member-glow-title,.v18-status-pill,.member-level-badge,.level-badge,.hub-level-badge,.hub-level-pill,.progression-level-badge,[class*="status-pill"],[class*="count-chip"],[class*="level-badge"]{width:max-content!important;height:auto!important;min-width:0!important;max-width:100%!important;padding:7px 10px!important;border-radius:14px!important;aspect-ratio:auto!important;white-space:normal!important;overflow-wrap:anywhere!important;line-height:1.15!important}
        .v19-inline-summary-status{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:max-content!important;max-width:100%!important;margin-top:7px!important;padding:6px 9px!important;border-radius:12px!important;font-size:11px!important;line-height:1.1!important;white-space:normal!important;overflow-wrap:anywhere!important}
        #hub-progression-card .hub-progression-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;align-items:start!important}#hub-progression-card .hub-progression-head>*{min-width:0!important;max-width:100%!important}#hub-progression-card .hub-progression-head>*:last-child{min-width:92px!important;max-width:130px!important;width:auto!important;border-radius:18px!important;padding:9px 11px!important;white-space:normal!important}
        .catalog-levels,.catalog-levels-scroll{grid-template-columns:1fr!important;gap:10px!important;max-width:100%!important;overflow:hidden!important}
        .badge-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.badge-grid>*{min-width:0!important}.badge-grid img{width:100%!important;height:auto!important;object-fit:cover!important}
        #hub-community-games,#hub-community-games>*{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}#hub-community-games h1,#hub-community-games h2,#hub-community-games h3,#hub-community-games p,#hub-community-games strong,#hub-community-games small{max-width:100%!important;min-width:0!important;overflow-wrap:anywhere!important}#hub-community-games button,#hub-community-games a{width:100%!important;max-width:100%!important;white-space:normal!important}
        body.staff-page .staff-shell{max-width:100%!important;padding:14px 12px 70px!important}body.staff-page .staff-head{display:block!important}body.staff-page .staff-meta{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:14px!important}body.staff-page .staff-meta>*{width:100%!important;min-width:0!important}body.staff-page .staff-grid{grid-template-columns:1fr!important;gap:12px!important}body.staff-page .staff-card{min-width:0!important;max-width:100%!important;padding:18px!important}
        .streamer-dashboard{padding-left:14px!important;padding-right:14px!important}.streamer-dashboard .member-card,.streamer-dashboard .member-hero-card{width:100%!important;max-width:100%!important;min-width:0!important}.streamer-dashboard .member-quick{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}.streamer-dashboard .streamer-metric-grid{grid-template-columns:1fr!important;gap:10px!important}.streamer-tool-grid{grid-template-columns:1fr!important;gap:10px!important}.streamer-tool-grid .button{width:100%!important;min-height:58px!important;white-space:normal!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important;text-align:center!important}
      }
      @media(max-width:390px){.member-fold>summary,.member-fold-summary{grid-template-columns:52px minmax(0,1fr) 38px!important;gap:8px!important;padding:11px!important}.member-fold-art-wrap,.member-fold-art{width:52px!important;height:52px!important;min-width:52px!important}.member-fold-summary-main strong{font-size:18px!important}.member-fold-summary-main small{font-size:12px!important}}
    `;
    document.head.appendChild(s);
  }

  function badge() {
    document.querySelectorAll('#acy-build-marker,.streamer-version,#acy-dev-version-badge,.acy-v19-rc-badge,.acy-v19-rc-badge-v2,.acy-v19-rc-safe-badge,.acy-v19-rc5-badge').forEach(e => e.remove());
    const b = document.createElement('div'); b.id='acy-v19-rc5-badge'; b.className='acy-v19-rc5-badge'; b.textContent=VERSION; document.body.appendChild(b);
  }

  function moveStatuses() {
    if (!isClub) return;
    document.querySelectorAll('.member-fold>summary,.member-fold-summary').forEach(summary => {
      const main=summary.querySelector('.member-fold-summary-main'); const side=summary.querySelector('.member-fold-summary-side'); if(!main||!side)return;
      const status=side.querySelector('.member-count-chip,.chat-online-chip,.member-glow-title'); if(!status)return;
      if(!main.contains(status)){ status.classList.add('v19-inline-summary-status'); main.appendChild(status); }
    });
  }

  function removeHeaderStaff() {
    if(!isClub)return;
    document.querySelectorAll('.member-header-actions a,.member-header-actions button').forEach(el=>{const t=(el.textContent||'').replace(/\s+/g,' ').trim();const h=(el.getAttribute('href')||'').toLowerCase();if(/admin\s*\/\s*mod/i.test(t)||h.includes('admin.html')||h.includes('mod.html'))el.remove();});
  }

  async function syncStaff() {
    if(!isClub)return;
    const grid=document.querySelector('.mobile-more-grid-v181'); if(!grid)return;
    [...grid.querySelectorAll('a,button')].forEach(el=>{const t=(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();const h=(el.getAttribute('href')||'').toLowerCase();if(t.includes('staff center')||h.includes('staff.html')||h.includes('staff-center.html'))el.remove();});
    const token=await sessionToken(); if(!token)return;
    try{
      const r=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(7000)}); const d=await r.json().catch(()=>({})); if(!r.ok||!d.ok||!(d.isStaff||d.isAdmin||d.isModerator||d.isStreamer))return;
      const a=document.createElement('a'); a.href='/staff.html'; a.dataset.v19Rc5Staff='1'; a.innerHTML='<span>🛡️</span><strong>Staff Center</strong><small>Admin · Mod · Streamer</small>'; grid.appendChild(a);
    }catch{}
  }

  function init(){styles();badge();removeHeaderStaff();moveStatuses();syncStaff(); [600,1500,3000].forEach(ms=>setTimeout(()=>{removeHeaderStaff();moveStatuses();syncStaff();},ms));}
  ready(init);
})();
