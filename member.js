
async function loadPublicTwitchV11(memberId){
  const card=document.getElementById('public-twitch-v11');
  if(!card||!memberId)return;
  // The public profile intentionally exposes only non-sensitive ACY Twitch stats.
  try{
    const token=(await supabaseClient.auth.getSession()).data?.session?.access_token;
    if(!token)return;
    const r=await fetch(`/api/twitch-public?userId=${encodeURIComponent(memberId)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    const p=await r.json(); if(!r.ok||!p.connected)return;
    card.hidden=false;
    setMemberText('public-twitch-name',p.displayName||p.login||'Twitch');
    setMemberText('public-twitch-watch',formatWatchMinutesV11(p.watchMinutes||0));
    setMemberText('public-twitch-points',String(p.watchPoints||0));
    setMemberText('public-twitch-streak',String(p.currentStreak||0));
  }catch{}
}

let supabaseClient=null;
const $=id=>document.getElementById(id);
function setMemberText(id,value){
  const el=$(id);
  if(el) el.textContent=value;
  return el;
}


function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
const PUBLIC_CLUB_LEVELS = [
  {min:0,title:'ACY Rookie'},{min:100,title:'ACY Member'},{min:300,title:'ACY Regular'},
  {min:600,title:'ACY OG'},{min:1000,title:'ACY Legend'},{min:1500,title:'ACY Champion'},
  {min:2500,title:'ACY Elite'},{min:4000,title:'ACY Master'},{min:6000,title:'ACY Icon'},
  {min:8500,title:'ACY Mythic'},{min:11500,title:'ACY Immortal'},{min:15000,title:'ACY Hall of Fame'},
  {min:20000,title:'ACY Ascended'},{min:27000,title:'ACY Celestial'},{min:35000,title:'ACY Eternal'},
  {min:45000,title:'ACY Apex'},{min:60000,title:'ACY Vanguard'},{min:80000,title:'ACY Paragon'},
  {min:105000,title:'ACY Overlord'},{min:135000,title:'ACY Sovereign'},{min:170000,title:'ACY Cosmic'},
  {min:210000,title:'ACY Transcendent'},{min:260000,title:'ACY Eternal Flame'},{min:320000,title:'ACY Grandmaster'},
  {min:390000,title:'ACY Omega'},{min:470000,title:'ACY Apex Legend'},{min:560000,title:'ACY Ultra'},
  {min:660000,title:'ACY Infinity'},{min:780000,title:'ACY Beyond'},{min:920000,title:'ACY Hall of Fame+'}
];
function levelForXp(xp){
  const v=Math.max(0,Number(xp)||0);
  return PUBLIC_CLUB_LEVELS.reduce((current,level)=>v>=level.min?level:current,PUBLIC_CLUB_LEVELS[0]);
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
    empty.hidden=false; empty.setAttribute('aria-hidden','false');
    active.hidden=true; active.setAttribute('aria-hidden','true'); return;
  }
  empty.hidden=true; empty.setAttribute('aria-hidden','true');
  active.hidden=false; active.setAttribute('aria-hidden','false');
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

        // Notify the pet owner, but never the public chat.
        try{
          void fetch('/api/push-pet-social',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${data.session.access_token}`},
            body:JSON.stringify({
              ownerId:targetId,
              action:button.dataset.petAction,
              visitorName:document.querySelector('#public-name')?.textContent || 'Jemand',
              petName:payload.target_pet?.name || 'dein Pet'
            })
          }).catch(()=>{});
        }catch{}
      }catch(error){
        if(status){status.textContent=error?.message||'Pet-Interaktion fehlgeschlagen.';status.className='club-auth-status error';}
      }finally{
        actions.querySelectorAll('button').forEach(b=>b.disabled=false);
      }
    };
  });
}


function formatWatchMinutesV11(minutes){const v=Math.max(0,Number(minutes)||0);const h=Math.floor(v/60),mm=v%60;return h?`${h}h ${mm}m`:`${mm}m`;}
function publicGlowTierForXp(xp=0){
  const value=Math.max(0,Number(xp)||0);
  if(value>=25000)return 8;
  if(value>=17000)return 7;
  if(value>=12000)return 6;
  if(value>=8000)return 5;
  if(value>=5500)return 4;
  if(value>=3500)return 3;
  if(value>=2000)return 2;
  if(value>=1000)return 1;
  if(value>=500)return 0;
  return -1;
}

