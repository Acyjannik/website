let modSession=null;

const $=id=>document.getElementById(id);
function esc(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML;}
function msg(id,text,error=false){const el=$(id);if(el){el.textContent=text;el.classList.toggle('error',error);}}

async function session(){
  if(modSession)return modSession;
  if(!window.supabase)return null;
  const config=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
  const client=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);
  const {data}=await client.auth.getSession();
  const token=data?.session?.access_token;
  if(!token){
    const returnTo=encodeURIComponent('/mod.html');
    window.location.href=`/club.html?redirect=${returnTo}`;
    throw new Error('Weiterleitung zum ACY Club Login…');
  }
  const role=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}).then(r=>r.json());
  if(!role.isModerator)throw new Error('Dieser Account ist nicht als Moderator freigeschaltet.');
  modSession={client,token,role};
  return modSession;
}

async function loadPolls(){
  const s=await session();
  const list=$('mod-poll-list');
  const {data,error}=await s.client.from('club_polls').select('id,question,description,active,closes_at,created_at').order('created_at',{ascending:false});
  if(error){list.innerHTML=`<div class="admin-note">${esc(error.message)}</div>`;return;}
  list.innerHTML=(data||[]).map(p=>`<div class="admin-table-row">
    <div><strong>${esc(p.question)}</strong><small>${esc(p.description||'')}</small></div>
    <div>${p.active?'🟢 Aktiv':'⚪ Beendet'}<small>${p.closes_at?new Date(p.closes_at).toLocaleString('de-DE'):'ohne Ende'}</small></div>
    <div><button class="button button-secondary button-small" data-mod-toggle="${p.id}">${p.active?'Beenden':'Aktivieren'}</button></div>
  </div>`).join('')||'<div class="admin-note">Noch keine Votes.</div>';
  list.querySelectorAll('[data-mod-toggle]').forEach(btn=>btn.onclick=async()=>{
    const id=Number(btn.dataset.modToggle);
    try{
      if(btn.textContent==='Aktivieren')await s.client.from('club_polls').update({active:false}).eq('active',true);
      const {error}=await s.client.from('club_polls').update({active:btn.textContent==='Aktivieren'}).eq('id',id);
      if(error)throw error;
      loadPolls();
    }catch(e){msg('mod-poll-message',e.message,true);}
  });
}

async function addPoll(){
  const s=await session();
  const question=$('mod-poll-question').value.trim();
  const description=$('mod-poll-description').value.trim();
  const options=$('mod-poll-options').value.split('\n').map(x=>x.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,8);
  if(!question)return msg('mod-poll-message','Bitte eine Frage eingeben.',true);
  if(options.length<2)return msg('mod-poll-message','Mindestens zwei Antworten nötig.',true);
  const closesRaw=$('mod-poll-closes').value;
  const closes_at=closesRaw?new Date(closesRaw).toISOString():null;

  try{
    await s.client.from('club_polls').update({active:false}).eq('active',true);
    const {data,error}=await s.client.from('club_polls').insert({
      question,description:description||null,closes_at,active:true,created_by:s.role.userId
    }).select('id').single();
    if(error)throw error;
    const {error:oe}=await s.client.from('club_poll_options').insert(options.map((label,i)=>({poll_id:data.id,label,sort_order:i})));
    if(oe)throw oe;
    msg('mod-poll-message','Vote veröffentlicht.',false);
    $('mod-poll-question').value='';$('mod-poll-description').value='';$('mod-poll-options').value='';
    loadPolls();
  }catch(e){msg('mod-poll-message',e.message,true);}
}


async function loadReports(){
  const s=await session(); const list=$('mod-report-list'); if(!list)return;
  const response=await fetch('/api/mod-reports',{headers:{Authorization:`Bearer ${s.token}`},cache:'no-store'}); const payload=await response.json();
  if(!response.ok)throw new Error(payload.error||'Meldungen konnten nicht geladen werden.');
  const reports=Array.isArray(payload.reports)?payload.reports:[]; const open=reports.filter(r=>r.status==='open').length;
  if($('mod-reports-count'))$('mod-reports-count').textContent=`${open} offen`;
  list.innerHTML=reports.length?reports.map(r=>{const target=r.target?.display_name||r.target?.username||'Unbekannt';const reporter=r.reporter?.display_name||r.reporter?.username||'Mitglied';return `<div class="admin-table-row report-row-v10"><div><strong>${esc(target)}</strong><small>Gemeldet von ${esc(reporter)}</small></div><div><strong>${esc(r.reason)}</strong><small>${esc(r.details||'Keine Details')}</small></div><div><span class="report-status-${esc(r.status)}">${esc(r.status)}</span><small>${new Date(r.created_at).toLocaleString('de-DE')}</small></div><div class="report-actions-v10">${r.status==='open'?`<button class="button button-secondary button-small" data-report-action="ignore" data-report-id="${r.id}">Ignorieren</button><button class="button button-secondary button-small" data-report-action="warn" data-report-id="${r.id}">Verwarnen</button><button class="button button-secondary button-small" data-report-action="mute24" data-report-id="${r.id}">24h Chat-Mute</button><button class="button button-danger button-small" data-report-action="escalate" data-report-id="${r.id}">An Admin</button>`:''}</div></div>`;}).join(''):'<div class="admin-note">Keine Meldungen.</div>';
  list.querySelectorAll('[data-report-action]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const r=await fetch('/api/mod-reports',{method:'PATCH',headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/json'},body:JSON.stringify({id:btn.dataset.reportId,action:btn.dataset.reportAction})});const p=await r.json();if(!r.ok)throw new Error(p.error||'Aktion fehlgeschlagen.');await loadReports();}catch(e){alert(e.message)}finally{btn.disabled=false;}});
}

