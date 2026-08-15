let supabaseClient = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
  return el;
}

function setStatus(text, type = '') {
  const el = $('profile-save-status');
  el.textContent = text;
  el.className = `club-auth-status ${type}`.trim();
}

function levelForXp(xp) {
  const levels = [
    { min: 0, title: 'ACY Rookie' },
    { min: 100, title: 'ACY Member' },
    { min: 250, title: 'ACY Regular' },
    { min: 500, title: 'ACY OG' },
    { min: 1000, title: 'ACY Legend' },
  ];
  let current = levels[0];
  for (const level of levels) {
    if (xp >= level.min) current = level;
  }
  return current;
}

function renderProgress(xp) {
  const thresholds = [0, 100, 250, 500, 1000, 2000];
  let idx = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) idx = i;
  }

  const base = thresholds[idx];
  const next = thresholds[idx + 1] ?? base + 1000;
  const progress = Math.max(0, Math.min(100, ((xp - base) / (next - base)) * 100));

  setText('member-level', String(idx + 1));
  setText('level-number', String(idx + 1));
  setText('member-xp', `${xp} XP`);
  setText('xp-current', `${xp} XP`);
  setText('xp-next', `${next} XP`);
  const bar = $('xp-bar-fill');
  if (bar) bar.style.width = `${progress}%`;
  setText('level-title', levelForXp(xp).title);
}

function renderBadges(badges = [], xp = 0, discordConnected = false) {
  const autoBadges = [];
  if (xp >= 100) autoBadges.push('ACY Member');
  if (xp >= 500) autoBadges.push('ACY OG');
  if (xp >= 1000) autoBadges.push('ACY Legend');
  if (discordConnected) autoBadges.push('Discord Member');
  const defaults = ['ACY Rookie', ...autoBadges];
  const list = Array.from(new Set([...(badges || []), ...defaults]));
  const icons = {
    'ACY Rookie': '💜',
    'Early Member': '⏳',
    'Fortnite': '🎮',
    'ACY OG': '👑',
    'ACY Legend': '🏆',
    'Discord Member': '💬'
  };
  const badgeGrid = $('badge-grid');
  if (!badgeGrid) return;
  badgeGrid.innerHTML = list.map((badge) => `
    <div class="member-badge">
      <span>${icons[badge] || '✦'}</span>
      <strong>${escapeHtml(badge)}</strong>
      <small>AC­Y Club</small>
    </div>
  `).join('');
}

function renderAvatar(profile) {
  const image = $('member-avatar-img');
  const fallback = $('member-avatar');
  if (!image || !fallback) return;
  if (profile.avatar_url) {
    image.src = profile.avatar_url;
    image.hidden = false;
    fallback.hidden = true;
  } else {
    const first = String(profile.display_name || profile.username || 'A').trim().charAt(0).toUpperCase() || 'A';
    fallback.textContent = first;
    fallback.hidden = false;
    image.hidden = true;
  }
}


async function awardProgression(eventKey) {
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    const response = await fetch('/api/club-progression', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ eventKey })
    });
    if (!response.ok) return;
    const result = await response.json();
    if (Number.isFinite(result.totalXp)) {
      renderProgress(result.totalXp);
      setText('member-xp', `${result.totalXp} XP`);
    }
    return result;
  } catch (error) {
    console.warn('Progression award skipped:', error);
  }
}

async function init() {
  try {
    const cfg = await (await fetch('/api/config', { cache: 'no-store' })).json();
    if (!cfg.configured) throw new Error('Supabase ist noch nicht konfiguriert.');
    supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    const { data } = await supabaseClient.auth.getSession();
    if (!data?.session?.user) {
      window.location.href = '/club.html';
      return;
    }

    currentUser = data.session.user;
    await loadProfile();
    await loadDiscordLink();
    await loadTwitch();
    await loadClubContent();
    await loadMemberDirectory();
  } catch (error) {
    const msg = error?.message || 'Profil konnte nicht geladen werden.';
    const status = $('profile-save-status');
    if (status) {
      status.textContent = msg;
      status.classList.add('error');
    }
    console.error('ACY Club profile init error:', error);
  }
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username,display_name,bio,avatar_url,created_at,xp,badges,discord_connected')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) throw error;

  const profile = data || {
    username: currentUser.user_metadata?.username || 'member',
    display_name: currentUser.user_metadata?.display_name || 'ACY Member',
    bio: '',
    avatar_url: '',
    created_at: currentUser.created_at,
    xp: 0,
    badges: ['ACY Rookie']
  };

  setText('member-name', profile.display_name || profile.username);
  setText('member-handle', `@${profile.username}`);
  setText('member-bio', profile.bio || 'Willkommen in deinem persönlichen ACY Club.');
  setText('member-since', profile.created_at ? new Date(profile.created_at).toLocaleDateString('de-DE') : '–');
  $('edit-display-name').value = profile.display_name || profile.username;
  $('edit-bio').value = profile.bio || '';

  renderAvatar(profile);
  renderProgress(Number(profile.xp || 0));
  window.__memberBadges = profile.badges || [];
  renderBadges(window.__memberBadges, Number(profile.xp || 0), !!profile.discord_connected);
  if ((profile.display_name || '').trim() && (profile.bio || '').trim()) {
    await awardProgression('profile_complete');
  }

  const created = new Date(profile.created_at || currentUser.created_at);
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (days >= 30) {
    await awardProgression('member_30_days');
  } else if (days >= 7) {
    await awardProgression('member_7_days');
  }

  $('avatar-input').dataset.currentUrl = profile.avatar_url || '';
}

