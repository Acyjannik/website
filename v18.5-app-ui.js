(() => {
  const VERSION = 'V18.5.0';
  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  const css = `
    :root{--acy-accent:#b46cff;--acy-accent-soft:rgba(180,108,255,.16);--acy-surface:rgba(18,17,25,.96);--acy-border:rgba(180,108,255,.24)}
    .acy-v185-version{position:fixed;top:max(9px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12000;display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border:1px solid rgba(180,108,255,.42);border-radius:999px;background:rgba(11,11,16,.92);backdrop-filter:blur(18px);color:#f7f3ff;font:700 13px/1 system-ui,sans-serif;letter-spacing:.05em;box-shadow:0 8px 30px rgba(0,0,0,.28);pointer-events:none;white-space:nowrap}
    .acy-v185-version i{width:7px;height:7px;border-radius:50%;background:var(--acy-accent);box-shadow:0 0 12px rgba(180,108,255,.8)}
    .mobile-club-dock{z-index:11000!important;touch-action:manipulation}
    .mobile-club-dock [data-dock-key]{position:relative;min-width:0!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;transition:background .18s ease,border-color .18s ease,transform .12s ease,box-shadow .18s ease!important}
    .mobile-club-dock [data-dock-key]:active{transform:scale(.97)!important}
    .mobile-club-dock [data-dock-key] .dock-label,.mobile-club-dock [data-dock-key] .label,.mobile-club-dock [data-dock-key] span{font-size:14px!important;line-height:1.15!important;font-weight:700!important;letter-spacing:.01em!important}
    .mobile-club-dock [data-dock-key].is-active{background:linear-gradient(180deg,rgba(180,108,255,.24),rgba(180,108,255,.11))!important;border-color:rgba(180,108,255,.48)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 24px rgba(89,40,140,.14)!important}
    #mobile-more-sheet-v181{z-index:11500!important;border:1px solid var(--acy-border)!important;background:rgba(13,12,19,.98)!important;backdrop-filter:blur(26px)!important;box-shadow:0 -18px 60px rgba(0,0,0,.48)!important}
    #mobile-more-sheet-v181 a,#mobile-more-sheet-v181 button{touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    #mobile-more-sheet-v181 a:active,#mobile-more-sheet-v181 button:active{transform:scale(.985)}
    body.mobile-more-open-v181{overflow:hidden}
    body.mobile-more-open-v181:before{content:"";position:fixed;inset:0;background:rgba(0,0,0,.46);backdrop-filter:blur(2px);z-index:11490;pointer-events:none}
    .club-auth-page .member-fold,.club-auth-page .member-card{scroll-margin-top:100px}
    .club-auth-page .member-fold-summary{font-size:16px!important;line-height:1.2!important}
    .club-auth-page .member-fold-summary strong,.club-auth-page .member-card h2,.club-auth-page .member-card h3{line-height:1.15!important}
    .club-auth-page .member-fold-body{scroll-margin-top:100px}
    @media(max-width:700px){
      .acy-v185-version{top:max(8px,env(safe-area-inset-top));font-size:12px;padding:6px 11px}
      .club-auth-page{padding-bottom:110px!important}
      .club-auth-page .member-dashboard{gap:10px!important}
      .club-auth-page .member-card,.club-auth-page .member-fold{margin-bottom:10px!important}
      .club-auth-page .member-fold-summary{min-height:62px!important;padding:12px 14px!important}
      .club-auth-page .member-fold-body{padding:12px 14px!important}
      .mobile-club-dock{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;padding:8px!important}
      .mobile-club-dock [data-dock-key]{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;min-height:58px!important;border-radius:18px!important}
      .mobile-club-dock [data-dock-key] svg,.mobile-club-dock [data-dock-key] img{width:24px!important;height:24px!important;object-fit:contain!important}
      #mobile-more-sheet-v181{left:10px!important;right:10px!important;bottom:calc(84px + env(safe-area-inset-bottom))!important;max-height:72dvh!important;overflow:auto!important;border-radius:26px!important;padding:10px!important}
    }
    @media(min-width:701px){
      .mobile-club-dock{display:grid!important;grid-template-columns:repeat(5,minmax(112px,1fr))!important;gap:6px!important;position:fixed!important;left:50%!important;bottom:18px!important;transform:translateX(-50%)!important;width:min(720px,calc(100vw - 48px))!important;padding:8px!important;border:1px solid rgba(180,108,255,.22)!important;border-radius:24px!important;background:rgba(13,12,19,.94)!important;backdrop-filter:blur(24px)!important;box-shadow:0 18px 60px rgba(0,0,0,.4)!important}
      .mobile-club-dock [data-dock-key]{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:9px!important;min-height:54px!important;border:1px solid transparent!important;border-radius:17px!important}
      .mobile-club-dock [data-dock-key] .dock-label,.mobile-club-dock [data-dock-key] .label,.mobile-club-dock [data-dock-key] span{font-size:14px!important}
      #mobile-more-sheet-v181{left:50%!important;right:auto!important;bottom:94px!important;transform:translateX(-50%)!important;width:min(560px,calc(100vw - 48px))!important;max-height:70vh!important;overflow:auto!important;border-radius:26px!important;padding:12px!important}
    }
    @media(prefers-reduced-motion:reduce){.mobile-club-dock [data-dock-key],#mobile-more-sheet-v181{transition:none!important}.mobile-club-dock [data-dock-key]:active{transform:none!important}}
  `;

  function injectStyles(){
    if(document.getElementById('acy-v185-ui-style')) return;
    const style=document.createElement('style');
    style.id='acy-v185-ui-style';
    style.textContent=css;
    document.head.appendChild(style);
  }

  function installVersion(){
    let badge=document.getElementById('acy-dev-version-badge');
    if(!badge){
      badge=document.createElement('div');
      badge.id='acy-dev-version-badge';
      document.body.appendChild(badge);
    }
    badge.className='acy-v185-version';
    badge.innerHTML='<i aria-hidden="true"></i><span>'+VERSION+' · DEV</span>';
  }

  function closeMore(){
    const sheet=document.getElementById('mobile-more-sheet-v181');
    const toggle=document.getElementById('mobile-dock-more-v18');
    if(sheet) sheet.hidden=true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded','false');
  }

  function enhanceMoreLinks(){
    document.addEventListener('click',(event)=>{
      const link=event.target.closest('#mobile-more-sheet-v181 a[href^="#"]');
      if(!link) return;
      const href=link.getAttribute('href');
      const target=href ? document.querySelector(href) : null;
      if(!target) return;
      closeMore();
      requestAnimationFrame(()=>{
        const details=target.closest('details');
        if(details) details.open=true;
        const top=Math.max(0,window.scrollY+target.getBoundingClientRect().top-92);
        window.scrollTo({top,behavior:'smooth'});
      });
    },false);
  }

  function normalizeDock(){
    const dock=document.querySelector('.mobile-club-dock');
    if(!dock) return false;
    const labels={home:'Home',pet:'Pet',quests:'Quests',social:'Social',more:'Mehr'};
    dock.querySelectorAll('[data-dock-key]').forEach(item=>{
      const key=item.dataset.dockKey;
      item.setAttribute('aria-label',labels[key]||key||'Navigation');
      if(key==='more') item.setAttribute('aria-haspopup','dialog');
    });
    return true;
  }

  function init(){
    injectStyles();
    installVersion();
    normalizeDock();
    enhanceMoreLinks();
    const observer=new MutationObserver(()=>{normalizeDock();});
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  ready(init);
})();
