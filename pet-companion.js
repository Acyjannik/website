(() => {
  const PETS = {
    cat:'Katze', dog:'Hund', fox:'Fuchs', axolotl:'Axolotl', dragon:'Drache',
    unicorn:'Einhorn', penguin:'Pinguin', panda:'Panda', bunny:'Hase',
    koala:'Koala', hamster:'Hamster', turtle:'Schildkröte', owl:'Eule',
    frog:'Frosch', bee:'Biene'
  };

  function ensureAvatarInput(){
    if(document.getElementById('avatar-input')) return;
    const input=document.createElement('input');
    input.id='avatar-input'; input.type='file'; input.accept='image/jpeg,image/png,image/webp'; input.hidden=true;
    (document.body||document.documentElement).appendChild(input);
  }

  function loadScriptOnce(id,src){
    if(document.getElementById(id)) return Promise.resolve();
    return new Promise(resolve=>{
      const script=document.createElement('script'); script.id=id; script.src=src; script.async=false;
      script.addEventListener('load',resolve,{once:true}); script.addEventListener('error',resolve,{once:true});
      document.head.appendChild(script);
    });
  }

  async function loadPetRc8Hotfix(){ await loadScriptOnce('acy-v19-pet-rc8-script','/v19-pet-rc8-hotfix.js?v=19008'); }
  async function loadPetInteractionFix(){
    if(!/\/(pet\.html|club-profile\.html)$/i.test(location.pathname)) return;
    await loadScriptOnce('acy-v19-pet-interaction-script','/v19-pet-interaction-fix.js?v=19131');
  }
  async function loadFinalUxFix(){ await loadScriptOnce('acy-v19-final-ux-script','/v19-rc12-final-fix.js?v=19131'); }

  async function loadPetInteractionThenLegacy(){
    await loadPetInteractionFix();
    await loadPetRc8Hotfix();
    await loadFinalUxFix();
  }

  ensureAvatarInput();

  function esc(v=''){return String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));}
  function levelInfo(xp=0){
    if(xp>=1000)return {level:5,title:'ACY Legende',effect:'legendary'};
    if(xp>=500)return {level:4,title:'ACY Sidekick',effect:'crown'};
    if(xp>=250)return {level:3,title:'Treuer Gefährte',effect:'sparkle'};
    if(xp>=100)return {level:2,title:'Vertrauter Freund',effect:'glow'};
    return {level:1,title:'Kleiner Begleiter',effect:'basic'};
  }

  async function init(){
    ensureAvatarInput();
    await loadPetInteractionThenLegacy();
    if(!window.supabase?.createClient) return;
    try{
      let client=window.__acySupabaseClient || null;
      if(!client){
        const cfg=await (await fetch('/api/config',{cache:'no-store'})).json();
        if(!cfg?.configured) return;
        client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      }
      const {data}=await client.auth.getSession();
      if(!data?.session?.user) return;
      const {data:pet,error}=await client.rpc('get_club_pet');
      if(error || !pet || pet._died) return;
      const species=PETS[pet.species]||'Begleiter';
      const info=levelInfo(Number(pet.pet_xp||0));
      const image=`/assets/pet-${encodeURIComponent(pet.species)}.webp`;
      const el=document.createElement('a');
      el.className='acy-pet-float'; el.href='/club-profile.html#pet-section'; el.setAttribute('aria-label',`Dein Begleiter ${pet.name}`);
      el.innerHTML=`<span class="acy-pet-float-art pet-effect-${info.effect}"><img src="${image}" alt=""></span><span class="acy-pet-float-copy"><small>DEIN BEGLEITER · LVL ${info.level}</small><strong>${esc(pet.name)}</strong><span>${esc(species)} · ${esc(info.title)}</span></span>`;
      document.body.appendChild(el);
    }catch(e){console.debug('ACY pet companion unavailable',e);}
  }

  window.addEventListener('acy:supabase-ready',()=>init(),{once:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