async function loadTwitch() {
  const sub = $('member-twitch-sub');
  const game = $('member-twitch-game');
  const viewers = $('member-twitch-viewers');
  const title = $('twitch-member-title');
  const pill = $('member-live-pill');
  const dot = $('member-live-dot');
  const text = $('member-live-text');

  try {
    const res = await fetch('/api/twitch-status', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Twitch API HTTP ${res.status}`);
    const data = await res.json();
    const live = !!data.live;

    if (text) text.textContent = live ? 'LIVE' : 'OFFLINE';
    if (pill) pill.classList.toggle('is-live', live);
    if (dot) dot.classList.toggle('is-live', live);

    if (title) title.textContent = live ? (data.title || 'ACYJANNIK ist live') : 'ACYJANNIK';
    if (sub) sub.textContent = live ? 'Gerade live auf Twitch' : 'Gerade nicht live';
    if (game) game.textContent = data.game || '–';
    if (viewers) {
      const count = Number(data.viewerCount);
      viewers.textContent = Number.isFinite(count) ? count.toLocaleString('de-DE') : '–';
    }
  } catch (error) {
    console.warn('Twitch member status unavailable:', error);
    if (text) text.textContent = 'OFFLINE';
    if (pill) pill.classList.remove('is-live');
    if (dot) dot.classList.remove('is-live');
    if (sub) sub.textContent = 'Twitch-Status gerade nicht verfügbar';
    if (game) game.textContent = '–';
    if (viewers) viewers.textContent = '–';
  }
}



async function loadDiscordLink() {
  const button = $('discord-connect-btn');
  const text = $('discord-link-text');
  const state = $('discord-link-state');
  if (!button || !text) return;

  try {
    const { data, error } = await supabaseClient.auth.getUserIdentities();
    if (error) throw error;

    const discordIdentity = (data?.identities || []).find(identity => identity.provider === 'discord');
    const connected = !!discordIdentity;

    text.textContent = connected ? 'Discord verbunden' : 'Nicht verbunden';
    if (state) state.classList.toggle('is-connected', connected);
    if ($('discord-link-status')) {
      $('discord-link-status').textContent = connected
        ? 'Dein Discord-Konto ist mit diesem ACY Club Account verknüpft.'
        : 'Noch nicht verbunden.';
      $('discord-link-status').className = connected ? 'club-auth-status success' : 'club-auth-status';
    }

    button.textContent = connected ? 'Discord verbunden ✓' : 'Discord verbinden';
    button.disabled = connected;

    // Keep the profile flag in sync.
    await supabaseClient.from('profiles').update({
      discord_connected: connected,
      updated_at: new Date().toISOString()
    }).eq('id', currentUser.id);

    if (connected) {
      const result = await awardProgression('discord_connected');
      if (result?.totalXp !== undefined) {
        renderBadges((window.__memberBadges || []), Number(result.totalXp), true);
        setText('member-xp', `${result.totalXp} XP`);
      }
    }
  } catch (error) {
    console.warn('Discord identity status unavailable:', error);
    text.textContent = 'Discord-Verknüpfung nicht verfügbar';
  }
}

async function connectDiscord() {
  const button = $('discord-connect-btn');
  const statusEl = $('discord-link-status');

  if (button) {
    button.disabled = true;
    button.textContent = 'Discord wird verbunden…';
  }
  if (statusEl) {
    statusEl.textContent = 'Discord-Verbindung wird gestartet…';
    statusEl.className = 'club-auth-status';
  }

  try {
    if (!supabaseClient) throw new Error('Supabase ist noch nicht initialisiert.');

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData?.session) {
      throw new Error('Deine Sitzung ist abgelaufen. Bitte einmal neu einloggen.');
    }

    const { data, error } = await supabaseClient.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/club-profile.html`
      }
    });

    if (error) throw error;

    if (data?.url) {
      // Force the browser to follow the OAuth URL returned by Supabase.
      window.location.assign(data.url);
      return;
    }

    throw new Error(
      'Supabase hat keine Discord-OAuth-URL zurückgegeben. Prüfe, ob Discord als Provider aktiviert und Manual Linking eingeschaltet ist.'
    );
  } catch (error) {
    console.error('Discord linking failed:', error);
    if (statusEl) {
      statusEl.textContent = error?.message || 'Discord konnte nicht verbunden werden.';
      statusEl.className = 'club-auth-status error';
    }
    if (button) {
      button.disabled = false;
      button.textContent = 'Discord verbinden';
    }
  }
}

