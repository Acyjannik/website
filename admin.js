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
  const response = await fetch('/api/config', { cache: 'no-store' });
  const config = await response.json();

  if (!config.configured) throw new Error('Supabase ist noch nicht in Vercel konfiguriert.');

  supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );
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
  const { data, error } = await supabaseClient
    .from('social_links')
    .select('*')
    .order('sort_order');

  if (error) {
    message('social-message', error.message);
    return;
  }

  const list = $('social-list');
  list.innerHTML = '';

  for (const item of data || []) {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <div class="admin-row-main">
        <span class="admin-icon">${escapeHtml(String(item.platform).slice(0,2).toUpperCase())}</span>
        <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.platform)}</small></div>
      </div>
      <input data-social-url="${item.id}" value="${escapeAttr(item.url)}">
      <label class="admin-check"><input type="checkbox" data-social-enabled="${item.id}" ${item.enabled ? 'checked' : ''}> aktiv</label>
      <button class="button button-small" data-save-social="${item.id}">Speichern</button>
      <button class="button button-small button-danger" data-delete-social="${item.id}">Löschen</button>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('[data-save-social]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.saveSocial;
      const url = list.querySelector(`[data-social-url="${id}"]`).value.trim();
      const enabled = list.querySelector(`[data-social-enabled="${id}"]`).checked;

      if (!isSafeHttpUrl(url)) {
        message('social-message', 'Bitte eine gültige http(s)-URL verwenden.');
        return;
      }

      const { error } = await supabaseClient
        .from('social_links')
        .update({ url, enabled, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) message('social-message', error.message);
      else {
        message('social-message', 'Social-Link gespeichert.', true);
        saveStamp();
      }
    });
  });

  list.querySelectorAll('[data-delete-social]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteSocial;
      if (!confirm('Social-Link wirklich löschen?')) return;
      const { error } = await supabaseClient.from('social_links').delete().eq('id', id);
      if (error) message('social-message', error.message);
      else {
        message('social-message', 'Social-Link gelöscht.', true);
        saveStamp();
        await loadSocials();
      }
    });
  });
}

async function loadGames() {
  const { data, error } = await supabaseClient
    .from('games')
    .select('*')
    .order('sort_order');

  if (error) {
    message('games-message', error.message);
    return;
  }

  cachedGames = data || [];
  renderGameOptions();
  const list = $('games-list');
  list.innerHTML = '';

  for (let i = 0; i < cachedGames.length; i++) {
    const item = cachedGames[i];
    const row = document.createElement('div');
    row.className = 'admin-list-row admin-game-row';
    row.innerHTML = `
      <div class="admin-row-main">
        <span class="admin-rank">${String(i+1).padStart(2,'0')}</span>
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || item.tag || '')}</small></div>
      </div>
      <input data-game-description="${item.id}" value="${escapeAttr(item.description || '')}" placeholder="Beschreibung">
      <label class="admin-check"><input type="checkbox" data-game-enabled="${item.id}" ${item.enabled ? 'checked' : ''}> sichtbar</label>
      <label class="admin-check"><input type="radio" name="featured-game" data-game-featured="${item.id}" ${item.featured ? 'checked' : ''}> Main Game</label>
      <div class="admin-row-actions">
        <button class="button button-small" data-game-up="${item.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="button button-small" data-game-down="${item.id}" ${i === cachedGames.length-1 ? 'disabled' : ''}>↓</button>
        <button class="button button-small" data-game-save="${item.id}">Speichern</button>
        <button class="button button-small button-danger" data-delete-game="${item.id}">Löschen</button>
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('[data-game-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.gameSave;
      const desc = list.querySelector(`[data-game-description="${id}"]`).value.trim();
      const enabled = list.querySelector(`[data-game-enabled="${id}"]`).checked;
      const featured = list.querySelector(`[data-game-featured="${id}"]`).checked;
      await updateGame(id, { description: desc, enabled, featured });
    });
  });

  list.querySelectorAll('[data-game-enabled], [data-game-featured]').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.dataset.gameEnabled || input.dataset.gameFeatured;
      const enabledEl = list.querySelector(`[data-game-enabled="${id}"]`);
      const featuredEl = list.querySelector(`[data-game-featured="${id}"]`);
      await updateGame(id, {
        enabled: enabledEl.checked,
        featured: featuredEl.checked
      });
    });
  });

  list.querySelectorAll('[data-game-up]').forEach(btn => btn.addEventListener('click', () => moveGame(btn.dataset.gameUp, -1)));
  list.querySelectorAll('[data-game-down]').forEach(btn => btn.addEventListener('click', () => moveGame(btn.dataset.gameDown, 1)));

  list.querySelectorAll('[data-delete-game]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Game wirklich löschen?')) return;
      const { error } = await supabaseClient.from('games').delete().eq('id', btn.dataset.deleteGame);
      if (error) message('games-message', error.message);
      else {
        message('games-message', 'Game gelöscht.', true);
        saveStamp();
        await loadGames();
      }
    });
  });
}

async function updateGame(id, patch) {
  const { error } = await supabaseClient
    .from('games')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) message('games-message', error.message);
  else {
    message('games-message', 'Game gespeichert.', true);
    saveStamp();
    await loadGames();
  }
}

async function moveGame(id, direction) {
  const index = cachedGames.findIndex(g => String(g.id) === String(id));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= cachedGames.length) return;

  const a = cachedGames[index];
  const b = cachedGames[target];
  const aOrder = a.sort_order;
  const bOrder = b.sort_order;

  const first = await supabaseClient.from('games').update({ sort_order: bOrder }).eq('id', a.id);
  if (first.error) return message('games-message', first.error.message);
  const second = await supabaseClient.from('games').update({ sort_order: aOrder }).eq('id', b.id);
  if (second.error) return message('games-message', second.error.message);

  saveStamp();
  await loadGames();
}

async function addGame() {
  const name = $('new-game-name').value.trim();
  const tag = $('new-game-tag').value.trim() || 'VARIETY';
  const description = $('new-game-description').value.trim() || tag;
  if (!name) return message('games-message', 'Bitte einen Namen eingeben.');

  const maxOrder = Math.max(0, ...cachedGames.map(g => Number(g.sort_order) || 0));
  const { error } = await supabaseClient.from('games').insert({
    name, tag, description, sort_order: maxOrder + 1
  });

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

  const { error } = await supabaseClient.from('social_links').insert({
    platform, label, url, sort_order: sortOrder
  });

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
$('add-social-btn')?.addEventListener('click', addSocial);
$('upload-media-btn')?.addEventListener('click', uploadMedia);

$('media-use')?.addEventListener('change', () => {
  $('media-game-row').hidden = $('media-use').value !== 'game';
});

$('password-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await resetPassword();
});

(async () => {
  try {
    await loadConfig();
    const { data } = await supabaseClient.auth.getSession();
    const user = data?.session?.user;

    if (user && await isAdmin(user)) {
      currentUser = user;
      $('login-card').hidden = true;
      $('dashboard').hidden = false;
      $('logout-btn').hidden = false;
      bindTabs();
      await loadDashboard();
    } else {
      bindTabs();
    }
  } catch (error) {
    message('login-message', error.message || 'Admin konnte nicht initialisiert werden.');
  }
})();
