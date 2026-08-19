(() => {
  'use strict';
  const ready = fn => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  let rewardBusy = false;

  function client(){ return window.__acySupabaseClient || null; }
  function petStatus(message, type='success'){
    const el=document.getElementById('pet-life-status') || document.getElementById('pet-status');
    if(!el)return;
    el.textContent=message;
    el.className=`club-auth-status ${type}`.trim();
  }
  function rewardEffect(message){
    petStatus(message,'success');
    try{ window.triggerClubEffect?.('reward',message); }catch{}
  }
  function unhidePetViews(){
    const section=document.getElementById('pet-section');
    if(section?.hasAttribute('data-pet-view')) section.removeAttribute('data-pet-view');
  }
  function setDetailsOpen(element,open){
    const details=element?.closest?.('details');
    if(details) details.open=Boolean(open);
    return details;
  }
  async function hub(){
    const sb=client();
    if(!sb) throw new Error('Pet-System wird noch geladen.');
    const {data,error}=await sb.rpc('get_pet_life_hub');
    if(error) throw error;
    if(typeof window.renderPetLife==='function') window.renderPetLife(data||{});
    return data||{};
  }
  function escapeHtmlSafe(value){
    const div=document.createElement('div'); div.textContent=String(value??''); return div.innerHTML;
  }
  function escapeAttrSafe(value){ return escapeHtmlSafe(value).replace(/"/g,'&quot;'); }
  function renderShop(hubData){
    const box=document.getElementById('pet-shop');
    const button=document.getElementById('pet-shop-open');
    const shop=Array.isArray(hubData?.shop)?hubData.shop:[];
    if(!box||!button)return;
    box.innerHTML=shop.length
      ? shop.map(i=>`<div class="pet-shop-item-v177"><span class="pet-shop-icon-v177">${escapeHtmlSafe(i.icon)}</span><div><strong>${escapeHtmlSafe(i.name)}</strong><small>${escapeHtmlSafe(i.detail)}</small><em>${Number(i.cost)||0} AC Coins</em></div><button class="button button-small button-secondary" type="button" data-buy-pet="${escapeAttrSafe(i.key)}">Kaufen</button></div>`).join('')
      : '<div class="club-content-empty">Shop konnte gerade nicht geladen werden.</div>';
    box.hidden=false;
    button.disabled=false;
    button.setAttribute('aria-expanded','true');
    button.textContent=shop.length?'⌃ Pet-Shop schließen':'⚠️ Pet-Shop leer';
  }
  async function refreshPetData(){
    try{
      const d=await hub();
      const box=document.getElementById('pet-shop');
      if(box && !box.hidden) renderShop(d);
      return d;
    }catch(error){ console.warn('Pet refresh failed:',error); return null; }
  }
  async function handleShop(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    unhidePetViews();
    const button=document.getElementById('pet-shop-open');
    const box=document.getElementById('pet-shop');
    if(!button||!box)return;
    if(!box.hidden){
      box.hidden=true;
      button.setAttribute('aria-expanded','false');
      const count=box.querySelectorAll('[data-buy-pet]').length;
      button.textContent=`🛍️ Pet-Shop · ${count} Artikel`;
      return;
    }
    button.disabled=true;
    button.textContent='🛍️ Shop wird geladen…';
    try{
      const d=await hub();
      renderShop(d);
      const details=setDetailsOpen(button,true);
      if(details) details.open=true;
      box.scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(error){
      button.disabled=false;
      button.textContent='🛍️ Pet-Shop';
      petStatus(error?.message||'Pet-Shop konnte nicht geladen werden.','error');
    }
  }
  async function handleBuy(event){
    const button=event.target.closest('#pet-shop [data-buy-pet]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const sb=client();
    if(!sb){petStatus('Pet-System wird noch geladen.','error');return;}
    button.disabled=true;
    try{
      const key=button.dataset.buyPet;
      const {data,error}=await sb.rpc('buy_pet_item',{p_item_key:key});
      if(error)throw error;
      const label=data?.message || data?.reward_label || `${key} gekauft. 🛍️`;
      rewardEffect(`🛍️ ${label}`);
      if(typeof window.renderPetLife==='function') window.renderPetLife(data?.hub||data||{});
      if(data?.hub) renderShop(data.hub);
      else await refreshPetData();
    }catch(error){
      button.disabled=false;
      petStatus(error?.message||'Kauf konnte nicht abgeschlossen werden.','error');
    }
  }
  async function quickGame(game){
    if(rewardBusy)return null;
    const sb=client();
    if(!sb){petStatus('Pet-System wird noch geladen.','error');return null;}
    rewardBusy=true;
    try{
      const {data,error}=await sb.rpc('play_pet_minigame',{p_game:game});
      if(error)throw error;
      if(typeof window.progressQuestsForAction==='function') void window.progressQuestsForAction('pet_minigame');
      if(data?.reward_label) rewardEffect(`🎁 ${data.reward_label}`);
      else rewardEffect('🎁 Spiel geschafft!');
      if(data?.hub && typeof window.renderPetLife==='function') window.renderPetLife(data.hub);
      setTimeout(()=>refreshPetData(),0);
      return data;
    }catch(error){
      petStatus(error?.message||'Spiel konnte nicht ausgeführt werden.','error');
      throw error;
    }finally{ rewardBusy=false; }
  }
  function patchMiniGame(){
    if(typeof window.finishPetMiniGame!=='function' || window.finishPetMiniGame.__acyRc8Immediate)return;
    const original=window.finishPetMiniGame;
    const immediate=async(game)=>quickGame(game);
    immediate.__acyRc8Immediate=true;
    immediate.__acyRc8Original=original;
    window.finishPetMiniGame=immediate;
  }
  async function handleMystery(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    unhidePetViews();
    const button=document.getElementById('pet-mystery-box');
    if(!button)return;
    if(button.disabled){
      petStatus('Du hast aktuell keine Mystery Box.','');
      setDetailsOpen(button,true);
      return;
    }
    const sb=client();
    if(!sb){petStatus('Pet-System wird noch geladen.','error');return;}
    button.disabled=true;
    try{
      const {data,error}=await sb.rpc('open_pet_mystery_box',{});
      if(error)throw error;
      if(data?.reward_label) rewardEffect(`🎁 ${data.reward_label}`);
      else rewardEffect('🎁 Mystery Box geöffnet!');
      if(data?.hub && typeof window.renderPetLife==='function') window.renderPetLife(data.hub);
      setTimeout(()=>refreshPetData(),0);
    }catch(error){
      petStatus(error?.message||'Mystery Box konnte nicht geöffnet werden.','error');
    }finally{button.disabled=false;}
  }
  function injectStyles(){
    if(document.getElementById('acy-v19-pet-rc8-style'))return;
    const style=document.createElement('style');
    style.id='acy-v19-pet-rc8-style';
    style.textContent=`
      #pet-section[data-pet-view]{display:block!important}
      #pet-section[data-pet-view] .pet-main,#pet-section[data-pet-view] .pet-progression,#pet-section[data-pet-view] .pet-stats,#pet-section[data-pet-view] .pet-actions-v17,#pet-section[data-pet-view] .pet-life-panel-v17,#pet-section[data-pet-view] #pet-archive-panel{display:initial!important}
      #member-leaderboard-list img{width:52px!important;height:52px!important;max-width:52px!important;max-height:52px!important;border-radius:50%!important;object-fit:cover!important;object-position:center!important;flex:none!important}
      @media(max-width:700px){
        #pet-life-v182 .pet-mobile-fold{min-width:0!important;max-width:100%!important}
        #pet-life-v182 .pet-mobile-fold>summary{min-width:0!important;gap:10px!important}
        #pet-shop{min-width:0!important;max-width:100%!important;overflow:auto!important}
      }
    `;
    document.head.appendChild(style);
  }
  function bind(){
    injectStyles();
    unhidePetViews();
    patchMiniGame();
    if(!window.__acyPetRc8Bound){
      window.__acyPetRc8Bound=true;
      document.addEventListener('click',event=>{
        const shop=event.target.closest('#pet-shop-open');
        if(shop){ void handleShop(event); return; }
        const buy=event.target.closest('#pet-shop [data-buy-pet]');
        if(buy){ void handleBuy(event); return; }
        const mystery=event.target.closest('#pet-mystery-box');
        if(mystery){ void handleMystery(event); return; }
      },true);
    }
  }
  function init(){
    bind();
    [100,500,1200,2500].forEach(ms=>setTimeout(bind,ms));
    const observer=new MutationObserver(()=>{unhidePetViews();patchMiniGame();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  ready(init);
})();
