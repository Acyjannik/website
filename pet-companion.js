(() => {
  const PETS = {
    cat:'Katze', dog:'Hund', fox:'Fuchs', axolotl:'Axolotl', dragon:'Drache',
    unicorn:'Einhorn', penguin:'Pinguin', panda:'Panda', bunny:'Hase',
    koala:'Koala', hamster:'Hamster', turtle:'Schildkröte', owl:'Eule',
    frog:'Frosch', bee:'Biene'
  };

  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function levelInfo(xp=0){
    const levels=[
      [0,1,'Kleiner Begleiter','basic'],[100,2,'Vertrauter Freund','glow'],[250,3,'Treuer Gefährte','sparkle'],[500,4,'ACY Sidekick','crown'],[1000,5,'ACY Legende','legendary'],
      [1750,6,'ACY Champion','aurora'],[2750,7,'ACY Guardian','celestial'],[4250,8,'ACY Mythic','mythic'],[6500,9,'ACY Cosmic','cosmic'],[10000,10,'ACY Overlord','overlord'],
      [12300,11,'ACY Ascended','overlord'],[14900,12,'ACY Celestial','overlord'],[17700,13,'ACY Eternal','overlord'],[20700,14,'ACY Guardian Prime','overlord'],[23900,15,'ACY Champion Prime','overlord'],
      [27300,16,'ACY Legendary','overlord'],[30900,17,'ACY Mythic Prime','overlord'],[34700,18,'ACY Cosmic Prime','overlord'],[38700,19,'ACY Overlord Prime','overlord'],[42900,20,'ACY Pet Master','overlord'],
      [47300,21,'ACY Master+','overlord'],[51900,22,'ACY Legend+','overlord'],[56700,23,'ACY Grandmaster','overlord'],[61700,24,'ACY Divine','overlord'],[66900,25,'ACY Pet Master','overlord']
    ];
    let current=levels[0]; for(const entry of levels) if(xp>=entry[0]) current=entry;
    return {level:current[1],title:current[2],effect:current[3]};
  }

  async function init(){
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
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',() => { if(!sharedClientReady) init(); },{once:true});
  else if(!window.__acySupabaseClient) init();
})();