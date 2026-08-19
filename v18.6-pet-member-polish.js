(() => {
  'use strict';

  // V18.6.3: visual polish only. No data, auth or action logic changes.
  const VERSION = 'V18.6.3';

  const css = `
    /* ---------- Pet Life: clearer app-style layout ---------- */
    .pet-world-page-v182 #pet-life-v182 {
      margin-top: 22px;
      padding: 0;
      border: 1px solid rgba(180,108,255,.20);
      border-radius: 26px;
      overflow: hidden;
      background: linear-gradient(145deg, rgba(20,17,29,.96), rgba(12,12,18,.98));
      box-shadow: 0 20px 60px rgba(0,0,0,.20);
    }
    .pet-world-page-v182 .pet-life-head-v17 {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:18px;
      padding:22px 22px 18px;
      background:linear-gradient(135deg,rgba(168,85,247,.13),rgba(255,255,255,.025));
      border-bottom:1px solid rgba(255,255,255,.07);
    }
    .pet-world-page-v182 .pet-life-title-row-v17 strong { font-size:22px; letter-spacing:-.02em; }
    .pet-world-page-v182 .pet-life-head-v17 small { display:block; max-width:620px; margin-top:6px; color:#a1a1aa; line-height:1.45; }
    .pet-world-page-v182 .pet-coins-v17 {
      flex:0 0 auto;
      padding:10px 14px;
      border:1px solid rgba(180,108,255,.28);
      border-radius:999px;
      background:rgba(168,85,247,.10);
      color:#e9d5ff;
      font-weight:800;
      white-space:nowrap;
    }
    .pet-world-page-v182 .pet-life-fold {
      margin:0;
      border:0;
      border-bottom:1px solid rgba(255,255,255,.065);
      border-radius:0;
      background:rgba(255,255,255,.018);
    }
    .pet-world-page-v182 .pet-life-fold:last-of-type { border-bottom:0; }
    .pet-world-page-v182 .pet-life-fold > summary {
      min-height:64px;
      padding:16px 20px;
      display:flex;
      align-items:center;
      gap:12px;
      font-weight:800;
      color:#f7f3ff;
      list-style:none;
      cursor:pointer;
    }
    .pet-world-page-v182 .pet-life-fold > summary::-webkit-details-marker { display:none; }
    .pet-world-page-v182 .pet-life-fold > summary span { margin-left:auto; color:#c084fc; font-size:13px; font-weight:700; }
    .pet-world-page-v182 .pet-life-fold > summary b { color:#a1a1aa; font-size:18px; transition:transform .2s ease; }
    .pet-world-page-v182 .pet-life-fold[open] > summary { background:rgba(168,85,247,.065); }
    .pet-world-page-v182 .pet-life-fold[open] > summary b { transform:rotate(180deg); color:#c084fc; }
    .pet-world-page-v182 .pet-life-fold > :not(summary) { padding:0 20px 20px; }
    .pet-world-page-v182 .pet-inventory-v17,
    .pet-world-page-v182 .pet-perks-v177,
    .pet-world-page-v182 .pet-life-actions-v17,
    .pet-world-page-v182 .pet-minigames-v17 { padding-top:14px; }
    .pet-world-page-v182 .pet-life-actions-v17 {
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
    }
    .pet-world-page-v182 .pet-life-actions-v17 .button { min-height:54px; }
    .pet-world-page-v182 .pet-shop-v17 { margin-top:12px; }
    .pet-world-page-v182 .pet-minigames-v17 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .pet-world-page-v182 .pet-mini-card-v17 {
      min-width:0;
      padding:16px;
      display:grid;
      grid-template-columns:auto minmax(0,1fr) auto;
      align-items:center;
      gap:12px;
      border:1px solid rgba(255,255,255,.08);
      border-radius:18px;
      background:rgba(255,255,255,.025);
    }
    .pet-world-page-v182 .pet-mini-card-v17 > span { font-size:25px; }
    .pet-world-page-v182 .pet-mini-card-v17 small { display:block; color:#a1a1aa; line-height:1.35; margin-top:3px; }
    .pet-world-page-v182 .pet-mini-card-v17 .button { width:auto; }

    /* Pet action grid: less cramped, more app-like */
    .pet-world-page-v182 .pet-actions-v17 { gap:10px; }
    .pet-world-page-v182 .pet-actions-v17 .pet-action-btn { min-height:66px; text-align:left; padding:14px 16px; }
    .pet-world-page-v182 .pet-actions-v17 .pet-action-btn small { display:block; margin-top:4px; color:#9f9aa8; font-size:11px; }

    /* ---------- Member directory: consistent profile portraits ---------- */
    .club-auth-page #member-directory-section img,
    .club-auth-page #member-friends-section img,
    .club-auth-page #club-friends img,
    .club-auth-page .member-directory img,
    .club-auth-page .member-list img,
    .club-auth-page .member-grid img {
      width:72px !important;
      height:72px !important;
      min-width:72px !important;
      min-height:72px !important;
      max-width:72px !important;
      max-height:72px !important;
      aspect-ratio:1 / 1 !important;
      object-fit:cover !important;
      object-position:center center !important;
      border-radius:50% !important;
      overflow:hidden !important;
      display:block !important;
      flex:0 0 72px !important;
      border:2px solid rgba(180,108,255,.28) !important;
      background:#17131f !important;
    }
    .club-auth-page #member-directory-section img[src=""],
    .club-auth-page #member-friends-section img[src=""] { display:none !important; }

    @media (max-width:700px) {
      .pet-world-page-v182 #pet-life-v182 { margin-top:16px; border-radius:22px; }
      .pet-world-page-v182 .pet-life-head-v17 { padding:18px 16px; align-items:flex-start; }
      .pet-world-page-v182 .pet-coins-v17 { padding:8px 11px; font-size:12px; }
      .pet-world-page-v182 .pet-life-head-v17 small { font-size:12px; }
      .pet-world-page-v182 .pet-life-fold > summary { min-height:58px; padding:14px 16px; }
      .pet-world-page-v182 .pet-life-fold > :not(summary) { padding:0 16px 16px; }
      .pet-world-page-v182 .pet-life-actions-v17 { grid-template-columns:1fr; }
      .pet-world-page-v182 .pet-minigames-v17 { grid-template-columns:1fr; }
      .pet-world-page-v182 .pet-mini-card-v17 { grid-template-columns:auto minmax(0,1fr); }
      .pet-world-page-v182 .pet-mini-card-v17 .button { grid-column:1 / -1; width:100%; }
      .club-auth-page #member-directory-section img,
      .club-auth-page #member-friends-section img,
      .club-auth-page #club-friends img,
      .club-auth-page .member-directory img,
      .club-auth-page .member-list img,
      .club-auth-page .member-grid img {
        width:60px !important;
        height:60px !important;
        min-width:60px !important;
        min-height:60px !important;
        max-width:60px !important;
        max-height:60px !important;
        flex-basis:60px !important;
      }
    }
  `;

  function init() {
    if (!document.getElementById('acy-v1863-polish-style')) {
      const style = document.createElement('style');
      style.id = 'acy-v1863-polish-style';
      style.textContent = css;
      document.head.appendChild(style);
    }

    const badge = document.getElementById('acy-dev-version-badge');
    if (badge) {
      badge.className = 'acy-v185-version';
      badge.innerHTML = '<i></i><span>' + VERSION + ' · DEV</span>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
