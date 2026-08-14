let supabaseClient = null;
let currentUser = null;
let cachedGames = [];

const $ = (id) => document.getElementById(id);

const VIEW_META = {
  overview: ['OVERVIEW', 'Dashboard'],
  content: ['WEBSITE', 'Website'],
  games: ['CONTENT', 'Games'],
  socials: ['COMMUNITY', 'Socials'],
  media: ['MEDIA', 'Bilder'],
  security: ['SECURITY', 'Sicherheit'],
};

async function loadConfig() {
  const response = await fetch('/api/config', {
    cache: 'no-store',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Config-Endpunkt antwortet mit HTTP ${response.status}.`);
  }

  const config = await response.json();

  if (!config.configured) {
    throw new Error('Supabase-Konfiguration fehlt in Vercel Production.');
  }

  if (!/^https?:\/\//i.test(config.supabaseUrl || '')) {
    throw new Error('SUPABASE_URL ist keine gültige HTTP/HTTPS-URL.');
  }

  if (!config.supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY fehlt in Vercel Production.');
  }

  if (!window.supabase?.createClient) {
    throw new Error('Supabase-JavaScript-Bibliothek wurde nicht geladen.');
  }

  supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  if (!supabaseClient) {
    throw new Error('Supabase-Client konnte nicht initialisiert werden.');
  }
}

function message(id, text, ok = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('success', ok);
  el.classList.toggle('error', !ok);
}

function saveStamp() {
  message('last-saved-message', `Gespeichert · ${new Date().toLocaleString('de-DE')}`, true);
}

function isSafeHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function isAdmin(user) {
  if (!user) return false;
  const { data, error } = await supabaseClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !error && !!data;
}

function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.admin-view').forEach(view => {
    view.classList.toggle('is-active', view.dataset.view === tab);
  });
  const meta = VIEW_META[tab] || VIEW_META.overview;
  $('admin-view-kicker').textContent = meta[0];
  $('admin-view-title').textContent = meta[1];
  history.replaceState(null, '', `#${tab}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.jump));
  });
  const initial = location.hash.replace('#', '');
  if (VIEW_META[initial]) switchTab(initial);
}