function renderBadges(badges=[],xp=0,discord=false){
  const icons={'ACY Rookie':'💜','ACY Member':'🎮','Discord Member':'💬','ACY OG':'👑','ACY Legend':'🏆','Early Member':'⏳'};
  const auto=[...(xp>=100?['ACY Member']:[]),...(xp>=500?['ACY OG']:[]),...(xp>=1000?['ACY Legend']:[]),...(discord?['Discord Member']:[])];
  const all=[...new Set([...(badges||[]),'ACY Rookie',...auto])].slice(0,8);
  const grid=$('public-badges');
  if(!grid)return;
  const tier=Math.max(0,publicGlowTierForXp(xp));
  grid.innerHTML=all.map((b,i)=>{
    const badgeTier=Math.min(8,tier+Math.min(2,Math.floor(i/3)));
    return `<div class="member-badge glow-tier-${badgeTier}"><span>${icons[b]||'✦'}</span><strong>${escapeHtml(b)}</strong><small>ACY Club</small></div>`;
  }).join('');
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
    const publicCard=document.querySelector('.public-member-card');
    const publicGlow=publicGlowTierForXp(Number(m.xp||0));
    if(publicCard){
      publicCard.classList.remove(...Array.from({length:9},(_,i)=>`glow-tier-${i}`),'glow-tier-none');
      publicCard.classList.add(publicGlow>=0?`glow-tier-${publicGlow}`:'glow-tier-none');
    }
    setMemberText('public-name',m.display_name);
    setMemberText('public-handle',`@${m.username}`);
    setMemberText('public-bio',m.bio||'ACY Club Member');
    setMemberText('public-since',new Date(m.created_at).toLocaleDateString('de-DE'));
    setMemberText('public-status',m.online ? (m.game_name ? `🟢 ${m.game_name}` : '🟢 Online') : '⚫ Offline');
        setMemberText('public-discord',m.discord_connected?'Verbunden ✓':'Nicht verbunden');
    setMemberText('public-xp',`${m.xp} XP`);

    const level=levelForXp(m.xp);
    setMemberText('public-level',String([0,100,250,500,1000].filter(v=>m.xp>=v).length));
    setMemberText('public-level-title',level.title);

    if(m.avatar_url){
      if($('public-avatar')) $('public-avatar').src=m.avatar_url;
      if($('public-avatar')) $('public-avatar').hidden=false;
      if($('public-avatar-fallback')) $('public-avatar-fallback').hidden=true;
    }else{
      setMemberText('public-avatar-fallback',String(m.display_name||m.username||'A').charAt(0).toUpperCase());
    }

    renderBadges(m.badges,m.xp,m.discord_connected);
    void loadPublicTwitchV11(id);
    renderMemberPet(m.pet || null, id, data.session.user.id);
    loadPetFriendshipsForMember(id, data.session.user.id);


    const friendButton=$('send-friend-request');
    const blockButton=$('block-member');
    const socialStatus=$('member-social-status');

    if(id===data.session.user.id){
      if(friendButton)friendButton.hidden=true;
      if(blockButton)blockButton.hidden=true;
    }else{
      friendButton?.addEventListener('click',async()=>{
        try{
          const {data:rpcData,error}=await supabaseClient.rpc('send_friend_request',{p_target_user_id:id});
          if(error)throw error;
          if(socialStatus){socialStatus.textContent=rpcData?.status==='accepted'?'Ihr seid bereits befreundet.':'Freundschaftsanfrage gesendet.';socialStatus.className='club-auth-status success';}
        }catch(error){if(socialStatus){socialStatus.textContent=error?.message||'Anfrage konnte nicht gesendet werden.';socialStatus.className='club-auth-status error';}}
      });
      blockButton?.addEventListener('click',async()=>{
        if(!confirm('Dieses Mitglied wirklich blockieren? Freundschaft und offene Anfragen werden entfernt.'))return;
        try{
          const {error}=await supabaseClient.rpc('block_member',{p_blocked_user_id:id});
          if(error)throw error;
          if(socialStatus){socialStatus.textContent='Kontakt blockiert.';socialStatus.className='club-auth-status success';}
          if(friendButton)friendButton.hidden=true;
          if(blockButton){blockButton.textContent='🚫 Blockiert';blockButton.disabled=true;}
        }catch(error){if(socialStatus){socialStatus.textContent=error?.message||'Kontakt konnte nicht blockiert werden.';socialStatus.className='club-auth-status error';}}
      });
    }

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