function applyEventAttendanceState(item, attending) {
  if (!item) return;
  item.dataset.attending = attending ? 'true' : 'false';
  const btn = item.querySelector('.event-attend-btn');
  if (!btn) return;
  btn.className = `button button-small ${attending ? 'button-secondary' : 'button-primary'} event-attend-btn`;
  btn.textContent = attending ? 'Dabei ✓' : 'Teilnehmen';
}

async function loadMemberDirectory(search = '') {
  const list = $('member-directory-list');
  const countEl = $('member-directory-count');
  if (!list) return;

  try {
    let query = supabaseClient
      .from('profiles')
      .select('id,username,display_name,bio,avatar_url,created_at,xp,badges')
      .order('created_at', { ascending: true })
      .limit(100);

    const value = search.trim();
    if (value) {
      const escaped = value.replace(/[%(),]/g, ' ');
      query = query.or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
    }

    const { data: members, error } = await query;
    if (error) throw error;

    const rows = Array.isArray(members) ? members : [];
    if (countEl) countEl.textContent = `${rows.length} Mitglieder`;

    if (!rows.length) {
      list.innerHTML = '<div class="club-content-empty">Keine Mitglieder gefunden.</div>';
      return;
    }

    const badgeIcon = {
      'ACY Rookie': '💜',
      'ACY Member': '🎮',
      'Discord Member': '💬',
      'ACY OG': '👑',
      'ACY Legend': '🏆',
      'Early Member': '⏳'
    };

    list.innerHTML = rows.map((member) => {
      const avatar = member.avatar_url
        ? `<img src="${escapeAttr(member.avatar_url)}" alt="" loading="lazy">`
        : `<div class="member-directory-avatar-fallback">${escapeHtml((member.display_name || member.username || 'A').charAt(0).toUpperCase())}</div>`;
      const level = levelForXp(Number(member.xp || 0)).title;
      const badges = (Array.isArray(member.badges) ? member.badges : []).slice(0, 3)
        .map(b => `${badgeIcon[b] || '✦'} ${escapeHtml(b)}`).join(' · ');

      return `<article class="member-directory-item">
        <div class="member-directory-avatar">${avatar}</div>
        <div class="member-directory-main">
          <div class="member-directory-name">${escapeHtml(member.display_name || member.username)}</div>
          <div class="member-directory-handle">@${escapeHtml(member.username || '')}</div>
          <p>${escapeHtml(member.bio || 'ACY Club Member')}</p>
        </div>
        <div class="member-directory-meta">
          <strong>${escapeHtml(level)}</strong>
          <small>${Number(member.xp || 0)} XP</small>
          <span>${badges || '💜 ACY Rookie'}</span>
        </div>
      </article>`;
    }).join('');
  } catch (error) {
    console.warn('Member directory unavailable:', error);
    if (countEl) countEl.textContent = '– Mitglieder';
    list.innerHTML = `<div class="club-content-empty">${escapeHtml(error?.message || 'Mitglieder konnten nicht geladen werden.')}</div>`;
  }
}

