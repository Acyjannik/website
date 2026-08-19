(() => {
  const VERSION = 'V18.5.3';
  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  const css = `
    :root{--acy-accent:#b46cff;--acy-accent-soft:rgba(180,108,255,.16);--acy-surface:rgba(18,17,25,.97);--acy-border:rgba(180,108,255,.24)}
    .acy-v185-version{position:fixed;top:max(9px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:12000;display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border:1px solid rgba(180,108,255,.42);border-radius:999px;background:rgba(11,11,16,.92);backdrop-filter:blur(18px);color:#f7f3ff;font:700 13px/1 system-ui,sans-serif;letter-spacing:.05em;box-shadow:0 8px 30px rgba(0,0,0,.28);pointer-events:none;white-space:nowrap}
    .acy-v185-version i{width:7px;height:7px;border-radius:50%;background:var(--acy-accent);box-shadow:0 0 12px rgba(180,108,255,.8)}
    .mobile-club-dock{z-index:11000!important;touch-action:manipulation}
    .mobile-club-dock [data-dock-key]{position:relative;min-width:0!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;transition:background .18s ease,border-color .18s ease,transform .12s ease,box-shadow .18s ease!important}
    .mobile-club-dock [data-dock-key]:active{transform:scale(.97)!important}
    .mobile-club-dock [data-dock-key] > span:not(.dock-icon):not(.dock-badge){font-size:14px!important;line-height:1.15!important;font-weight:700!important;letter-spacing:.01em!important}
    .mobile-club-dock [data-dock-key].is-active{background:linear-gradient(180deg,rgba(180,108,255,.24),rgba(180,108,255,.11))!important;border-color:rgba(180,108,255,.48)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 24px rgba(89,40,140,.14)!important}
    #mobile-more-sheet-v181{z-index:11500!important;border:1px solid var(--acy-border)!important;background:rgba(13,12,19,.98)!important;backdrop-filter:blur(26px)!important;box-shadow:0 -18px 60px rgba(0,0,0,.48)!important}
    #mobile-more-sheet-v181 a,#mobile-more-sheet-v181 button{touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    #mobile-more-sheet-v181 a:active,#mobile-more-sheet-v181 button:active{transform:scale(.985)}
    body.mobile-more-open-v181{overflow:hidden}
    body.mobile-more-open-v181:before{content:"";position:fixed;inset:0;background:rgba(0,0,0,.46);backdrop-filter:blur(2px);z-index:11490;pointer-events:none}
    #mobile-more-sheet-v181[hidden]{display:none!important}
    .club-auth-page .member-fold,.club-auth-page .member-card{scroll-margin-top:100px}
    .club-auth-page .member-fold-summary{font-size:16px!important;line-height:1.2!important}
    .club-auth-page .member-fold-summary strong,.club-auth-page .member-card h2,.club-auth-page .member-card h3{line-height:1.15!important}
    .club-auth-page .member-fold-body{scroll-margin-top:100px}
    .acy-wheel-card{overflow:hidden!important;min-height:0!important;height:auto!important;margin-bottom:10px!important}
    .acy-wheel-card .member-fold-summary{min-height:64px!important}
    .acy-wheel-card .member-fold-body{padding-top:12px!important;padding-bottom:12px!important}
    .acy-wheel-card .member-fold-summary-main{min-width:0!important}
    .acy-wheel-card .member-fold-summary-main strong{font-size:clamp(20px,4.6vw,28px)!important}
    @media(max-width:700px){
      .acy-v185-version{top:max(8px,env(safe-area-inset-top));font-size:12px;padding:6px 11px}
      .club-auth-page{padding-bottom:110px!important}
      .club-auth-page .member-dashboard{gap:10px!important;min-height:0!important}
      .club-auth-page .member-card,.club-auth-page .member-fold{margin-bottom:10px!important}
      .club-auth-page .member-fold-summary{min-height:62px!important;padding:12px 14px!important}
      .club-auth-page .member-fold-body{padding:12px 14px!important}
      .acy-wheel-card .member-fold-summary{min-height:62px!important;padding:9px 12px!important}
      .mobile-club-dock{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;padding:8px!important}
      .mobile-club-dock [data-dock-key]{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;min-height:58px!important;border-radius:18px!important}
      .mobile-club-dock [data-dock-key] .dock-icon{font-size:24px!important;line-height:1!important}
      #mobile-more-sheet-v181{left:10px!important;right:10px!important;bottom:calc(84px + env(safe-area-inset-bottom))!important;max-height:72dvh!important;overflow:auto!important;border-radius:26px!important;padding:10px!important}
    }
    @media(min-width:701px){
      .club-auth-page .member-dashboard{min-height:0!important}
      .mobile-club-dock{display:grid!important;grid-template-columns:repeat(5,minmax(112px,1fr))!important;gap:6px!important;position:fixed!important;left:50%!important;bottom:18px!important;transform:translateX(-50%)!important;width:min(720px,calc(100vw - 48px))!important;padding:8px!important;border:1px solid rgba(180,108,255,.22)!important;border-radius:24px!important;background:rgba(13,12,19,.94)!important;backdrop-filter:blur(24px)!important;box-shadow:0 18px 60px rgba(0,0,0,.4)!important}
      .mobile-club-dock [data-dock-key]{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:9px!important;min-height:54px!important;border:1px solid transparent!important;border-radius:17px!important}
      .mobile-club-dock [data-dock-key] .dock-icon{font-size:20px!important;line-height:1!important}
      #mobile-more-sheet-v181{left:50%!important;right:auto!important;bottom:94px!important;transform:translateX(-50%)!important;width:min(560px,calc(100vw - 48px))!important;max-height:70vh!important;overflow:auto!important;border-radius:26px!important;padding:12px!important}
    }
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
    if(!badge){badge=document.createElement('div');badge.id='acy-dev-version-badge';document.body.appendChild(badge)}
    badge.className='acy-v185-version';
    badge.innerHTML='<i aria-hidden="true"></i><span>'+VERSION+' · DEV</span>';
  }

  function setActive(key){
    document.querySelectorAll('.mobile-club-dock [data-dock-key]').forEach(item=>{
      const active=item.dataset.dockKey===key;
      item.classList.toggle('is-active',active);
      if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    });
  }

  function closeMore(){
    const sheet=document.getElementById('mobile-more-sheet-v181');
    const toggle=document.getElementById('mobile-dock-more-v18');
    if(sheet)sheet.hidden=true;
    document.body.classList.remove('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded','false');
  }

  function openMore(){
    const sheet=document.getElementById('mobile-more-sheet-v181');
    const toggle=document.getElementById('mobile-dock-more-v18');
    if(!sheet)return false;
    sheet.hidden=false;
    document.body.classList.add('mobile-more-open-v181');
    toggle?.setAttribute('aria-expanded','true');
    return true;
  }

  function isVisibleTarget(el){return !!el&&!el.closest('[hidden]')&&el.getClientRects().length>0}

  function findByText(pattern){
    const candidates=[...document.querySelectorAll('details.member-card,details.member-fold,.member-card,.member-fold,section')];
    return candidates.find(el=>pattern.test((el.querySelector('summary')?.textContent||el.textContent||'').trim())&&isVisibleTarget(el))||null;
  }

  function targetFor(key){
    const ids={
      home:['#acy-v18-home','#member-spotlight','#member-hub'],
      quests:['#club-quests-section','#member-badges-section','#club-rewards-section','#daily-section','#club-daily-section'],
      social:['#social-connections-section','#club-messages','#club-chat','#member-directory-section','#member-friends-section','#club-friends']
    };
    for(const id of(ids[key]||[])){const el=document.querySelector(id);if(isVisibleTarget(el))return el}
    if(key==='social')return findByText(/Nachrichten|Direktnachrichten|Chat|Freunde|Mitglieder/i);
    if(key==='quests')return findByText(/Quests|Daily|Rewards|Belohnungen|Badges|Glücksrad/i);
    return null;
  }

  function scrollToTarget(target){
    if(!target)return false;
    const details=target.closest('details');
    if(details)details.open=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const offset=window.matchMedia('(max-width:700px)').matches?104:92;
      const rect=target.getBoundingClientRect();
      const y=Math.max(0,window.scrollY+rect.top-offset);
      window.scrollTo({top:y,behavior:'smooth'});
    }));
    return true;
  }

  function markWheelCard(){
    const hit=[...document.querySelectorAll('body *')].find(el=>el.children.length<8&&/ACY\s+Glücksrad/i.test(el.textContent||''));
    const card=hit?.closest('details.member-card,details.member-fold,.member-card,.member-fold');
    if(card)card.classList.add('acy-wheel-card');
  }

  function normalizeDock(){
    const dock=document.querySelector('.mobile-club-dock');
    if(!dock)return false;
    const labels={home:'Home',pet:'Pet',quests:'Quests',social:'Social',more:'Mehr'};
    dock.querySelectorAll('[data-dock-key]').forEach(item=>{
      const key=item.dataset.dockKey;
      item.setAttribute('aria-label',labels[key]||key||'Navigation');
      item.setAttribute('role','button');
      item.removeAttribute('href');
      item.removeAttribute('target');
      item.removeAttribute('download');
      if(key==='more')item.setAttribute('aria-haspopup','dialog');
    });
    return true;
  }

  function removeLegacyBuildBadge(){
    document.querySelectorAll('body *').forEach(el=>{if(el.children.length===0&&/ACY\s+BUILD\s+V18\.1/i.test(el.textContent||''))el.remove()});
  }

  function navigate(key){
    if(key==='pet'){setActive('pet');window.location.assign('/pet.html');return}
    if(key==='more'){setActive('');openMore();return}
    const target=targetFor(key);
    closeMore();
    if(!target){setActive('');return}
    setActive(key);scrollToTarget(target);
  }

  function interceptDock(){
    document.addEventListener('click',(event)=>{
      const item=event.target.closest('.mobile-club-dock [data-dock-key]');
      if(!item)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(item.dataset.dockKey);
    },true);
  }

  function interceptMore(){
    document.addEventListener('click',(event)=>{
      const toggle=event.target.closest('#mobile-dock-more-v18');
      if(toggle){
        event.preventDefault();event.stopImmediatePropagation();
        if(document.getElementById('mobile-more-sheet-v181')?.hidden)openMore();else closeMore();
        return;
      }
      const sheet=event.target.closest('#mobile-more-sheet-v181');
      if(!sheet)return;
      if(event.target.closest('[data-close-more]')){event.preventDefault();event.stopImmediatePropagation();closeMore();return}
      const notification=event.target.closest('[data-open-notifications-v181]');
      if(notification){event.preventDefault();event.stopImmediatePropagation();closeMore();document.getElementById('notification-bell')?.click();return}
      const link=event.target.closest('a[href]');
      if(!link)return;
      const href=link.getAttribute('href')||'';
      if(!href.startsWith('#'))return;
      const target=document.querySelector(href);
      if(!target)return;
      event.preventDefault();event.stopImmediatePropagation();
      const details=target.closest('details');if(details)details.open=true;
      closeMore();
      const context=/quest|reward|badge|daily|progress|wheel/i.test(href)?'quests':/social|message|chat|directory|friend|member/i.test(href)?'social':'';
      if(context)setActive(context);
      scrollToTarget(target);
    },true);
  }

  function init(){
    injectStyles();installVersion();normalizeDock();removeLegacyBuildBadge();markWheelCard();
    interceptDock();interceptMore();
    const observer=new MutationObserver(()=>{normalizeDock();removeLegacyBuildBadge();markWheelCard()});
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  ready(init);
})();
