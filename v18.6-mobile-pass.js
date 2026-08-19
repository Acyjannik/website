(() => {
  'use strict';

  const VERSION = 'V18.6.5';

  const css = `
    /* V18.6.5 — mobile-first information hierarchy pass. Visual only. */
    @media (max-width:700px){
      .club-auth-page .member-fold-summary{
        display:grid !important;
        grid-template-columns:56px minmax(0,1fr) 36px !important;
        align-items:center !important;
        gap:12px !important;
        min-height:72px !important;
        padding:12px 14px !important;
      }
      .club-auth-page .member-fold-art-wrap{
        width:56px !important;
        height:56px !important;
        min-width:56px !important;
        display:grid !important;
        place-items:center !important;
        border-radius:16px !important;
        overflow:hidden !important;
      }
      .club-auth-page .member-fold-art{
        width:56px !important;
        height:56px !important;
        max-width:56px !important;
        max-height:56px !important;
        object-fit:cover !important;
        object-position:center !important;
        display:block !important;
      }
      .club-auth-page .member-fold-summary-main{
        min-width:0 !important;
        width:auto !important;
        display:flex !important;
        flex-direction:column !important;
        align-items:flex-start !important;
        justify-content:center !important;
        gap:2px !important;
      }
      .club-auth-page .member-fold-summary-main .eyebrow{
        font-size:10px !important;
        line-height:1.2 !important;
        margin:0 !important;
      }
      .club-auth-page .member-fold-summary-main strong{
        display:block !important;
        width:auto !important;
        max-width:none !important;
        font-size:20px !important;
        line-height:1.12 !important;
        letter-spacing:-.02em !important;
        white-space:normal !important;
        overflow-wrap:anywhere !important;
      }
      .club-auth-page .member-fold-summary-main small{
        display:block !important;
        width:auto !important;
        max-width:none !important;
        font-size:13px !important;
        line-height:1.35 !important;
        color:#a1a1aa !important;
        white-space:normal !important;
        overflow-wrap:anywhere !important;
      }
      .club-auth-page .member-fold-summary-side{
        width:36px !important;
        min-width:36px !important;
        display:grid !important;
        place-items:center !important;
        align-self:center !important;
      }
      .club-auth-page .member-fold-summary-side .member-count-chip{
        grid-column:1 !important;
        max-width:36px !important;
        overflow:hidden !important;
        white-space:nowrap !important;
        font-size:10px !important;
        padding:5px 6px !important;
      }
      .club-auth-page .member-fold-chevron{
        font-size:18px !important;
        line-height:1 !important;
      }

      .club-auth-page .member-card-head{
        display:grid !important;
        grid-template-columns:minmax(0,1fr) auto !important;
        align-items:start !important;
        gap:12px !important;
      }
      .club-auth-page .member-card-head > div:first-child{
        min-width:0 !important;
      }
      .club-auth-page .member-card-head h2,
      .club-auth-page .member-card-head h3{
        max-width:none !important;
        overflow-wrap:anywhere !important;
      }
      .club-auth-page .member-card-head p{
        max-width:100% !important;
        font-size:14px !important;
        line-height:1.45 !important;
      }

      .club-auth-page .member-card,
      .club-auth-page .member-hub,
      .club-auth-page .v18-app-home,
      .club-auth-page .pet-section{
        min-height:0 !important;
        height:auto !important;
        overflow:hidden !important;
      }

      .club-auth-page .member-card .member-fold-body,
      .club-auth-page .member-card > .member-fold-body{
        min-width:0 !important;
        overflow-wrap:anywhere !important;
      }

      .club-auth-page .member-fold-summary + .member-fold-body{
        padding-left:14px !important;
        padding-right:14px !important;
      }

      .club-auth-page .v18-action-card,
      .club-auth-page .settings-tile-v10,
      .club-auth-page .notification-setting-card{
        min-width:0 !important;
      }

      .club-auth-page .v18-action-card strong,
      .club-auth-page .settings-tile-v10 strong,
      .club-auth-page .notification-setting-card strong{
        line-height:1.2 !important;
        overflow-wrap:anywhere !important;
      }

      /* Community game / wheel cards: keep artwork and text horizontal. */
      .club-auth-page .hub-games-card .member-fold-summary,
      .club-auth-page #hub-community-games .member-fold-summary,
      .club-auth-page #club-wheel-section .member-fold-summary,
      .club-auth-page #member-events-section .member-fold-summary,
      .club-auth-page #progression-catalog .member-fold-summary{
        grid-template-columns:64px minmax(0,1fr) 36px !important;
      }
      .club-auth-page .hub-games-card .member-fold-art-wrap,
      .club-auth-page #hub-community-games .member-fold-art-wrap,
      .club-auth-page #club-wheel-section .member-fold-art-wrap,
      .club-auth-page #member-events-section .member-fold-art-wrap,
      .club-auth-page #progression-catalog .member-fold-art-wrap{
        width:64px !important;
        height:64px !important;
        min-width:64px !important;
      }
      .club-auth-page .hub-games-card .member-fold-art,
      .club-auth-page #hub-community-games .member-fold-art,
      .club-auth-page #club-wheel-section .member-fold-art,
      .club-auth-page #member-events-section .member-fold-art,
      .club-auth-page #progression-catalog .member-fold-art{
        width:64px !important;
        height:64px !important;
      }

      /* Never allow legacy build stamps to compete with the single DEV badge. */
      body.club-auth-page *{ }
    }

    @media (max-width:380px){
      .club-auth-page .member-fold-summary{
        grid-template-columns:50px minmax(0,1fr) 32px !important;
        gap:10px !important;
        min-height:66px !important;
        padding:10px 12px !important;
      }
      .club-auth-page .member-fold-art-wrap,
      .club-auth-page .member-fold-art{
        width:50px !important;
        height:50px !important;
        min-width:50px !important;
        max-width:50px !important;
        max-height:50px !important;
      }
      .club-auth-page .member-fold-summary-main strong{font-size:18px !important}
      .club-auth-page .member-fold-summary-main small{font-size:12px !important}
    }
  `;

  function removeLegacyBuildStamp() {
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length === 0 && /ACY\s+BUILD\s+V18\.1/i.test(el.textContent || '')) {
        el.remove();
      }
    });
  }

  function install(){
    if (!document.getElementById('acy-v1865-mobile-pass-style')){
      const style = document.createElement('style');
      style.id = 'acy-v1865-mobile-pass-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
    removeLegacyBuildStamp();
    document.documentElement.dataset.acyVisualVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