async function loadMembers(){
  const s=await session();
  const list=$('mod-member-list');
  const {data,error}=await s.client.from('club_moderator_members').select('id,username,display_name,avatar_url,xp,created_at,discord_connected,badges').order('created_at',{ascending:true});
  if(error){list.innerHTML=`<div class="admin-note">${esc(error.message)}</div>`;return;}
  renderMembers(data||[]);
}
function renderMembers(rows){
  const q=($('mod-member-search').value||'').trim().toLowerCase();
  const filtered=rows.filter(m=>`${m.display_name||''} ${m.username||''}`.toLowerCase().includes(q));
  $('mod-member-list').innerHTML=filtered.map(m=>`<div class="badge-member-row">
    <div class="badge-member-person">${m.avatar_url?`<img src="${esc(m.avatar_url)}" alt="">`:`<span class="spotlight-avatar-fallback">${esc((m.display_name||m.username||'A').charAt(0).toUpperCase())}</span>`}
      <div><strong>${esc(m.display_name||m.username||'Member')}</strong><small>@${esc(m.username||'')} · ${Number(m.xp||0)} XP ${Array.isArray(m.badges)&&m.badges.includes('Mod')?'· 🛡️ Mod':''}</small></div>
    </div>
    <div>${m.discord_connected?'🟢 Discord':'⚪ Discord nicht verbunden'}</div>
  </div>`).join('')||'<div class="admin-note">Keine Mitglieder gefunden.</div>';
}
async function announce(){
  const s=await session();
  const title=$('mod-ann-title').value.trim(), body=$('mod-ann-body').value.trim();
  if(!title||!body)return msg('mod-ann-message','Titel und Nachricht sind erforderlich.',true);
  try{
    // Log and send via existing Event Hub. This requires either mod authorization extension
    // or can be upgraded to a dedicated moderator endpoint later.
    const r=await fetch('/api/mod-announcement',{
      method:'POST',
      headers:{'Authorization':`Bearer ${s.token}`,'Content-Type':'application/json'},
      body:JSON.stringify({title,body})
    });
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Ankündigung konnte nicht gesendet werden.');
    msg('mod-ann-message','Ankündigung gesendet.');
    $('mod-ann-title').value='';$('mod-ann-body').value='';
  }catch(e){msg('mod-ann-message',e.message,true);}
}

async function boot(){
  try{
    const s=await session();
    $('mod-role-chip').textContent=s.role.isAdmin?'ADMIN · MOD CENTER':'🛡️ MOD';
    $('mod-stat-role').textContent=s.role.isAdmin?'Admin':'Moderator';

    document.querySelectorAll('.mod-tab').forEach(btn=>btn.onclick=()=>{
      document.querySelectorAll('.mod-tab').forEach(b=>b.classList.toggle('is-active',b===btn));
      document.querySelectorAll('.mod-view').forEach(v=>v.classList.toggle('is-active',v.dataset.view===btn.dataset.tab));
      $('mod-view-title').textContent=({dashboard:'Dashboard',polls:'Community Votes',reports:'Meldungen',members:'Mitglieder',announcement:'Ankündigung'})[btn.dataset.tab];
      if(btn.dataset.tab==='polls')loadPolls().catch(e=>msg('mod-poll-message',e.message,true));
      if(btn.dataset.tab==='members')loadMembers().catch(e=>console.warn(e));
      if(btn.dataset.tab==='reports')loadReports().catch(e=>console.warn(e));
    });
    $('mod-add-poll').onclick=()=>addPoll().catch(e=>msg('mod-poll-message',e.message,true));
    $('mod-member-search').oninput=()=>loadMembers().catch(()=>{});
    $('mod-send-ann').onclick=()=>announce().catch(e=>msg('mod-ann-message',e.message,true));
    $('mod-reports-refresh').onclick=()=>loadReports().catch(e=>msg('mod-reports-count',e.message,true));

    const polls=await s.client.from('club_polls').select('id').eq('active',true);
    const members=await s.client.from('profiles').select('id',{count:'exact',head:true});
    $('mod-stat-polls').textContent=String((polls.data||[]).length);
    $('mod-stat-members').textContent=String(members.count||0);
    $('mod-stat-reports').textContent='0';
  }catch(error){
    document.querySelector('.admin-main').innerHTML=`<div class="admin-card" style="margin:40px"><h2>Zugriff verweigert</h2><p class="admin-muted">${esc(error.message||'Moderatorenbereich nicht verfügbar.')}</p><a class="button button-primary" href="/club-profile.html">Zum Club-Login</a></div>`;
  }
}
boot();
