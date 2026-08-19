(() => {
  'use strict';
  const VERSION = 'V18.9.0';

  function injectStyles() {
    if (document.getElementById('acy-v189-universal-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v189-universal-style';
    style.textContent = `
      *,*::before,*::after{box-sizing:border-box}
      html,body{max-width:100%;overflow-x:hidden}
      img{max-width:100%;height:auto}
      button,a,input,select,textarea,summary{touch-action:manipulation}

      /* Privileged/admin/mod pages: prevent desktop grids from leaking into mobile. */
      .admin-shell{max-width:100%;width:100%;}
      .admin-main{min-width:0;max-width:100%;}
      .admin-toolbar{min-width:0;max-width:100%;}
      .admin-grid{min-width:0;max-width:100%;}
      .admin-card,.admin-view,.admin-table,.admin-inline,.admin-stats,.admin-nav,.admin-sidebar{min-width:0;max-width:100%;}

      /* Streamer / Club-style pages. */
      .member-dashboard,.club-auth-shell,.streamer-dashboard{min-width:0;max-width:100%;}
      .member-header-actions{min-width:0;max-width:100%;display:flex;flex-wrap:wrap;gap:8px;}
      .member-header-actions .button{min-width:0;max-width:100%;}
      .member-card-head,.member-identity{min-width:0;}
      .member-card-head>* ,.member-identity>*{min-width:0;}
      .member-count-chip,.member-glow-title,.v18-status-pill{min-width:0;max-width:100%;overflow-wrap:anywhere;white-space:normal;}

      .acy-v189-version{position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12100;padding:7px 12px;border:1px solid rgba(180,108,255,.42);border-radius:999px;background:rgba(11,11,16,.94);backdrop-filter:blur(18px);color:#f7f3ff;font:800 12px/1 system-ui,sans-serif;letter-spacing:.05em;white-space:nowrap;pointer-events:none}
      .acy-v189-version i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#b46cff;box-shadow:0 0 12px rgba(180,108,255,.75)}

      @media(max-width:700px){
        body{font-size:15px}

        .admin-shell{padding-left:12px!important;padding-right:12px!important;}
        .admin-sidebar{position:static!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;display:block!important;}
        .admin-sidebar::-webkit-scrollbar{display:none}
        .admin-brand{margin-bottom:10px!important;}
        .admin-nav{display:flex!important;gap:8px!important;min-width:max-content!important;}
        .admin-nav-group{display:flex!important;align-items:center!important;gap:6px!important;min-width:max-content!important;}
        .admin-nav-label{display:none!important}
        .admin-nav .admin-tab{min-height:44px!important;padding:9px 13px!important;white-space:nowrap!important;}
        .admin-main{width:100%!important;padding:0!important;}
        .admin-toolbar{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:12px!important;padding:14px 0!important;}
        .admin-toolbar-meta{display:flex!important;flex-wrap:wrap!important;gap:8px!important;}
        .admin-toolbar-meta>*{min-width:0!important;max-width:100%!important;}
        .admin-view{width:100%!important;}
        .admin-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;width:100%!important;}
        .admin-span-2{grid-column:1/-1!important;}
        .admin-stats,.admin-stats-4{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
        .admin-stat{min-width:0!important;}
        .admin-card{width:100%!important;padding:16px!important;border-radius:20px!important;overflow:hidden!important;}
        .admin-form label,.admin-field{min-width:0!important;}
        .admin-form input,.admin-form textarea,.admin-form select,.admin-field input,.admin-field select,.admin-field textarea{width:100%!important;max-width:100%!important;min-width:0!important;}
        .admin-table{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;}
        .admin-table-row{min-width:620px!important;}
        .quick-actions{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;}

        .member-header-actions{width:100%!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
        .member-header-actions .button{width:100%!important;max-width:none!important;justify-content:center!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important;}
        .member-quick{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;}
        .member-quick>div{min-width:0!important;}
        .member-quick span,.member-quick strong{overflow-wrap:anywhere!important;word-break:break-word!important;}

        .streamer-metric-grid{grid-template-columns:1fr!important;gap:10px!important;}
        .streamer-tool-grid{grid-template-columns:1fr!important;gap:10px!important;}
        .streamer-actions-card{width:100%!important;}
        .streamer-actions-card .button{width:100%!important;min-height:56px!important;white-space:normal!important;overflow-wrap:anywhere!important;}
        .streamer-live-card .member-card-head{display:flex!important;flex-direction:column!important;align-items:stretch!important;}

        /* Level/badge/chip content must breathe. Never squash multi-word labels into tiny circles. */
        .member-level-badge,.level-badge,.hub-level-badge,.hub-level-pill,.progression-level-badge,.member-count-chip,.member-glow-title,.v18-status-pill{border-radius:18px!important;min-width:0!important;max-width:100%!important;padding:8px 12px!important;line-height:1.15!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
        .level-badge,.member-level-badge,.hub-level-badge,.progression-level-badge{width:auto!important;height:auto!important;aspect-ratio:auto!important;}

        /* Long status/count chips become compact pills, never truncated circles. */
        [class*="count-chip"],[class*="status-pill"],[class*="glow-title"]{white-space:normal!important;overflow-wrap:anywhere!important;min-width:0!important;max-width:100%!important;height:auto!important;}

        /* Remove obsolete privileged links from ordinary app headers. Staff Center is the only entry point. */
        .member-header-actions a[href="/admin.html"],.member-header-actions a[href="/mod.html"],
        .member-header-actions button[data-admin-link],.member-header-actions button[data-mod-link]{display:none!important;}
      }

      @media(max-width:430px){
        .admin-shell{padding-left:9px!important;padding-right:9px!important;}
        .admin-card{padding:13px!important;}
        .admin-stats,.admin-stats-4{grid-template-columns:1fr 1fr!important;}
        .member-header-actions{grid-template-columns:1fr 1fr!important;}
        .acy-v189-version{font-size:11px;padding:6px 10px;}
      }

      @media(max-width:360px){
        .admin-stats,.admin-stats-4{grid-template-columns:1fr!important;}
        .member-header-actions{grid-template-columns:1fr!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function installVersion() {
    if (location.pathname === '/' || location.pathname === '/index.html') return;
    let badge = document.getElementById('acy-v189-version-badge');
    if (!badge) { badge = document.createElement('div'); badge.id='acy-v189-version-badge'; document.body.appendChild(badge); }
    badge.className='acy-v189-version';
    badge.innerHTML=`<i></i><span>${VERSION} · DEV</span>`;
  }

  function cleanObsoleteStaffLinks() {
    const candidates=document.querySelectorAll('.member-header-actions a,.admin-actions a,.site-header a,body a,body button');
    candidates.forEach(el=>{
      const text=(el.textContent||'').trim();
      const href=(el.getAttribute('href')||'').toLowerCase();
      if((/admin\s*\/\s*mod/i.test(text)||href==='/admin.html'||href==='/mod.html') && !location.pathname.endsWith('/staff.html') && !location.pathname.endsWith('/admin.html') && !location.pathname.endsWith('/mod.html')){
        if(el.closest('.member-header-actions,.admin-actions,.site-header')) el.remove();
      }
    });
  }

  function init(){injectStyles();installVersion();cleanObsoleteStaffLinks();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