async function ensureDefaultContent() {
  // Remove the discontinued game from older database versions.
  await supabaseClient
    .from('games')
    .delete()
    .ilike('name', '%meccha%');

  const defaultSocials = [
    { platform: 'twitch', label: 'Twitch', url: 'https://www.twitch.tv/acyjannik', sort_order: 1 },
    { platform: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@acyjannik', sort_order: 2 },
    { platform: 'whatsapp', label: 'WhatsApp', url: 'https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10', sort_order: 3 }
  ];

  const defaultGames = [
    { name: 'Fortnite', description: 'Main Game · Ranked · Community', tag: 'MAIN GAME', image_url: 'https://cdn.startselect.com/production/blog/preview-images/new-fortnite-season.jpg', featured: true, sort_order: 1 },
    { name: 'GTA V', description: 'Open World · Aktuell · Fun', tag: 'AKTUELL', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg', featured: false, sort_order: 2 },
    { name: 'Thick As Thieves', description: 'Stealth · Heist · Community', tag: 'VARIETY', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg', featured: false, sort_order: 3 }
  ];

  const { data: existingSocials } = await supabaseClient.from('social_links').select('*');
  const socialByPlatform = new Map((existingSocials || []).map(x => [x.platform, x]));
  for (const seed of defaultSocials) {
    const current = socialByPlatform.get(seed.platform);
    if (!current) {
      await supabaseClient.from('social_links').insert({ ...seed, enabled: true });
    } else {
      const patch = {};
      if (!current.url) patch.url = seed.url;
      if (!current.label) patch.label = seed.label;
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        await supabaseClient.from('social_links').update(patch).eq('id', current.id);
      }
    }
  }

  const { data: existingGames } = await supabaseClient.from('games').select('*');
  const gameByName = new Map((existingGames || []).map(x => [x.name, x]));
  for (const seed of defaultGames) {
    const current = gameByName.get(seed.name);
    if (!current) {
      await supabaseClient.from('games').insert({ ...seed, enabled: true });
      continue;
    }

    const patch = {};
    if (!current.description) patch.description = seed.description;
    if (!current.tag) patch.tag = seed.tag;
    if (current.image_url !== seed.image_url) patch.image_url = seed.image_url;
    if (current.sort_order == null) patch.sort_order = seed.sort_order;
    if (seed.name === 'Fortnite' && current.featured !== true) patch.featured = true;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await supabaseClient.from('games').update(patch).eq('id', current.id);
    }
  }
}

async function loadDashboard() {
  const { data: settings, error: settingsError } = await supabaseClient
    .from('site_settings')
    .select('*')
    .eq('id', true)
    .single();

  if (settingsError) {
    message('dash-message', `Datenbankfehler: ${settingsError.message}`);
    $('system-db').textContent = 'Fehler';
    return;
  }

  $('hero-kicker').value = settings.hero_kicker || '';
  $('hero-title').value = settings.hero_title || '';
  $('hero-description').value = settings.hero_description || '';
  $('about-text').value = settings.about_text || '';
  $('community-text').value = settings.community_text || '';
  $('hero-image-url').value = settings.hero_image_url || '';

  updatePreview(settings);

  $('admin-user-id').textContent = currentUser?.id ? `${currentUser.id.slice(0, 8)}…` : '–';
  $('system-db').textContent = 'OK';

  await Promise.all([
    loadSocials(),
    loadGames(),
    loadTwitchStatus(),
  ]);

  await loadMediaPreview();
}

function updatePreview(settings) {
  $('hero-preview-title').textContent = settings.hero_title || 'ACYJANNIK';
  $('hero-preview-description').textContent = settings.hero_description || '';
  $('hero-preview-image').src = settings.hero_image_url || '/assets/acyjannik-hero.png';
}

async function loadSocials() {
  const fallback = {
    twitch: 'https://www.twitch.tv/acyjannik',
    tiktok: 'https://www.tiktok.com/@acyjannik',
    whatsapp: 'https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10'
  };

  const { data, error } = await supabaseClient
    .from('social_links')
    .select('*')
    .order('sort_order');

  const byPlatform = new Map((data || []).map(row => [row.platform, row]));
  document.querySelectorAll('.social-admin-row').forEach(row => {
    const platform = row.dataset.social;
    const db = byPlatform.get(platform);
    const url = db?.url || fallback[platform];
    row.querySelector('.social-url').value = url;
    row.querySelector('.social-enabled').checked = db?.enabled !== false;
    row.dataset.dbId = db?.id || '';
  });

  const state = $('socials-db-state');
  state.textContent = error ? 'Fallback aktiv' : `${(data || []).length} Socials in DB`;

  document.querySelectorAll('.social-save').forEach(btn => {
    btn.onclick = async () => {
      const row = btn.closest('.social-admin-row');
      const platform = row.dataset.social;
      const url = row.querySelector('.social-url').value.trim();
      const enabled = row.querySelector('.social-enabled').checked;
      if (!isSafeHttpUrl(url)) return message('social-message', 'Bitte eine gültige http(s)-URL verwenden.');

      const patch = { platform, label: platform === 'twitch' ? 'Twitch' : platform === 'tiktok' ? 'TikTok' : 'WhatsApp', url, enabled, sort_order: platform === 'twitch' ? 1 : platform === 'tiktok' ? 2 : 3, updated_at: new Date().toISOString() };
      const result = await supabaseClient.from('social_links').upsert(patch, { onConflict: 'platform' });
      if (result.error) message('social-message', result.error.message);
      else { message('social-message', `${patch.label} gespeichert.`, true); saveStamp(); await loadSocials(); }
    };
  });

  document.querySelectorAll('.social-delete').forEach(btn => {
    btn.onclick = async () => {
      const row = btn.closest('.social-admin-row');
      const platform = row.dataset.social;
      if (!confirm(`${platform} wirklich löschen?`)) return;
      const result = await supabaseClient.from('social_links').delete().eq('platform', platform);
      if (result.error) message('social-message', result.error.message);
      else { message('social-message', 'Social gelöscht.', true); saveStamp(); await loadSocials(); }
    };
  });
}

async function loadGames() {
  const fallback = {
    'Fortnite': { description: 'Main Game · Ranked · Community', enabled: true, featured: true, image_url: 'https://cdn.startselect.com/production/blog/preview-images/new-fortnite-season.jpg', sort_order: 1 },
    'GTA V': { description: 'Open World · Aktuell · Fun', enabled: true, featured: false, image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg', sort_order: 2 },
    'Thick As Thieves': { description: 'Stealth · Heist · Community', enabled: true, featured: false, image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg', sort_order: 3 }
  };

  // Remove discontinued game in the current DB if it still exists.
  await supabaseClient
    .from('games')
    .delete()
    .ilike('name', '%meccha%');

  const { data, error } = await supabaseClient
    .from('games')
    .select('*')
    .order('sort_order');

  const byName = new Map((data || []).map(row => [row.name, row]));

  document.querySelectorAll('.game-admin-row').forEach(row => {
    const name = row.dataset.game;
    const seed = fallback[name];
    const db = byName.get(name);
    if (!seed) return;

    row.querySelector('.game-description').value = db?.description || seed.description;
    row.querySelector('.game-enabled').checked = db?.enabled !== false;
    row.querySelector('.game-featured').checked = db?.featured === true || (!db && seed.featured);
    row.dataset.dbId = db?.id || '';
  });

  const state = $('games-db-state');
  state.textContent = error ? 'Fallback aktiv' : `${['Fortnite','GTA V','Thick As Thieves'].filter(n => byName.has(n)).length} Games in DB`;

  document.querySelectorAll('.game-save').forEach(btn => {
    btn.onclick = async () => {
      const row = btn.closest('.game-admin-row');
      const name = row.dataset.game;
      const seed = fallback[name];
      const description = row.querySelector('.game-description').value.trim();
      const enabled = row.querySelector('.game-enabled').checked;
      const featured = row.querySelector('.game-featured').checked;

      const result = await supabaseClient.from('games').upsert({
        name,
        description: description || seed.description,
        tag: name === 'Fortnite' ? 'MAIN GAME' : name === 'GTA V' ? 'AKTUELL' : 'VARIETY',
        image_url: seed.image_url,
        enabled,
        featured,
        sort_order: seed.sort_order,
        updated_at: new Date().toISOString()
      }, { onConflict: 'name' });

      if (result.error) message('games-message', result.error.message);
      else { message('games-message', `${name} gespeichert.`, true); saveStamp(); await loadGames(); }
    };
  });

  document.querySelectorAll('.game-delete').forEach(btn => {
    btn.onclick = async () => {
      const row = btn.closest('.game-admin-row');
      const name = row.dataset.game;
      if (!confirm(`${name} wirklich löschen?`)) return;
      const result = await supabaseClient.from('games').delete().eq('name', name);
      if (result.error) message('games-message', result.error.message);
      else { message('games-message', `${name} gelöscht.`, true); saveStamp(); await loadGames(); }
    };
  });
}


async function addGame() {
  const name = $('new-game-name').value.trim();
  const tag = $('new-game-tag').value.trim() || 'VARIETY';
  const description = $('new-game-description').value.trim() || tag;
  if (!name) return message('games-message', 'Bitte einen Namen eingeben.');

  const maxOrder = Math.max(0, ...cachedGames.map(g => Number(g.sort_order) || 0));
  const { error } = await supabaseClient.from('games').upsert({
    name,
    tag,
    description,
    image_url: null,
    featured: false,
    enabled: true,
    sort_order: maxOrder + 1,
    updated_at: new Date().toISOString()
  }, { onConflict: 'name' });

  if (error) message('games-message', error.message);
  else {
    $('new-game-name').value = '';
    $('new-game-tag').value = '';
    $('new-game-description').value = '';
    message('games-message', 'Game hinzugefügt.', true);
    saveStamp();
    await loadGames();
  }
}

async function addSocial() {
  const platform = $('new-social-platform').value.trim().toLowerCase();
  const label = $('new-social-label').value.trim() || platform;
  const url = $('new-social-url').value.trim();
  if (!platform || !url) return message('social-message', 'Plattform und URL sind erforderlich.');
  if (!isSafeHttpUrl(url)) return message('social-message', 'Bitte eine gültige http(s)-URL verwenden.');

  const { data: maxRows } = await supabaseClient
    .from('social_links').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const sortOrder = Number(maxRows?.[0]?.sort_order || 0) + 1;

  const { error } = await supabaseClient.from('social_links').upsert({
    platform, label, url, enabled: true, sort_order: sortOrder,
    updated_at: new Date().toISOString()
  }, { onConflict: 'platform' });

  if (error) message('social-message', error.message);
  else {
    $('new-social-platform').value = '';
    $('new-social-label').value = '';
    $('new-social-url').value = '';
    message('social-message', 'Social-Link hinzugefügt.', true);
    saveStamp();
    await loadSocials();
  }
}


async function cleanupMecchaRows() {
  const { error } = await supabaseClient
    .from('games')
    .delete()
    .ilike('name', '%meccha%');

  if (error) {
    message('games-message', error.message);
    return;
  }
  message('games-message', 'Alte „Meccha“-Einträge wurden gelöscht.', true);
  saveStamp();
  await loadGames();
}
async function loadTwitchStatus() {
  try {
    const r = await fetch('/api/twitch-status', { cache: 'no-store' });
    const d = await r.json();
    $('dash-live').textContent = d.live ? 'LIVE' : 'Offline';
    $('dash-game').textContent = d.game || '–';
    $('dash-viewers').textContent = d.viewerCount != null ? Number(d.viewerCount).toLocaleString('de-DE') : '–';
    $('system-twitch').textContent = d.error ? 'Fehler' : 'OK';
  } catch {
    $('dash-live').textContent = '–';
    $('dash-game').textContent = '–';
    $('dash-viewers').textContent = '–';
    $('system-twitch').textContent = 'Fehler';
  }
}

function renderGameOptions() {
  const select = $('media-game');
  if (!select) return;
  select.innerHTML = cachedGames.map(game =>
    `<option value="${game.id}">${escapeHtml(game.name)}</option>`
  ).join('');
}

async function loadMediaPreview() {
  const list = $('media-preview');
  if (!list) return;

  try {
    const { data, error } = await supabaseClient
      .storage
      .from('site-media')
      .list('site', { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;

    list.innerHTML = '';
    for (const item of data || []) {
      if (!item.name) continue;
      const path = `site/${item.name}`;
      const { data: publicData } = supabaseClient.storage.from('site-media').getPublicUrl(path);
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <img src="${escapeAttr(publicData.publicUrl)}" alt="">
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.created_at ? new Date(item.created_at).toLocaleString('de-DE') : '')}</small></div>
      `;
      list.appendChild(card);
    }

    if (!list.children.length) {
      list.innerHTML = '<div class="admin-empty">Noch keine Uploads.</div>';
    }
  } catch (error) {
    list.innerHTML = `<div class="admin-empty">Media Library noch nicht eingerichtet: ${escapeHtml(error.message)}</div>`;
  }
}

async function uploadMedia() {
  const file = $('media-file')?.files?.[0];
  if (!file) return message('media-message', 'Bitte zuerst ein Bild auswählen.');

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
  if (!allowed.includes(file.type)) return message('media-message', 'Nur PNG, JPG, WebP oder AVIF.');
  if (file.size > 6 * 1024 * 1024) return message('media-message', 'Bitte ein Bild unter 6 MB verwenden.');

  const use = $('media-use').value;
  const suffix = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
  const base = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g,'') || 'bild';
  const path = `site/${Date.now()}-${base}.${suffix}`;

  const button = $('upload-media-btn');
  button.disabled = true;
  button.textContent = 'Upload läuft…';

  try {
    const { error: uploadError } = await supabaseClient
      .storage
      .from('site-media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseClient.storage.from('site-media').getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    if (use === 'hero') {
      const { error } = await supabaseClient
        .from('site_settings')
        .update({ hero_image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (error) throw error;
      $('hero-image-url').value = publicUrl;
      $('hero-preview-image').src = publicUrl;
      message('media-message', 'Hero-Bild hochgeladen und aktiviert.', true);
    } else if (use === 'game') {
      const gameId = $('media-game').value;
      const { error } = await supabaseClient
        .from('games')
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', gameId);
      if (error) throw error;
      message('media-message', 'Game-Bild hochgeladen und verknüpft.', true);
      await loadGames();
    } else {
      message('media-message', `Bild hochgeladen: ${publicUrl}`, true);
    }

    saveStamp();
    $('media-file').value = '';
    await loadMediaPreview();
  } catch (error) {
    message('media-message', `Upload fehlgeschlagen: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Bild hochladen';
  }
}

async function resetPassword() {
  const password = $('new-password').value;
  const confirmPassword = $('new-password-confirm').value;

  if (password.length < 10) return message('password-message', 'Bitte mindestens 10 Zeichen verwenden.');
  if (password !== confirmPassword) return message('password-message', 'Die Passwörter stimmen nicht überein.');

  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) message('password-message', error.message);
  else {
    $('new-password').value = '';
    $('new-password-confirm').value = '';
    message('password-message', 'Passwort erfolgreich geändert.', true);
    saveStamp();
  }
}

function bindAdminEvents() {
  $('login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    message('login-message', 'Anmeldung läuft…', true);

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: $('email').value.trim(),
        password: $('password').value
      });
      if (error) throw error;

      if (!(await isAdmin(data.user))) {
        await supabaseClient.auth.signOut();
        throw new Error('Dieses Konto ist nicht als Admin freigeschaltet.');
      }

      currentUser = data.user;
      await ensureDefaultContent();
      $('login-card').hidden = true;
      $('dashboard').hidden = false;
      $('logout-btn').hidden = false;
      bindTabs();
      await loadDashboard();
    } catch (error) {
      message('login-message', error.message || 'Login fehlgeschlagen.');
    }
  });

  $('logout-btn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  $('settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      hero_kicker: $('hero-kicker').value.trim(),
      hero_title: $('hero-title').value.trim(),
      hero_description: $('hero-description').value.trim(),
      about_text: $('about-text').value.trim(),
      community_text: $('community-text').value.trim(),
      hero_image_url: $('hero-image-url').value.trim(),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('site_settings')
      .update(payload)
      .eq('id', true);

    if (error) {
      message('settings-message', error.message);
    } else {
      message('settings-message', 'Website-Inhalte gespeichert.', true);
      updatePreview(payload);
      saveStamp();
    }
  });

  $('add-game-btn')?.addEventListener('click', addGame);
