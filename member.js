let supabaseClient=null;
const $=id=>document.getElementById(id);

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function levelForXp(xp){
  const levels=[
    {min:0,title:'ACY Rookie'},
    {min:100,title:'ACY Member'},
    {min:250,title:'ACY Regular'},
    {min:500,title:'ACY OG'},
    {min:1000,title:'ACY Legend'}
  ];
  return levels.reduce((current,level)=>xp>=level.min?level:current,levels[0]);
}

function petSocialLevel(xp=0){
  const levels=[0,25,75,150,300];
  let level=1;
  for(let i=0;i<levels.length;i++)if(xp>=levels[i])level=i+1;
  return level;
}
function petLabel(species=''){
  return ({cat:'Katze',dog:'Hund',fox:'Fuchs',axolotl:'Axolotl',dragon:'Drache',unicorn:'Einhorn',penguin:'Pinguin',panda:'Panda',bunny:'Hase',koala:'Koala',hamster:'Hamster',turtle:'Schildkröte',owl:'Eule',frog:'Frosch',bee:'Biene'})[species]||'Begleiter';
}


async function loadPetDuoAchievements(memberId, ownId){
  const grid=$('public-pet-duo-grid');
  const count=$('public-pet-duo-count');
  const subtitle=$('public-pet-duo-subtitle');
  if(!grid)return;
  if(memberId!==ownId){
    grid.innerHTML='<div class="public-pet-friends-empty">Duo-Achievements werden nur im eigenen Club-Profil angezeigt.</div>';
    return;
  }
  try{
    const {data:sessionData}=await supabaseClient.auth.getSession();
    const token=sessionData?.session?.access_token;
    const response=await fetch('/api/club-pet-duo-achievements',{
      method:'POST',
      headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:'{}'
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Duo-Achievements konnten nicht geladen werden.');
    const rows=Array.isArray(payload.achievements)?payload.achievements:[];
    if(count)count.textContent=String(rows.length);
    if(subtitle)subtitle.textContent=rows.length?`${rows.length} gemeinsame Auszeichnung${rows.length===1?'':'en'}.`:'Noch keine Duo-Achievements.';
    if(!rows.length){
      grid.innerHTML='<div class="public-pet-friends-empty">Sobald deine Pets miteinander aktiv sind, kommen hier besondere Auszeichnungen dazu.</div>';
      return;
    }
    const meta={
      pet_first_friend:{icon:'👋',title:'Erste Freundschaft',detail:'Das erste gemeinsame Treffen.'},
      pet_buddy:{icon:'💜',title:'Pet Buddies',detail:'Mindestens 5 gemeinsame Begegnungen.'},
      pet_best_friends:{icon:'👑',title:'Beste Freunde',detail:'15 gemeinsame Begegnungen.'}
    };
    grid.innerHTML=rows.slice(0,18).map(row=>{
      const m=meta[row.achievement_key]||{icon:'🐾',title:row.achievement_key,detail:'Pet Duo Achievement'};
      return `<article class="pet-duo-achievement">
        <span class="pet-duo-achievement-icon">${m.icon}</span>
        <div><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.detail)}</small><small>Mit ${escapeHtml(row.friend_pet_name||row.friend_display_name||'einem Pet')}</small></div>
      </article>`;
    }).join('');
  }catch(error){
    grid.innerHTML=`<div class="public-pet-friends-empty">${escapeHtml(error?.message||'Duo-Achievements konnten nicht geladen werden.')}</div>`;
  }
}

async function loadPetFriendshipsForMember(memberId, ownId){
  const grid=$('public-pet-friends-grid');
  const count=$('public-pet-friends-count');
  const subtitle=$('public-pet-friends-subtitle');
  if(!grid)return;

  // Friendship details are private to the member owner for now.
  if(memberId!==ownId){
    grid.innerHTML='<div class="public-pet-friends-empty">Pet-Freundschaften werden nur im eigenen Club-Profil angezeigt.</div>';
    return;
  }

  try{
    const {data:sessionData}=await supabaseClient.auth.getSession();
    const token=sessionData?.session?.access_token;
    const response=await fetch('/api/club-pet-social',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:JSON.stringify({action:'get_friendships'})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Freundschaften konnten nicht geladen werden.');
    const friends=Array.isArray(payload.friendships)?payload.friendships:[];
    if(count)count.textContent=String(friends.length);
    if(subtitle)subtitle.textContent=friends.length?`${friends.length} tierische Bekanntschaft${friends.length===1?'':'en'}.`:'Noch keine Pet-Freundschaften.';
    if(!friends.length){
      grid.innerHTML='<div class="public-pet-friends-empty">Noch keine Freundschaften. Jede Begegnung zählt.</div>';
      return;
    }
    const labels={1:'Bekannt',2:'Freunde',3:'Beste Freunde'};
    const icons={1:'🐾',2:'💜',3:'👑'};
    grid.innerHTML=friends.slice(0,12).map(friend=>{
      const pet=friend.pet;
      const petImg=pet?`<img src="assets/pet-${escapeHtml(pet.species)}.webp" alt="">`:'<span class="pet-friends-no-pet">🐾</span>';
      return `<button class="pet-friend-card" type="button" data-friend-id="${escapeHtml(friend.user_id)}">
        <span class="pet-friend-art">${petImg}</span>
        <span class="pet-friend-main"><strong>${escapeHtml(pet?.name||friend.display_name)}</strong><small>${icons[friend.friendship_level]||'🐾'} ${labels[friend.friendship_level]||'Bekannt'} · ${friend.interaction_count} Begegnungen</small><small>@${escapeHtml(friend.username||'')}</small></span>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-friend-id]').forEach(btn=>{
      btn.addEventListener('click',()=>window.location.href=`/member.html?id=${encodeURIComponent(btn.dataset.friendId)}#pet-social`);
    });
  }catch(error){
    grid.innerHTML=`<div class="public-pet-friends-empty">${escapeHtml(error?.message||'Freundschaften konnten nicht geladen werden.')}</div>`;
  }
}

function renderMemberPet(pet,targetId,ownId){
  const empty=$('public-pet-empty'),active=$('public-pet-active'),actions=$('public-pet-actions');
  if(!empty||!active)return;
  if(!pet){
    empty.hidden=false; active.hidden=true; return;
  }
  empty.hidden=true; active.hidden=false;
  const careLevel=[0,100,250,500,1000].filter(v=>Number(pet.pet_xp||0)>=v).length||1;
  const socialLevel=petSocialLevel(Number(pet.social_xp||0));
  if($('public-pet-title'))$('public-pet-title').textContent=pet.name;
  if($('public-pet-subtitle'))$('public-pet-subtitle').textContent=`${petLabel(pet.species)} · Pflege-Level ${careLevel}`;
  if($('public-pet-social-xp'))$('public-pet-social-xp').textContent=`${Number(pet.social_xp||0)} Social XP`;
  if($('public-pet-art'))$('public-pet-art').innerHTML=`<img src="assets/pet-${escapeHtml(pet.species)}.webp" alt="${escapeHtml(petLabel(pet.species))}">`;
  if($('public-pet-care-level'))$('public-pet-care-level').textContent=`Level ${careLevel}`;
  if($('public-pet-social-level'))$('public-pet-social-level').textContent=`Level ${socialLevel}`;

  const canAct=targetId!==ownId;
  actions?.querySelectorAll('[data-pet-action]').forEach(button=>{
    button.hidden=!canAct;
    if(!canAct)return;
    button.onclick=async()=>{
      const status=$('public-pet-status');
      actions.querySelectorAll('button').forEach(b=>b.disabled=true);
      if(status){status.textContent='Deine Pets treffen sich…';status.className='club-auth-status';}
      try{
        const {data:sessionData}=await supabaseClient.auth.getSession();
        const token=sessionData?.session?.access_token;
        if(!token)throw new Error('Sitzung abgelaufen.');
        const response=await fetch('/api/club-pet-social',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body:JSON.stringify({targetUserId:targetId,action:button.dataset.petAction})
        });
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload.error||'Pet-Interaktion fehlgeschlagen.');
        const labels={greet:'begrüßt',play:'spielt mit',pet:'streichelt'};
        if(status){status.textContent=`Dein Pet hat ${payload.target_pet?.name||'den Begleiter'} ${labels[button.dataset.petAction]||'besucht'}. +${payload.social_xp_awarded||0} Social XP für beide Pets.`;status.className='club-auth-status success';}
        if(payload.target_pet?.social_xp!=null && $('public-pet-social-xp'))$('public-pet-social-xp').textContent=`${payload.target_pet.social_xp} Social XP`;
      }catch(error){
        if(status){status.textContent=error?.message||'Pet-Interaktion fehlgeschlagen.';status.className='club-auth-status error';}
      }finally{
        actions.querySelectorAll('button').forEach(b=>b.disabled=false);
      }
    };
  });
}

function renderBadges(badges=[],xp=0,discord=false){
  const icons={'ACY Rookie':'💜','ACY Member':'🎮','Discord Member':'💬','ACY OG':'👑','ACY Legend':'🏆','Early Member':'⏳'};
  const auto=[...(xp>=100?['ACY Member']:[]),...(xp>=500?['ACY OG']:[]),...(xp>=1000?['ACY Legend']:[]),...(discord?['Discord Member']:[])];
  const all=[...new Set([...(badges||[]),'ACY Rookie',...auto])].slice(0,8);
  const grid=$('public-badges');
  if(!grid)return;
  grid.innerHTML=all.map(b=>`<div class="member-badge"><span>${icons[b]||'✦'}</span><strong>${escapeHtml(b)}</strong><small>ACY Club</small></div>`).join('');
}

async function init(){
  try{
    const cfg=await (await fetch('/api/config',{cache:'no-store'})).json();
    if(!cfg.configured)throw new Error('Supabase ist noch nicht konfiguriert.');
    supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const {data}=await supabaseClient.auth.getSession();
    if(!data?.session?.user){window.location.href='/club.html';return;}

    const id=new URLSearchParams(location.search).get('id');
    if(!id)throw new Error('Kein Mitglied ausgewählt.');

    const response=await fetch(`/api/club-members?id=${encodeURIComponent(id)}`,{
      cache:'no-store',
      headers:{Authorization:`Bearer ${data.session.access_token}`}
    });
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'Mitglied konnte nicht geladen werden.');

    const m=payload.member;
    $('public-name').textContent=m.display_name;
    $('public-handle').textContent=`@${m.username}`;
    $('public-bio').textContent=m.bio||'ACY Club Member';
    $('public-since').textContent=new Date(m.created_at).toLocaleDateString('de-DE');
    $('public-discord').textContent=m.discord_connected?'Verbunden ✓':'Nicht verbunden';
    $('public-xp').textContent=`${m.xp} XP`;

    const level=levelForXp(m.xp);
    $('public-level').textContent=String([0,100,250,500,1000].filter(v=>m.xp>=v).length);
    $('public-level-title').textContent=level.title;

    if(m.avatar_url){
      $('public-avatar').src=m.avatar_url;
      $('public-avatar').hidden=false;
      $('public-avatar-fallback').hidden=true;
    }else{
      $('public-avatar-fallback').textContent=String(m.display_name||m.username||'A').charAt(0).toUpperCase();
    }

    renderBadges(m.badges,m.xp,m.discord_connected);
    renderMemberPet(m.pet || null, id, data.session.user.id);
    loadPetFriendshipsForMember(id, data.session.user.id);
    loadPetDuoAchievements(id, data.session.user.id);

    const dmButton = $('send-direct-message');
    if (dmButton && id === data.session.user.id) {
      dmButton.hidden = true;
    } else if (dmButton) {
      dmButton.addEventListener('click', () => {
        window.location.href = `/club-profile.html?dm=${encodeURIComponent(id)}`;
      });
    }
  }catch(error){
    document.querySelector('.public-member-card').innerHTML=`<div class="club-content-empty">${escapeHtml(error.message||'Mitglied konnte nicht geladen werden.')}</div>`;
  }
}
$('logout')?.addEventListener('click',async()=>{if(supabaseClient)await supabaseClient.auth.signOut();window.location.href='/club.html';});
init();