async function loadClubContent(){
  const eventsList=$('member-events-list'), newsList=$('member-news-list');
  try{
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const sessionToken = sessionData?.session?.access_token || '';
    const r=await fetch(`/api/club-content?_=${Date.now()}`,{
      cache:'no-store',
      headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    if(eventsList){
      const ev=Array.isArray(d.events)?d.events:[];
      eventsList.innerHTML=ev.length?ev.map(e=>{
        const when=new Date(e.event_date).toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const count=Number(e.attendee_count||0);
        const attending = !!e.user_attending;
        return `<article class="club-content-item event-item" data-event-id="${e.id}" data-attending="${attending}">
          <div class="club-content-date">${escapeHtml(when)}</div>
          <div class="club-content-main"><strong>${escapeHtml(e.title)}</strong><p>${escapeHtml(e.description||'')}</p><small>${escapeHtml(e.location||'Community')} · <span class="event-attendee-count">${count}</span> dabei</small></div>
          <button type="button" class="button button-small ${attending?'button-secondary':'button-primary'} event-attend-btn">${attending?'Dabei ✓':'Teilnehmen'}</button>
        </article>`;
      }).join(''):'<div class="club-content-empty">Noch keine Events.</div>';

      eventsList.querySelectorAll('.event-attend-btn').forEach(btn=>{
        btn.onclick=async()=>{
          const item=btn.closest('.event-item');
          const eventId=Number(item?.dataset.eventId);
          if(!eventId) return;
          const isAttending = item?.dataset.attending === 'true';
          btn.disabled=true;
          btn.textContent=isAttending?'Abmelden…':'Dabei…';
          try{
            const {data}=await supabaseClient.auth.getSession();
            const token=data?.session?.access_token;
            if(!token) throw new Error('Sitzung abgelaufen. Bitte neu einloggen.');
            const response=await fetch('/api/club-event-attendance',{
              method:'POST',
              headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
              body:JSON.stringify({eventId,action:isAttending?'leave':'join'})
            });
            const result=await response.json();
            if(!response.ok) throw new Error(result.error||'Teilnahme konnte nicht gespeichert werden.');
            applyEventAttendanceState(item, !!result.attending);
            const countEl=item.querySelector('.event-attendee-count');
            if(countEl) countEl.textContent=String(result.count);
            await loadProfile();
          }catch(error){
            console.error('Event attendance failed:',error);
            btn.textContent=isAttending?'Dabei ✓':'Teilnehmen';
            applyEventAttendanceState(item, isAttending);
            const existing=$('profile-save-status');
            if(existing){existing.textContent=error.message||'Teilnahme fehlgeschlagen.';existing.className='club-auth-status error';}
          }finally{
            btn.disabled=false;
          }
        };
      });
    }

    if(newsList){
      const news=Array.isArray(d.news)?d.news:[];
      newsList.innerHTML=news.length?news.map(n=>{
        const when=new Date(n.published_at).toLocaleDateString('de-DE');
        return `<article class="club-content-item news-item"><div class="club-content-date">${escapeHtml(when)}</div><div class="club-content-main"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p></div></article>`;
      }).join(''):'<div class="club-content-empty">Noch keine Neuigkeiten.</div>';
    }
  }catch(e){
    console.warn('Club content unavailable',e);
    if(eventsList)eventsList.innerHTML='<div class="club-content-empty">Events momentan nicht verfügbar.</div>';
    if(newsList)newsList.innerHTML='<div class="club-content-empty">News momentan nicht verfügbar.</div>';
  }
}

let memberSearchTimer = null;
$('member-directory-search')?.addEventListener('input', (event) => {
  clearTimeout(memberSearchTimer);
  const value = event.target.value;
  memberSearchTimer = setTimeout(() => loadMemberDirectory(value), 250);
});

$('profile-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = $('edit-display-name').value.trim();
  const bio = $('edit-bio').value.trim();
  if (!displayName) return setStatus('Bitte einen Anzeigenamen eingeben.', 'error');

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      display_name: displayName,
      bio,
      updated_at: new Date().toISOString()
    })
    .eq('id', currentUser.id);

  if (error) {
    setStatus(error.message, 'error');
    return;
  }

  setText('member-name', displayName);
  setText('member-bio', bio || 'Willkommen in deinem persönlichen ACY Club.');
  setStatus('Profil gespeichert.', 'success');
});

$('avatar-input')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return setStatus('Bitte JPG, PNG oder WebP verwenden.', 'error');
  }
  if (file.size > 4 * 1024 * 1024) {
    return setStatus('Bitte ein Bild unter 4 MB verwenden.', 'error');
  }

  try {
    setStatus('Profilbild wird hochgeladen…');

    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('club-avatars')
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseClient.storage
      .from('club-avatars')
      .getPublicUrl(path);

    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (profileError) throw profileError;

    if ($('member-avatar-img')) {
      $('member-avatar-img').src = avatarUrl;
      $('member-avatar-img').hidden = false;
    }
    if ($('member-avatar')) {
      $('member-avatar').hidden = true;
    }

    await awardProgression('avatar_added');
    setStatus('Profilbild gespeichert.', 'success');
  } catch (error) {
    console.error('Avatar upload failed:', error);
    setStatus(error.message || 'Profilbild-Upload fehlgeschlagen. Bitte prüfe den Supabase-Bucket club-avatars.', 'error');
  }
});

$('discord-connect-btn')?.addEventListener('click', connectDiscord);

$('logout')?.addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  window.location.href = '/club.html';
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

init();
