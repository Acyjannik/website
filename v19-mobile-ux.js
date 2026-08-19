(() => {
  'use strict';
  const VERSION = 'V19.0.0 · RC1';
  const isClub = /club-profile\.html$/i.test(location.pathname) || /club-profile/i.test(location.pathname);
  const isStreamer = /streamer\.html$/i.test(location.pathname);
  const isStaff = /staff\.html$/i.test(location.pathname);
  const isAdmin = /admin\.html$/i.test(location.pathname);
  const isMod = /mod\.html$/i.test(location.pathname);
  const isPrivilegedPage = isStreamer || isStaff || isAdmin || isMod;

  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  function token() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const payload = JSON.parse(localStorage.getItem(key) || '{}');
        if (payload?.access_token) return payload.access_token;
      }
    } catch {}
    return null;
  }

  function injectStyles() {
    if (document.getElementById('acy-v19-mobile-ux-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v19-mobile-ux-style';
    style.textContent = `
      html,body{max-width:100%;overflow-x:hidden}
      *,*::before,*::after{box-sizing:border-box}

      .acy-v19-rc-badge-v2{position:fixed;top:max(8px,env(safe-area-inset-top));right:10px;z-index:11990;padding:6px 10px;border:1px solid rgba(180,108,255,.38);border-radius:999px;background:rgba(10,9,15,.94);backdrop-filter:blur(12px);color:#f7f3ff;font:800 11px/1.1 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;white-space:nowrap}

      @media(max-width:700px){
        body{font-size:15px}

        /* Universal mobile header: no squashed micro-buttons. */
        .club-auth-header .member-header-actions,
        .admin-topbar,
        .staff-head,
        .member-header-actions{
          min-width:0!important;max-width:100%!important
        }
        .club-auth-header .member-header-actions,
        .member-header-actions{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:8px!important;
          width:100%!important;
        }
        .member-header-actions>*{
          min-width:0!important;max-width:100%!important;
          min-height:44px!important;
          width:100%!important;
          white-space:normal!important;
          overflow-wrap:anywhere!important;
          text-align:center!important;
        }
        .member-header-actions>*:last-child:nth-child(3),
        .member-header-actions>*:last-child:nth-child(5){grid-column:1/-1!important}

        /* App summary cards: content owns the width, status sits below it. */
        .member-fold>summary,.member-fold-summary{
          display:grid!important;
          grid-template-columns:56px minmax(0,1fr) 42px!important;
          align-items:center!important;
          gap:10px!important;
          width:100%!important;
          min-width:0!important;
          padding:13px!important;
          text-align:left!important;
        }
        .member-fold-art-wrap,.member-fold-art{
          width:56px!important;height:56px!important;min-width:56px!important;
          border-radius:15px!important;
        }
        .member-fold-summary-main{
          min-width:0!important;width:100%!important;display:block!important;text-align:left!important;
        }
        .member-fold-summary-main .eyebrow{display:block!important;margin:0 0 4px!important;font-size:10px!important;line-height:1.15!important}
        .member-fold-summary-main strong{
          display:block!important;width:100%!important;max-width:100%!important;
          font-size:20px!important;line-height:1.12!important;
          white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
        }
        .member-fold-summary-main small{
          display:block!important;width:100%!important;max-width:100%!important;margin-top:5px!important;
          font-size:13px!important;line-height:1.28!important;
          white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
        }
        .member-fold-summary-side{
          display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-end!important;
          gap:6px!important;min-width:0!important;max-width:100%!important;
        }
        .member-fold-summary-side .member-fold-chevron{
          width:36px!important;height:36px!important;display:grid!important;place-items:center!important;border-radius:12px!important;flex:0 0 36px!important;
        }
        .v19-inline-summary-status{
          display:inline-flex!important;align-items:center!important;justify-content:center!important;
          width:max-content!important;max-width:100%!important;min-width:0!important;
          margin-top:8px!important;padding:6px 9px!important;border-radius:12px!important;
          white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
          font-size:10px!important;line-height:1.1!important;
        }
        .v19-inline-summary-status.chat-online-chip{display:inline-flex!important}

        /* Never turn badges/status into circles. */
        .member-count-chip,.level-chip,.member-glow-title,.v18-status-pill,.member-level-badge,.level-badge,
        .hub-level-badge,.hub-level-pill,.progression-level-badge,[class*="status-pill"],[class*="count-chip"],[class*="level-badge"]{
          width:auto!important;height:auto!important;min-width:0!important;max-width:100%!important;
          padding:7px 10px!important;border-radius:14px!important;aspect-ratio:auto!important;
          white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.12!important;
        }

        /* Progression: milestone is a pill, never a circle. */
        #hub-progression-card .hub-progression-head{
          display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;align-items:start!important;
        }
        #hub-progression-card .hub-progression-head>*{min-width:0!important;max-width:100%!important}
        #hub-progression-card .hub-progression-head > *:last-child{
          justify-self:end!important;text-align:center!important;min-width:92px!important;max-width:120px!important;
          width:auto!important;border-radius:18px!important;padding:9px 11px!important;aspect-ratio:auto!important;
          white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;
          font-size:14px!important;line-height:1.2!important;
        }

        /* Badge catalog cards stay readable and use the full width. */
        .badge-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        .badge-grid>*{min-width:0!important;max-width:100%!important}
        .badge-grid img{max-width:100%!important;height:auto!important;object-fit:cover!important}
        .catalog-levels-scroll,.catalog-levels{grid-template-columns:1fr!important;gap:10px!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}

        /* Community Games: one-column app flow on phones. */
        #hub-community-games,
        #hub-community-games>* ,
        #hub-community-games .hub-games-layout,
        #hub-community-games .hub-games-grid,
        #hub-community-games .community-games-layout,
        #hub-community-games .community-games-grid{
          display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;
        }
        #hub-community-games h1,#hub-community-games h2,#hub-community-games h3,#hub-community-games h4,
        #hub-community-games p,#hub-community-games strong,#hub-community-games small{
          width:100%!important;max-width:100%!important;min-width:0!important;overflow-wrap:anywhere!important;word-break:normal!important;
        }
        #hub-community-games button,#hub-community-games a{width:100%!important;max-width:100%!important;min-width:0!important;white-space:normal!important}

        /* Social / directory actions become comfortable touch targets. */
        .social-connection-list,.social-connection-list>* , .member-directory-list,.member-directory-list>*{
          min-width:0!important;max-width:100%!important;
        }
        .social-connection-list .button{width:100%!important;max-width:100%!important;white-space:normal!important}

        /* Streamer Center mobile treatment. */
        .streamer-dashboard{padding-left:0!important;padding-right:0!important}
        .streamer-dashboard .member-hero-card,.streamer-dashboard .member-card{width:100%!important;max-width:100%!important;min-width:0!important}
        .streamer-dashboard .streamer-hero-card .member-identity{display:grid!important;grid-template-columns:64px minmax(0,1fr)!important;gap:12px!important;min-width:0!important}
        .streamer-dashboard .streamer-hero-card .member-avatar-wrap{width:64px!important;min-width:64px!important}
        .streamer-dashboard .streamer-hero-card .member-quick{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin-top:14px!important}
        .streamer-dashboard .streamer-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        .streamer-dashboard .streamer-metric-grid>*{min-width:0!important;max-width:100%!important}
        .streamer-dashboard .streamer-metric-grid strong{font-size:17px!important;line-height:1.2!important;overflow-wrap:anywhere!important}
        .streamer-tool-grid{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
        .streamer-tool-grid .button{
          min-width:0!important;max-width:100%!important;width:100%!important;min-height:58px!important;
          display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;
          flex-wrap:wrap!important;white-space:normal!important;text-align:center!important;line-height:1.2!important;
        }
        .streamer-tool-grid .button small{display:block!important;flex:1 0 100%!important;font-size:12px!important;line-height:1.2!important;margin-top:2px!important}
        .streamer-permission-list>div{width:100%!important;min-width:0!important;max-width:100%!important;line-height:1.35!important;overflow-wrap:anywhere!important}

        /* Staff Center */
        body.staff-page .staff-shell{padding:16px 12px 70px!important;max-width:100%!important}
        body.staff-page .staff-head{display:block!important}
        body.staff-page .staff-meta{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;justify-content:stretch!important;margin-top:14px!important}
        body.staff-page .staff-meta>*{width:100%!important;min-width:0!important;max-width:100%!important}
        body.staff-page .staff-grid{grid-template-columns:1fr!important;gap:12px!important}
        body.staff-page .staff-card{min-width:0!important;max-width:100%!important;padding:18px!important}

        /* Admin / Mod */
        body.admin-page .admin-shell,body.admin-body .admin-shell{max-width:100%!important;padding:14px 12px 70px!important}
        body.admin-page .admin-sidebar,body.admin-body .admin-sidebar{width:100%!important;max-width:100%!important;position:static!important}
        body.admin-page .admin-nav,body.admin-body .admin-nav{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
        body.admin-page .admin-nav>* ,body.admin-body .admin-nav>*{min-width:0!important;max-width:100%!important}
        body.admin-page .admin-content,body.admin-body .admin-content{width:100%!important;max-width:100%!important;min-width:0!important}
        body.admin-page table,body.admin-body table{display:block!important;width:100%!important;overflow-x:auto!important;white-space:nowrap!important}
      }

      @media(max-width:390px){
        .member-fold>summary,.member-fold-summary{grid-template-columns:52px minmax(0,1fr) 40px!important;gap:8px!important;padding:11px!important}
        .member-fold-art-wrap,.member-fold-art{width:52px!important;height:52px!important;min-width:52px!important;border-radius:14px!important}
        .member-fold-summary-main strong{font-size:18px!important}
        .member-fold-summary-main small{font-size:12px!important}
        .streamer-dashboard .streamer-hero-card .member-quick{grid-template-columns:1fr!important}
        .streamer-dashboard .streamer-metric-grid{grid-template-columns:1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function removeLegacyVersionBadges() {
    document.querySelectorAll('#acy-build-marker,.streamer-version,#acy-dev-version-badge,.acy-v19-rc-badge').forEach(el => el.remove());
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').trim();
      if (/^V18\.[0-9.]+\s*·\s*DEV$/.test(text)) el.remove();
    });
  }

  function installVersionBadge() {
    removeLegacyVersionBadges();
    let badge = document.getElementById('acy-v19-rc-badge-v2');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-v19-rc-badge-v2';
      document.body.appendChild(badge);
    }
    badge.className = 'acy-v19-rc-badge-v2';
    badge.textContent = VERSION;
  }

  function moveSummaryStatuses() {
    if (!isClub) return;
    document.querySelectorAll('.member-fold>summary,.member-fold-summary').forEach(summary => {
      if (summary.dataset.v19Rebalanced === '1') return;
      const main = summary.querySelector('.member-fold-summary-main');
      const side = summary.querySelector('.member-fold-summary-side');
      if (!main || !side) return;
      const status = side.querySelector('.member-count-chip,.chat-online-chip');
      if (!status) { summary.dataset.v19Rebalanced='1'; return; }
      status.classList.add('v19-inline-summary-status');
      main.appendChild(status);
      summary.dataset.v19Rebalanced='1';
    });
  }

  async function addStaffToMore() {
    if (!isClub) return;
    const grid = document.querySelector('.mobile-more-grid-v181');
    if (!grid || grid.querySelector('[data-v19-staff-entry]')) return;
    const t = token();
    if (!t) return;
    try {
      const r = await fetch('/api/mod-auth', {headers:{Authorization:`Bearer ${t}`}, cache:'no-store'});
      const data = await r.json().catch(()=>({}));
      if (!r.ok || !data.ok || !(data.isAdmin || data.isModerator || data.isStreamer)) return;
      const link = document.createElement('a');
      link.href = '/staff.html';
      link.dataset.v19StaffEntry = '1';
      link.innerHTML = '<span>🛡️</span><strong>Staff Center</strong><small>Admin · Mod · Streamer</small>';
      grid.appendChild(link);
    } catch {}
  }

  function removeLegacyHeaderStaffShortcut() {
    if (!isClub) return;
    document.querySelectorAll('.member-header-actions a,.member-header-actions button').forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (/admin\s*\/\s*mod/i.test(text) || /admin\.html|mod\.html/.test(href)) el.remove();
    });
  }

  function init() {
    injectStyles();
    removeLegacyHeaderStaffShortcut();
    moveSummaryStatuses();
    installVersionBadge();
    addStaffToMore();

    const observer = new MutationObserver(() => {
      removeLegacyHeaderStaffShortcut();
      moveSummaryStatuses();
      installVersionBadge();
      addStaffToMore();
    });
    observer.observe(document.body, {subtree:true,childList:true});
  }

  ready(init);
})();
