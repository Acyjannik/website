(() => {
  const PETS = {
    cat:'Katze', dog:'Hund', fox:'Fuchs', axolotl:'Axolotl', dragon:'Drache',
    unicorn:'Einhorn', penguin:'Pinguin', panda:'Panda', bunny:'Hase',
    koala:'Koala', hamster:'Hamster', turtle:'Schildkröte', owl:'Eule',
    frog:'Frosch', bee:'Biene'
  };

  // V19 RC8: club-profile.js expects this legacy upload control even on pet.html.
  // Create it before club-profile.js runs, not later inside DOMContentLoaded.
  function ensureAvatarInput(){
    if(document.getElementById('avatar-input')) return;
    const input=document.createElement('input');
    input.id='avatar-input';
    input.type='file';
    input.accept='image/jpeg,image/png,image/webp';
    input.hidden=true;
    (document.body||document.documentElement).appendChild(input);
  }

  function loadPetRc8Hotfix(){
    if(document.getElementById('acy-v19-pet-rc8-script')) return;
    const script=document.createElement('script');
    script.id='acy-v19-pet-rc8-script';
    script.src='/v19-pet-rc8-hotfix.js?v=19008';
    document.head.appendChild(script);
  }

  ensureAvatarInput();

  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function levelInfo(xp=0){
    if(xp>=1000)return {level:5,title:'ACY Legende',effect:'legendary'};
    if(xp>=500)return {level:4,title:'ACY Sidekick',effect:'crown'};
    if(xp>=250)return {level:3,title:'Treuer Gefährte',effect:'sparkle'};
    if(xp>=100)return {level:2,title:'Vertrauter Freund',effect:'glow'};
    return {level:1,title:'Kleiner Begleiter',effect:'basic'};
  }

  async function init(){
    ensureAvatarInput();
    loadPetRc8Hotfix();
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
      if(error || !pet) return;

      if(pet._died) return;
      const species=PETS[pet.species]||'Begleiter';
      const info=levelInfo(Number(pet.pet_xp||0));
      const image=`/assets/pet-${encodeURIComponent(pet.species)}.webp`;

      const el=document.createElement('a');
      el.className='acy-pet-float';
      el.href='/club-profile.html#pet-section';
      el.setAttribute('aria-label',`Dein Begleiter ${pet.name}`);
      el.innerHTML=`
        <span class="acy-pet-float-art pet-effect-${info.effect}"><img src="${image}" alt=""></span>
        <span class="acy-pet-float-copy">
          <small>DEIN BEGLEITER · LVL ${info.level}</small>
          <strong>${esc(pet.name)}</strong>
          <span>${esc(species)} · ${esc(info.title)}</span>
        </span>
      `;
      document.body.appendChild(el);
    }catch(e){console.debug('ACY pet companion unavailable',e);}
  }

  let sharedClientReady = false;
  window.addEventListener('acy:supabase-ready', () => {
    sharedClientReady = true;
    init();
  }, { once: true });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',() => {
      ensureAvatarInput();
      loadPetRc8Hotfix();
      if(!sharedClientReady) init();
    },{once:true});
  } else {
    ensureAvatarInput();
    loadPetRc8Hotfix();
    if(!window.__acySupabaseClient) init();
  }
})();
