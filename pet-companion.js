(() => {
  const PETS = {
    cat:'Katze', dog:'Hund', fox:'Fuchs', axolotl:'Axolotl', dragon:'Drache',
    unicorn:'Einhorn', penguin:'Pinguin', panda:'Panda', bunny:'Hase',
    koala:'Koala', hamster:'Hamster', turtle:'Schildkröte', owl:'Eule',
    frog:'Frosch', bee:'Biene'
  };

  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function level(xp=0){return xp>=1000?5:xp>=500?4:xp>=250?3:xp>=100?2:1;}

  async function init(){
    if(!window.supabase?.createClient) return;
    try{
      const cfg=await (await fetch('/api/config',{cache:'no-store'})).json();
      if(!cfg?.configured) return;
      const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const {data}=await client.auth.getSession();
      if(!data?.session?.user) return;

      const {data:pet,error}=await client.rpc('get_club_pet');
      if(error || !pet) return;

      const species=PETS[pet.species]||'Begleiter';
      const levelNo=level(Number(pet.pet_xp||0));
      const image=`/assets/pet-${encodeURIComponent(pet.species)}.webp`;

      const el=document.createElement('a');
      el.className='acy-pet-float';
      el.href='/club-profile.html#pet-section';
      el.setAttribute('aria-label',`Dein Begleiter ${pet.name}`);
      el.innerHTML=`
        <span class="acy-pet-float-art"><img src="${image}" alt=""></span>
        <span class="acy-pet-float-copy">
          <small>DEIN BEGLEITER</small>
          <strong>${esc(pet.name)}</strong>
          <span>${esc(species)} · Level ${levelNo}</span>
        </span>
      `;
      document.body.appendChild(el);
    }catch(e){console.debug('ACY pet companion unavailable',e);}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();