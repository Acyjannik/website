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

    const response=await fetch(`/api/club-member?id=${encodeURIComponent(id)}`,{
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
  }catch(error){
    document.querySelector('.public-member-card').innerHTML=`<div class="club-content-empty">${escapeHtml(error.message||'Mitglied konnte nicht geladen werden.')}</div>`;
  }
}
$('logout')?.addEventListener('click',async()=>{if(supabaseClient)await supabaseClient.auth.signOut();window.location.href='/club.html';});
init();
