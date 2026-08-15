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

function renderBadges(badges = []) {
  const defaults = ['ACY Rookie'];
  const list = Array.from(new Set([...(badges || []), ...defaults]));
  const icons = {
    'ACY Rookie': '💜',
    'Early Member': '⏳',
    'Fortnite': '🎮',
    'ACY OG': '👑',
    'ACY Legend': '🏆'
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
    await loadTwitch();
    await loadClubContent();
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
    .select('username,display_name,bio,avatar_url,created_at,xp,badges')
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
  renderBadges(profile.badges || []);

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


async function loadClubContent(){
  const eventsList=$('member-events-list'), newsList=$('member-news-list');
  try{
    const r=await fetch('/api/club-content',{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    if(eventsList){
      const ev=Array.isArray(d.events)?d.events:[];
      eventsList.innerHTML=ev.length?ev.map(e=>{
        const when=new Date(e.event_date).toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        return `<article class="club-content-item"><div class="club-content-date">${escapeHtml(when)}</div><div class="club-content-main"><strong>${escapeHtml(e.title)}</strong><p>${escapeHtml(e.description||'')}</p><small>${escapeHtml(e.location||'Community')}</small></div><a class="button button-small button-primary" href="${escapeAttr(e.twitch_url||'https://www.twitch.tv/acyjannik')}" target="_blank" rel="noreferrer">Dabei sein ↗</a></article>`;
      }).join(''):'<div class="club-content-empty">Noch keine Events.</div>';
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
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    return setStatus('Bitte JPG, PNG oder WebP verwenden.', 'error');
  }
  if (file.size > 4 * 1024 * 1024) {
    return setStatus('Bitte ein Bild unter 4 MB verwenden.', 'error');
  }

  try {
    setStatus('Profilbild wird hochgeladen…');
    const extension = file.type.split('/')[1].replace('jpeg','jpg');
    const path = `avatars/${currentUser.id}.${extension}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from('site-media')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseClient.storage
      .from('site-media')
      .getPublicUrl(path);

    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
    const { error } = await supabaseClient
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id);

    if (error) throw error;

    if ($('member-avatar-img')) $('member-avatar-img').src = avatarUrl;
    if ($('member-avatar-img')) $('member-avatar-img').hidden = false;
    if ($('member-avatar')) $('member-avatar').hidden = true;
    setStatus('Profilbild gespeichert.', 'success');
  } catch (error) {
    setStatus(error.message || 'Upload fehlgeschlagen.', 'error');
  }
});

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