$('cleanup-meccha-btn')?.addEventListener('click', cleanupMecchaRows);
  $('add-social-btn')?.addEventListener('click', addSocial);
  $('upload-media-btn')?.addEventListener('click', uploadMedia);

  $('media-use')?.addEventListener('change', () => {
    $('media-game-row').hidden = $('media-use').value !== 'game';
  });

  $('password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await resetPassword();
  });

}

async function initializeAdmin() {
  const status = $('admin-init-status');
  const submit = $('login-submit');

  try {
    status.textContent = 'Supabase wird verbunden…';
    status.classList.remove('error', 'success');

    await loadConfig();

    status.textContent = 'Supabase verbunden.';
    status.classList.add('success');
    submit.disabled = false;

    const { data } = await supabaseClient.auth.getSession();
    const user = data?.session?.user;

    bindAdminEvents();

    if (user && await isAdmin(user)) {
      currentUser = user;
      await ensureDefaultContent();
      $('login-card').hidden = true;
      $('dashboard').hidden = false;
      $('logout-btn').hidden = false;
      bindTabs();
      await loadDashboard();
    } else {
      bindTabs();
    }
  } catch (error) {
    console.error('Admin initialization failed:', error);
    status.textContent = error.message || 'Supabase konnte nicht initialisiert werden.';
    status.classList.add('error');
    submit.disabled = true;
    message('login-message', 'Admin konnte nicht gestartet werden. Prüfe die Browser-Konsole auf den genauen Fehler.');
  }
}

initializeAdmin();
