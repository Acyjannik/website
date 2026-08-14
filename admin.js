let supabaseClient = null;

const $ = (id) => document.getElementById(id);

async function loadConfig() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  const config = await response.json();

  if (!config.configured) {
    throw new Error('Supabase ist noch nicht in Vercel konfiguriert.');
  }

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

async function isAdmin(user) {
  if (!user) return false;
  const { data, error } = await supabaseClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return !error && !!data;
}

async function loadDashboard() {
  const { data: settings, error: settingsError } = await supabaseClient
    .from('site_settings')
    .select('*')
    .eq('id', true)
    .single();

  if (settingsError) {
    message('dash-message', 'Datenbank ist noch nicht eingerichtet.');
    return;
  }

  $('hero-kicker').value = settings.hero_kicker || '';
  $('hero-title').value = settings.hero_title || '';
  $('hero-description').value = settings.hero_description || '';
  $('about-text').value = settings.about_text || '';
  $('community-text').value = settings.community_text || '';
  $('hero-image-url').value = settings.hero_image_url || '';

  await Promise.all([loadSocials(), loadGames(), loadTwitchStatus()]);
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

  $('social-list').innerHTML = '';
  for (const item of data || []) {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.platform)}</small>
      </div>
      <input data-social-url="${item.id}" value="${escapeAttr(item.url)}">
      <label class="admin-check"><input type="checkbox" data-social-enabled="${item.id}" ${item.enabled ? 'checked' : ''}> aktiv</label>
      <button class="button button-small" data-save-social="${item.id}">Speichern</button>
    `;
    $('social-list').appendChild(row);
  }

  $('social-list').querySelectorAll('[data-save-social]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.saveSocial;
      const url = $('social-list').querySelector(`[data-social-url="${id}"]`).value.trim();
      const enabled = $('social-list').querySelector(`[data-social-enabled="${id}"]`).checked;
      const { error } = await supabaseClient
        .from('social_links')
        .update({ url, enabled, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) message('social-message', error.message);
      else message('social-message', 'Social-Link gespeichert.', true);
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

  $('games-list').innerHTML = '';
  for (const item of data || []) {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.description || item.tag || '')}</small>
      </div>
      <label class="admin-check"><input type="checkbox" data-game-enabled="${item.id}" ${item.enabled ? 'checked' : ''}> sichtbar</label>
      <label class="admin-check"><input type="checkbox" data-game-featured="${item.id}" ${item.featured ? 'checked' : ''}> Main Game</label>
      <button class="button button-small button-danger" data-delete-game="${item.id}">Löschen</button>
    `;
    $('games-list').appendChild(row);
  }

  $('games-list').querySelectorAll('[data-delete-game]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.deleteGame;
      if (!confirm('Game wirklich löschen?')) return;
      const { error } = await supabaseClient.from('games').delete().eq('id', id);
      if (error) message('games-message', error.message);
      else await loadGames();
    });
  });

  $('games-list').querySelectorAll('[data-game-enabled], [data-game-featured]').forEach((input) => {
    input.addEventListener('change', async () => {
      const id = input.dataset.gameEnabled || input.dataset.gameFeatured;
      const enabledEl = $('games-list').querySelector(`[data-game-enabled="${id}"]`);
      const featuredEl = $('games-list').querySelector(`[data-game-featured="${id}"]`);
      const { error } = await supabaseClient
        .from('games')
        .update({
          enabled: enabledEl.checked,
          featured: featuredEl.checked,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) message('games-message', error.message);
      else message('games-message', 'Game gespeichert.', true);
    });
  });
}

async function loadTwitchStatus() {
  try {
    const r = await fetch('/api/twitch-status', { cache: 'no-store' });
    const d = await r.json();
    $('dash-live').textContent = d.live ? 'LIVE' : 'Offline';
    $('dash-game').textContent = d.game || '–';
    $('dash-viewers').textContent = d.viewerCount != null ? Number(d.viewerCount).toLocaleString('de-DE') : '–';
  } catch {
    $('dash-live').textContent = '–';
    $('dash-game').textContent = '–';
    $('dash-viewers').textContent = '–';
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

    $('login-card').hidden = true;
    $('dashboard').hidden = false;
    $('logout-btn').hidden = false;
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

  message('settings-message', error ? error.message : 'Website-Inhalte gespeichert.', !error);
});

$('add-game-btn')?.addEventListener('click', async () => {
  const name = $('new-game-name').value.trim();
  const tag = $('new-game-tag').value.trim() || 'VARIETY';
  if (!name) return;

  const { data: existing } = await supabaseClient
    .from('games').select('sort_order').order('sort_order', { ascending: false }).limit(1);

  const sort = (existing?.[0]?.sort_order || 0) + 1;
  const { error } = await supabaseClient.from('games').insert({
    name, tag, description: tag, sort_order: sort
  });

  if (error) {
    message('games-message', error.message);
  } else {
    $('new-game-name').value = '';
    $('new-game-tag').value = '';
    await loadGames();
  }
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}
function escapeAttr(value = '') {
  return escapeHtml(value);
}

(async () => {
  try {
    await loadConfig();
    const { data } = await supabaseClient.auth.getSession();
    const user = data?.session?.user;

    if (user && await isAdmin(user)) {
      $('login-card').hidden = true;
      $('dashboard').hidden = false;
      $('logout-btn').hidden = false;
      await loadDashboard();
    }
  } catch (error) {
    message('login-message', error.message || 'Admin konnte nicht initialisiert werden.');
  }
})();
