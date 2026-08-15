let supabaseClient = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

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
  const levels = [0, 100, 250, 500, 1000, 2000];
  const level = Math.max(1, Math.min(5, levels.findIndex(v => xp < v)));
  const currentIndex = level === 1 && xp >= 100 ? 1 : Math.max(0, levels.findIndex(v => xp < v) - 1);
  const base = levels[currentIndex] || 0;
  const next = levels[currentIndex + 1] || base + 1000;
  const progress = Math.max(0, Math.min(100, ((xp - base) / (next - base)) * 100));

  $('member-level').textContent = String(currentIndex + 1);
  $('level-number').textContent = String(currentIndex + 1);
  $('member-xp').textContent = `${xp} XP`;
  $('xp-current').textContent = `${xp} XP`;
  $('xp-next').textContent = `${next} XP`;
  $('xp-bar-fill').style.width = `${progress}%`;
  $('level-title').textContent = levelForXp(xp).title;
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
  $('badge-grid').innerHTML = list.map((badge) => `
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
  } catch (error) {
    $('profile-save-status').textContent = error.message || 'Profil konnte nicht geladen werden.';
    $('profile-save-status').classList.add('error');
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

  $('member-name').textContent = profile.display_name || profile.username;
  $('member-handle').textContent = `@${profile.username}`;
  $('member-bio').textContent = profile.bio || 'Willkommen in deinem persönlichen ACY Club.';
  $('member-since').textContent = profile.created_at ? new Date(profile.created_at).toLocaleDateString('de-DE') : '–';
  $('edit-display-name').value = profile.display_name || profile.username;
  $('edit-bio').value = profile.bio || '';

  renderAvatar(profile);
  renderProgress(Number(profile.xp || 0));
  renderBadges(profile.badges || []);

  $('avatar-input').dataset.currentUrl = profile.avatar_url || '';
}

async function loadTwitch() {
  try {
    const res = await fetch('/api/twitch-status', { cache: 'no-store' });
    const data = await res.json();
    const live = !!data.live;
    $('member-live-text').textContent = live ? 'LIVE' : 'OFFLINE';
    $('member-live-pill').classList.toggle('is-live', live);
    $('member-live-dot').classList.toggle('is-live', live);
    $('member-twitch-title').textContent = live ? (data.title || 'ACYJANNIK ist live') : 'ACYJANNIK';
    $('member-twitch-sub').textContent = live ? 'Gerade live auf Twitch' : 'Gerade nicht live';
    $('member-twitch-game').textContent = data.game || '–';
    $('member-twitch-viewers').textContent = Number.isFinite(data.viewerCount)
      ? Number(data.viewerCount).toLocaleString('de-DE')
      : '–';
  } catch {
    $('member-twitch-sub').textContent = 'Twitch-Status gerade nicht verfügbar';
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

  $('member-name').textContent = displayName;
  $('member-bio').textContent = bio || 'Willkommen in deinem persönlichen ACY Club.';
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

    $('member-avatar-img').src = avatarUrl;
    $('member-avatar-img').hidden = false;
    $('member-avatar').hidden = true;
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
