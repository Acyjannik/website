(() => {
  'use strict';
  const VERSION = 'V19.0.0 · RC1';
  const isClub = /club-profile\.html$/i.test(location.pathname) || /club-profile/i.test(location.pathname);
  if (!isClub) return;

  function injectStyles() {
    if (document.getElementById('acy-v19-rc-mobile-style')) return;
    const s = document.createElement('style');
    s.id = 'acy-v19-rc-mobile-style';
    s.textContent = `
      html,body{max-width:100%;overflow-x:hidden}
      *,*::before,*::after{box-sizing:border-box}
      #acy-build-marker,.streamer-version,#acy-dev-version-badge{display:none!important}
      .acy-v19-rc-badge{position:fixed;top:max(6px,env(safe-area-inset-top));right:10px;z-index:11990;padding:5px 9px;border:1px solid rgba(180,108,255,.34);border-radius:999px;background:rgba(10,9,15,.94);backdrop-filter:blur(12px);color:#f7f3ff;font:800 10px/1.1 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;white-space:nowrap}

      /* Never expose the legacy privileged shortcut in the club chrome. */
      .acy-v19-remove-staff{display:none!important}

      @media(max-width:700px){
        body{font-size:15px}

        /* Keep the actual app header compact and predictable. */
        .member-header-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;min-width:0!important;width:100%!important}
        .member-header-actions>*{min-width:0!important;max-width:100%!important}
        .member-header-actions .button,.member-header-actions .sound-toggle,.member-header-actions .notification-bell{min-height:44px!important}

        /* Real app cards: icon | content | action. */
        .member-fold>summary,.member-fold-summary{display:grid!important;grid-template-columns:58px minmax(0,1fr) 46px!important;align-items:center!important;gap:10px!important;width:100%!important;min-width:0!important;padding:13px!important;text-align:left!important}
        .member-fold-art-wrap,.member-fold-art{width:58px!important;height:58px!important;min-width:58px!important;border-radius:16px!important}
        .member-fold-summary-main{min-width:0!important;width:100%!important;text-align:left!important;display:block!important}
        .member-fold-summary-main .eyebrow{display:block!important;margin:0 0 4px!important;font-size:10px!important;line-height:1.15!important}
        .member-fold-summary-main strong{display:block!important;width:100%!important;max-width:100%!important;font-size:20px!important;line-height:1.12!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
        .member-fold-summary-main small{display:block!important;width:100%!important;max-width:100%!important;margin-top:5px!important;font-size:13px!important;line-height:1.28!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
        .member-fold-summary-side{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-end!important;gap:6px!important;min-width:0!important;max-width:100%!important}
        .member-fold-summary-side>*{max-width:100%!important;min-width:0!important}
        .member-fold-summary-side .member-count-chip,.member-fold-summary-side .chat-online-chip{display:block!important;width:auto!important;height:auto!important;min-width:0!important;max-width:96px!important;padding:6px 8px!important;border-radius:13px!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;font-size:10px!important;line-height:1.12!important;text-align:center!important}
        .member-fold-chevron{width:36px!important;height:36px!important;display:grid!important;place-items:center!important;border-radius:12px!important}

        /* Badges/status pills: never force text into a circle. */
        .member-count-chip,.level-chip,.member-glow-title,.v18-status-pill,.member-level-badge,.level-badge,.hub-level-badge,.hub-level-pill,.progression-level-badge,[class*="status-pill"],[class*="count-chip"],[class*="level-badge"]{width:auto!important;height:auto!important;min-width:0!important;max-width:100%!important;padding:7px 10px!important;border-radius:14px!important;aspect-ratio:auto!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.12!important}

        /* Progression roadmap: two sane columns, no 30 LEVEL L nonsense. */
        #hub-progression-card .hub-progression-head{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(72px,118px)!important;gap:12px!important;align-items:start!important}
        #hub-progression-card .hub-progression-head>*{min-width:0!important;max-width:100%!important}
        #hub-progression-card .hub-progression-head h3,#hub-progression-card .hub-progression-head strong,#hub-progression-card .hub-progression-head span{max-width:100%!important;overflow-wrap:anywhere!important;word-break:normal!important}
        #hub-progression-card .hub-progression-head > *:last-child{justify-self:end!important;text-align:center!important}
        #hub-progression-card .catalog-levels-scroll,#hub-progression-card .catalog-levels{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}

        /* Community games: one readable column on phones. */
        #hub-community-games{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}
        #hub-community-games>*,#hub-community-games .hub-games-layout,#hub-community-games .hub-games-grid,#hub-community-games .community-games-layout,#hub-community-games .community-games-grid{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important}
        #hub-community-games h2,#hub-community-games h3,#hub-community-games p,#hub-community-games strong,#hub-community-games small{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow-wrap:anywhere!important;word-break:normal!important}
        #hub-community-games button,#hub-community-games a{width:100%!important;max-width:100%!important;min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important}

        /* Directory cards: keep avatar, identity and actions in normal reading order. */
        .member-directory-list,.member-directory-list>*{min-width:0!important;max-width:100%!important}
        .member-directory-card .member-card-head,.member-directory-card .member-identity{min-width:0!important;max-width:100%!important}
        .member-directory-card img{max-width:100%!important;height:auto!important;object-fit:cover!important}

        /* Friends lists: action buttons full-width but never wider than the card. */
        .social-connection-list,.social-connection-list>*{min-width:0!important;max-width:100%!important}
        .social-connection-list .button{width:100%!important;max-width:100%!important;white-space:normal!important}

        /* Don't let any old fixed-width child create a one-letter column. */
        .member-card,.member-fold,.member-fold-body,.hub-main-card,.hub-progression-card,.hub-poll-card,.hub-events-card,.hub-achievements-card,.hub-games-card{min-width:0!important;max-width:100%!important}
      }

      @media(max-width:390px){
        .member-fold>summary,.member-fold-summary{grid-template-columns:52px minmax(0,1fr) 42px!important;gap:8px!important;padding:11px!important}
        .member-fold-art-wrap,.member-fold-art{width:52px!important;height:52px!important;min-width:52px!important;border-radius:14px!important}
        .member-fold-summary-main strong{font-size:18px!important}
        .member-fold-summary-main small{font-size:12px!important}
        .member-fold-summary-side .member-count-chip{max-width:84px!important;font-size:9.5px!important}
        #hub-progression-card .hub-progression-head{grid-template-columns:minmax(0,1fr) 88px!important}
      }
    `;
    document.head.appendChild(s);
  }

  function removeLegacyStaffUi(){
    const nodes=[...document.querySelectorAll('a,button,[role="tab"],[role="link"],[role="button"]')];
    nodes.forEach(el=>{
      const txt=(el.textContent||'').replace(/\s+/g,' ').trim();
      const href=(el.getAttribute('href')||'').toLowerCase();
      if(/admin\s*\/\s*mod/i.test(txt)||/admin\.html|mod\.html|staff\.html/.test(href)){
        if(!el.closest('main.staff-page,body.admin-page,body.mod-page')){
          el.classList.add('acy-v19-remove-staff');
          el.remove();
        }
      }
    });
  }

  function installBadge(){
    document.querySelectorAll('.acy-v19-rc-badge').forEach((el,i)=>{if(i>0)el.remove();});
    let badge=document.querySelector('.acy-v19-rc-badge');
    if(!badge){badge=document.createElement('div');document.body.appendChild(badge);}
    badge.className='acy-v19-rc-badge';
    badge.textContent=VERSION;
  }

  function normalizeCommunityGames(){
    const root=document.getElementById('hub-community-games');
    if(!root)return;
    root.querySelectorAll('h1,h2,h3,h4,p,strong,small').forEach(el=>{
      el.style.maxWidth='100%';
      el.style.minWidth='0';
      el.style.overflowWrap='anywhere';
      el.style.wordBreak='normal';
    });
  }

  function init(){
    injectStyles();
    removeLegacyStaffUi();
    installBadge();
    normalizeCommunityGames();
    const observer=new MutationObserver(()=>{
      removeLegacyStaffUi();
      normalizeCommunityGames();
    });
    observer.observe(document.body,{subtree:true,childList:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
