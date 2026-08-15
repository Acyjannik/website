
let supabaseClient = null;
let currentUser = null;
let cachedGames = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[ch]));
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

const VIEW_META = {
  overview: ['OVERVIEW', 'Dashboard'],
  content: ['WEBSITE', 'Website'],
  games: ['CONTENT', 'Games'],
  socials: ['COMMUNITY', 'Socials'],
  events: ['COMMUNITY', 'Events'],
  news: ['CONTENT', 'News'],
  progression: ['MEMBERS', 'XP & Badges'],
  spotlight: ['COMMUNITY', 'Spotlight'],
  polls: ['COMMUNITY', 'Community Votes'],
  clips: ['ACY CLIPS', 'Clips'],
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
  // spotlight lazy-load
  if (tab === 'progression' && supabaseClient) {
    loadBadgeMembers().catch(error => console.error('Badge member load error:', error));
  }
  if (tab === 'spotlight' && supabaseClient) {
    loadSpotlightAdmin().catch(error => {
      const el = $('spotlight-admin-message');
      if (el) el.textContent = error.message || 'Spotlight konnte nicht geladen werden.';
      console.error('Spotlight load error:', error);
    });
  }
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
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-jump]').forEach(btn => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => switchTab(btn.dataset.jump));
  });
  const initial = location.hash.replace('#', '');
  if (VIEW_META[initial]) switchTab(initial);
}


async function ensureDefaultContent() {
  const defaultSocials = [
    { platform: 'twitch', label: 'Twitch', url: 'https://www.twitch.tv/acyjannik', sort_order: 1 },
    { platform: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@acyjannik', sort_order: 2 },
    { platform: 'whatsapp', label: 'WhatsApp', url: 'https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10', sort_order: 3 },
    { platform: 'discord', label: 'Discord', url: 'https://discord.gg/74ACqBwfu', sort_order: 4 }
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
    if (!current.image_url) patch.image_url = seed.image_url;
    if (current.sort_order == null) patch.sort_order = seed.sort_order;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await supabaseClient.from('games').update(patch).eq('id', current.id);
    }
  }
}

async function loadSpotlightAdmin() {
  const list = $('spotlight-admin-list');
  if (!list) return;
  list.innerHTML = '<div class="admin-note">Mitglieder werden geladen…</div>';

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token || '';
  const [membersRes, spotlightRes] = await Promise.all([
    fetch('/api/club-members?includeAchievements=true', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    }),
    fetch('/api/club-spotlight', { cache: 'no-store' })
  ]);

  const membersPayload = membersRes.ok ? await membersRes.json() : { members: [] };
  const members = membersPayload.members || [];
  const spotlightPayload = spotlightRes.ok ? await spotlightRes.json() : { spotlight: null };
  const current = spotlightPayload.spotlight;
  if (current?.member) {
    $('spotlight-current-name').textContent = current.member.display_name || current.member.username;
    $('spotlight-current-note').textContent = current.note || 'Aktives Community Spotlight.';
    $('spotlight-current-meta').textContent = `${Number(current.member.xp || 0)} XP · @${current.member.username || ''}`;
  } else {
    $('spotlight-current-name').textContent = 'Noch niemand';
    $('spotlight-current-note').textContent = 'Kein aktives Spotlight.';
    $('spotlight-current-meta').textContent = '–';
  }

  renderSpotlightCandidates(members, current?.user_id || '');
}

function renderSpotlightCandidates(members, currentId = '') {
  const list = $('spotlight-admin-list');
  if (!list) return;
  const query = String($('spotlight-search')?.value || '').trim().toLowerCase();
  const filtered = members.filter(m => {
    const hay = `${m.display_name || ''} ${m.username || ''}`.toLowerCase();
    return !query || hay.includes(query);
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="admin-note">Keine Mitglieder gefunden.</div>';
    return;
  }

  list.innerHTML = filtered.map(m => {
    const name = escapeHtml(m.display_name || m.username || 'Member');
    const username = escapeHtml(m.username || '');
    const bio = escapeHtml(m.bio || '');
    const avatar = m.avatar_url ? `<img src="${escapeAttr(m.avatar_url)}" alt="">` : `<span class="spotlight-avatar-fallback">${escapeHtml((m.display_name || m.username || 'A').charAt(0).toUpperCase())}</span>`;
    const active = m.id === currentId ? ' is-current' : '';
    return `<div class="spotlight-admin-row${active}" data-member-id="${escapeAttr(m.id)}">
      <div class="spotlight-admin-person">${avatar}<div><strong>${name}</strong><small>@${username} · ${Number(m.xp || 0)} XP</small>${bio ? `<p>${bio}</p>` : ''}</div></div>
      <button class="button button-small spotlight-select">Als Spotlight setzen</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.spotlight-select').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.spotlight-admin-row');
      await setSpotlight(row.dataset.memberId);
    });
  });
}

async function setSpotlight(userId) {
  const status = $('spotlight-admin-message');
  const note = window.prompt('Kurze Begründung für das Spotlight (optional):', 'Besonders aktiv und ein großartiger Teil der ACY Community.');
  if (note === null) return;
  status.textContent = 'Spotlight wird gespeichert…';

  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    const response = await fetch('/api/club-spotlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ userId, note, action: 'set' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Spotlight konnte nicht gespeichert werden.');
    status.textContent = 'Spotlight gespeichert.';
    status.classList.add('success');
    await loadSpotlightAdmin();
  await loadBadgeMembers();
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
  }
}

async function clearSpotlight() {
  if (!window.confirm('Aktuelles Spotlight wirklich entfernen?')) return;
  const status = $('spotlight-admin-message');
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    const response = await fetch('/api/club-spotlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'clear' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Spotlight konnte nicht entfernt werden.');
    status.textContent = 'Spotlight entfernt.';
    await loadSpotlightAdmin();
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
  }
}

async function refreshAllAchievements() {
  const button = $('refresh-badges-btn');
  if (button) { button.disabled = true; button.textContent = 'Aktualisiere…'; }
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    const response = await fetch('/api/club-achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ all: true })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Achievements konnten nicht aktualisiert werden.');
    await loadBadgeMembers();
    const status = $('spotlight-admin-message');
    if (status) status.textContent = `${payload.updated || 0} Mitglieder geprüft.`;
  } catch (error) {
    const status = $('spotlight-admin-message');
    if (status) { status.textContent = error.message; status.classList.add('error'); }
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Achievements aktualisieren'; }
  }
}

function bindSpotlightAdmin() {
  if ($('spotlight-refresh')?.dataset.bound === 'true') return;
  $('spotlight-refresh')?.setAttribute('data-bound','true');
  $('spotlight-refresh')?.addEventListener('click', loadSpotlightAdmin);
  $('refresh-badges-btn')?.addEventListener('click', refreshAllAchievements);
  $('progression-search')?.addEventListener('input', () => loadBadgeMembers());
  $('spotlight-clear')?.addEventListener('click', clearSpotlight);
  $('spotlight-search')?.addEventListener('input', () => loadSpotlightAdmin());
}


async function loadBadgeMembers() {
  const list = $('badges-member-list');
  if (!list || !supabaseClient) return;
  list.innerHTML = '<div class="admin-note">Mitglieder werden geladen…</div>';

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token || '';
    const response = await fetch('/api/club-members?includeAchievements=true', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Mitglieder konnten nicht geladen werden.');

    const names = {
      acy_rookie: 'ACY Rookie',
      profile_complete: 'Profile Complete',
      discord_member: 'Discord Member',
      event_fan: 'Event Fan',
      event_hunter: 'Event Hunter',
      event_regular: 'Event Regular',
      event_legend: 'Event Legend',
      xp_100: '100 XP Club',
      xp_500: '500 XP Club',
      xp_1000: '1000 XP Club',
      acy_og: 'ACY OG',
      acy_legend: 'ACY Legend',
      early_member: 'Early Member',
      veteran_member: 'ACY Veteran'
    };
    const icons = {
      acy_rookie:'💜', profile_complete:'✨', discord_member:'💬',
      event_fan:'🎮', event_hunter:'🔥', event_regular:'⚡', event_legend:'🏆',
      xp_100:'🌟', xp_500:'👑', xp_1000:'💎', acy_og:'👑', acy_legend:'🏆',
      early_member:'⏳', veteran_member:'🛡️'
    };

    const allMembers = (payload.members || []).sort((a,b) => Number(b.xp||0)-Number(a.xp||0));
    const totalXp = allMembers.reduce((sum, member) => sum + Number(member.xp || 0), 0);
    const totalBadges = allMembers.reduce((sum, member) => sum + (member.achievements || []).length, 0);
    const search = ($('progression-search')?.value || '').trim().toLowerCase();
    const members = search ? allMembers.filter(member => `${member.display_name || ''} ${member.username || ''}`.toLowerCase().includes(search)) : allMembers;
    if ($('progression-count')) $('progression-count').textContent = `${members.length} / ${allMembers.length} Mitglieder`;
    if ($('progression-total-xp')) $('progression-total-xp').textContent = `${totalXp.toLocaleString('de-DE')} XP`;
    if ($('progression-badges-total')) $('progression-badges-total').textContent = `${totalBadges.toLocaleString('de-DE')} Achievements`;
    if (!members.length) {
      list.innerHTML = '<div class="admin-note">Noch keine Mitglieder vorhanden.</div>';
      return;
    }

    list.innerHTML = members.map(member => {
      const badges = (member.achievements || []).map(key =>
        `<span class="earned-badge" title="${escapeAttr(names[key] || key)}">${icons[key] || '🏅'} ${escapeHtml(names[key] || key)}</span>`
      ).join('');
      return `<div class="badge-member-row">
        <div class="badge-member-person">
          ${member.avatar_url ? `<img src="${escapeAttr(member.avatar_url)}" alt="">` : `<span class="spotlight-avatar-fallback">${escapeHtml((member.display_name || member.username || 'A').charAt(0).toUpperCase())}</span>`}
          <div><strong>${escapeHtml(member.display_name || member.username || 'Member')}</strong><small>@${escapeHtml(member.username || '')} · ${Number(member.xp||0)} XP</small></div>
        </div>
        <div class="earned-badges">${badges || '<span class="admin-note">Noch keine Achievements</span>'}</div>
      </div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `<div class="admin-note error">${escapeHtml(error.message || 'Achievements konnten nicht geladen werden.')}</div>`;
  }
}

async function safeCount(table, column = '*', extra = {}) {
  try {
    let query = supabaseClient.from(table).select(column, { count: 'exact', head: true });
    for (const [key, value] of Object.entries(extra)) query = query.eq(key, value);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.warn(`Admin count ${table} failed:`, error.message);
    return null;
  }
}

async function loadDashboardStats() {
  const [members, xpRows, badges, polls, upcoming] = await Promise.all([
    safeCount('profiles'),
    supabaseClient.from('profiles').select('xp'),
    safeCount('club_achievements'),
    safeCount('club_polls', '*', { active: true }),
    supabaseClient.from('club_events').select('id', { count: 'exact', head: true }).gte('event_date', new Date().toISOString()).eq('enabled', true)
  ]);

  if ($('dash-members')) $('dash-members').textContent = members == null ? '–' : members.toLocaleString('de-DE');
  const totalXp = xpRows?.error ? null : (xpRows.data || []).reduce((sum, row) => sum + Number(row.xp || 0), 0);
  if ($('dash-xp-total')) $('dash-xp-total').textContent = totalXp == null ? '–' : totalXp.toLocaleString('de-DE');
  if ($('dash-badges-total')) $('dash-badges-total').textContent = badges == null ? '–' : badges.toLocaleString('de-DE');
  if ($('dash-poll')) $('dash-poll').textContent = polls == null ? '–' : (polls ? 'Aktiv' : 'Keine');
  if ($('dash-poll-detail')) $('dash-poll-detail').textContent = polls == null ? '–' : (polls ? 'Aktiv' : 'Keine');
  const upcomingCount = upcoming?.error ? null : (upcoming.count || 0);
  if ($('dash-events')) $('dash-events').textContent = upcomingCount == null ? '–' : upcomingCount.toLocaleString('de-DE');

  try {
    const { data } = await supabaseClient.from('club_polls').select('question').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if ($('dash-poll-detail')) $('dash-poll-detail').textContent = data?.question || 'Keine';
  } catch {}

  try {
    const response = await fetch('/api/club-spotlight', { cache: 'no-store' });
    const payload = response.ok ? await response.json() : {};
    const name = payload?.spotlight?.display_name || payload?.spotlight?.username || 'Kein Spotlight';
    if ($('dash-spotlight')) $('dash-spotlight').textContent = name;
  } catch {
    if ($('dash-spotlight')) $('dash-spotlight').textContent = '–';
  }

  const attention = [];
  if (members === 0) attention.push('Noch keine Mitglieder');
  if (polls === 0) attention.push('Keine aktive Community-Umfrage');
  if ($('system-twitch')?.textContent === 'Fehler') attention.push('Twitch API prüfen');
  if ($('dash-attention')) $('dash-attention').textContent = attention.length ? `Hinweis: ${attention.join(' · ')}` : 'Alles sieht gut aus.';
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

  await loadDashboardStats();

  await Promise.all([
    loadSocials(),
    loadGames(),
    loadTwitchStatus(),
    loadEventsAdmin(),
    loadNewsAdmin(),
    loadClipsAdmin(),
    loadPollsAdmin(),
  ]);
  await loadSpotlightAdmin();

  await loadMediaPreview();
}

function updatePreview(settings) {
  $('hero-preview-title').textContent = settings.hero_title || 'ACYJANNIK';
  $('hero-preview-description').textContent = settings.hero_description || '';
  $('hero-preview-image').src = settings.hero_image_url || '/assets/acyjannik-hero.png';
}

async function loadSocials() {
  const list = $('social-admin-list');
  if (!list) return;
  const { data, error } = await supabaseClient.from('social_links').select('*').order('sort_order');
  if (error) {
    list.innerHTML = `<div class="admin-empty">Social Links konnten nicht geladen werden: ${escapeHtml(error.message)}</div>`;
    $('socials-db-state').textContent = 'Fehler';
    return;
  }
  const rows = data || [];
  $('socials-db-state').textContent = `${rows.length} Links in der DB`;
  if (!rows.length) {
    list.innerHTML = '<div class="admin-empty">Noch keine Social Links vorhanden.</div>';
    return;
  }
  list.innerHTML = rows.map(row => `
    <div class="admin-table-row social-admin-row dynamic-admin-row" data-social-id="${escapeAttr(row.id)}">
      <div class="admin-row-main"><div class="social-admin-symbol">${escapeHtml((row.label || row.platform || 'S').slice(0,2).toUpperCase())}</div><div><strong>${escapeHtml(row.label || row.platform)}</strong><small>${escapeHtml(row.platform || '')}</small></div></div>
      <input class="social-url" value="${escapeAttr(row.url || '')}" aria-label="${escapeAttr(row.label || row.platform || 'Social URL')}">
      <label class="admin-check"><input type="checkbox" class="social-enabled" ${row.enabled !== false ? 'checked' : ''}> aktiv</label>
      <span></span>
      <div class="admin-row-actions"><button class="button button-small social-save">Speichern</button><button class="button button-small button-danger social-delete">Löschen</button></div>
    </div>`).join('');

  list.querySelectorAll('.social-save').forEach(btn => btn.onclick = async () => {
    const row = btn.closest('.social-admin-row');
    const id = row?.dataset.socialId;
    const url = row?.querySelector('.social-url')?.value.trim();
    const enabled = row?.querySelector('.social-enabled')?.checked;
    if (!id || !isSafeHttpUrl(url)) return message('social-message', 'Bitte eine gültige http(s)-URL verwenden.');
    const { error } = await supabaseClient.from('social_links').update({ url, enabled, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) message('social-message', error.message);
    else { message('social-message', 'Social Link gespeichert.', true); saveStamp(); await loadSocials(); }
  });

  list.querySelectorAll('.social-delete').forEach(btn => btn.onclick = async () => {
    const row = btn.closest('.social-admin-row');
    const id = row?.dataset.socialId;
    const name = row?.querySelector('strong')?.textContent || 'diesen Link';
    if (!id || !confirm(`„${name}“ wirklich löschen?`)) return;
    const { error } = await supabaseClient.from('social_links').delete().eq('id', id);
    if (error) message('social-message', error.message);
    else { message('social-message', 'Social Link gelöscht.', true); saveStamp(); await loadSocials(); }
  });
}

async function loadGames() {
  const list = $('games-admin-list');
  if (!list) return;
  const { data, error } = await supabaseClient.from('games').select('*').order('sort_order').order('name');
  if (error) {
    list.innerHTML = `<div class="admin-empty">Games konnten nicht geladen werden: ${escapeHtml(error.message)}</div>`;
    $('games-db-state').textContent = 'Fehler';
    return;
  }
  const rows = data || [];
  $('games-db-state').textContent = `${rows.length} Games in der DB`;
  cachedGames = rows;
  if (!rows.length) {
    list.innerHTML = '<div class="admin-empty">Noch keine Games angelegt.</div>';
    return;
  }
  list.innerHTML = `
    <div class="admin-table-row admin-table-head"><span>Game</span><span>Beschreibung</span><span>Aktiv</span><span>Main Game</span><span>Aktionen</span></div>
    ${rows.map(row => `
      <div class="admin-table-row game-admin-row dynamic-admin-row" data-game-id="${escapeAttr(row.id)}">
        <div class="admin-row-main">${row.image_url ? `<img class="admin-social-icon" src="${escapeAttr(row.image_url)}" alt="">` : '<div class="game-admin-symbol">G</div>'}<div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.tag || 'GAME')}</small></div></div>
        <div class="game-edit-fields"><input class="game-description" value="${escapeAttr(row.description || '')}" aria-label="Beschreibung"><input class="game-tag" value="${escapeAttr(row.tag || '')}" aria-label="Tag"><input class="game-image" value="${escapeAttr(row.image_url || '')}" aria-label="Bild-URL"></div>
        <label class="admin-check"><input type="checkbox" class="game-enabled" ${row.enabled !== false ? 'checked' : ''}> sichtbar</label>
        <label class="admin-check"><input type="radio" name="featured-game" class="game-featured" ${row.featured === true ? 'checked' : ''}> Main Game</label>
        <div class="admin-row-actions"><button class="button button-small game-save">Speichern</button><button class="button button-small button-danger game-delete">Löschen</button></div>
      </div>`).join('')}`;

  list.querySelectorAll('.game-save').forEach(btn => btn.onclick = async () => {
    const row = btn.closest('.game-admin-row');
    const id = row?.dataset.gameId;
    if (!id) return;
    const description = row.querySelector('.game-description')?.value.trim() || '';
    const tag = row.querySelector('.game-tag')?.value.trim() || 'VARIETY';
    const image_url = row.querySelector('.game-image')?.value.trim() || null;
    const enabled = row.querySelector('.game-enabled')?.checked;
    const featured = row.querySelector('.game-featured')?.checked;
    if (image_url && !isSafeHttpUrl(image_url)) return message('games-message', 'Bitte eine gültige Bild-URL verwenden.');
    if (featured) {
      await supabaseClient.from('games').update({ featured: false }).neq('id', id);
    }
    const { error } = await supabaseClient.from('games').update({ description, tag, image_url, enabled, featured, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) message('games-message', error.message);
    else { message('games-message', 'Game gespeichert.', true); saveStamp(); await loadGames(); }
  });

  list.querySelectorAll('.game-delete').forEach(btn => btn.onclick = async () => {
    const row = btn.closest('.game-admin-row');
    const id = row?.dataset.gameId;
    const name = row?.querySelector('strong')?.textContent || 'dieses Game';
    if (!id || !confirm(`„${name}“ wirklich löschen?`)) return;
    const { error } = await supabaseClient.from('games').delete().eq('id', id);
    if (error) message('games-message', error.message);
    else { message('games-message', 'Game gelöscht.', true); saveStamp(); await loadGames(); }
  });
}


async function addGame() {
  const name = $('new-game-name').value.trim();
  const tag = $('new-game-tag').value.trim() || 'VARIETY';
  const description = $('new-game-description').value.trim() || tag;
  const image_url = $('new-game-image')?.value.trim() || null;
  if (!name) return message('games-message', 'Bitte einen Namen eingeben.');
  if (image_url && !isSafeHttpUrl(image_url)) return message('games-message', 'Bitte eine gültige Bild-URL verwenden.');

  const maxOrder = Math.max(0, ...cachedGames.map(g => Number(g.sort_order) || 0));
  const { error } = await supabaseClient.from('games').upsert({
    name,
    tag,
    description,
    image_url,
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
    if ($('new-game-image')) $('new-game-image').value = '';
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


async function loadEventsAdmin(){
  const list=$('events-admin-list'); if(!list)return;
  const {data,error}=await supabaseClient.from('club_events').select('*').order('event_date',{ascending:true});
  if(error){list.innerHTML=`<div class="admin-empty">Events noch nicht eingerichtet: ${escapeHtml(error.message)}</div>`;return;}
  list.innerHTML=(data||[]).length?(data||[]).map(e=>`<div class="admin-table-row content-admin-row" data-id="${e.id}">
    <div><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(new Date(e.event_date).toLocaleString('de-DE'))}</small></div>
    <input class="content-inline-title" value="${escapeAttr(e.title)}">
    <input class="content-inline-date" type="datetime-local" value="${formatDateLocal(e.event_date)}">
    <label class="admin-check"><input class="content-inline-enabled" type="checkbox" ${e.enabled?'checked':''}> aktiv</label>
    <div class="admin-row-actions"><button class="button button-small content-save-event">Speichern</button><button class="button button-small button-danger content-delete-event">Löschen</button></div>
  </div>`).join(''):'<div class="admin-empty">Noch keine Events.</div>';
  list.querySelectorAll('.content-save-event').forEach(btn=>btn.onclick=async()=>{const r=btn.closest('.content-admin-row');const {error}=await supabaseClient.from('club_events').update({title:r.querySelector('.content-inline-title').value.trim(),event_date:new Date(r.querySelector('.content-inline-date').value).toISOString(),enabled:r.querySelector('.content-inline-enabled').checked,updated_at:new Date().toISOString()}).eq('id',r.dataset.id);if(error)message('events-message',error.message);else{message('events-message','Event gespeichert.',true);saveStamp();loadEventsAdmin();}});
  list.querySelectorAll('.content-delete-event').forEach(btn=>btn.onclick=async()=>{const id=btn.closest('.content-admin-row').dataset.id;if(!confirm('Event wirklich löschen?'))return;const {error}=await supabaseClient.from('club_events').delete().eq('id',id);if(error)message('events-message',error.message);else{message('events-message','Event gelöscht.',true);saveStamp();loadEventsAdmin();}});
}

async function loadNewsAdmin(){
  const list=$('news-admin-list'); if(!list)return;
  const {data,error}=await supabaseClient.from('club_news').select('*').order('published_at',{ascending:false});
  if(error){list.innerHTML=`<div class="admin-empty">News noch nicht eingerichtet: ${escapeHtml(error.message)}</div>`;return;}
  list.innerHTML=(data||[]).length?(data||[]).map(n=>`<div class="admin-table-row content-admin-row" data-id="${n.id}">
    <div><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(new Date(n.published_at).toLocaleDateString('de-DE'))}</small></div>
    <input class="content-inline-title" value="${escapeAttr(n.title)}">
    <input class="content-inline-body" value="${escapeAttr(n.body)}">
    <label class="admin-check"><input class="content-inline-enabled" type="checkbox" ${n.enabled?'checked':''}> aktiv</label>
    <div class="admin-row-actions"><button class="button button-small content-save-news">Speichern</button><button class="button button-small button-danger content-delete-news">Löschen</button></div>
  </div>`).join(''):'<div class="admin-empty">Noch keine News.</div>';
  list.querySelectorAll('.content-save-news').forEach(btn=>btn.onclick=async()=>{const r=btn.closest('.content-admin-row');const {error}=await supabaseClient.from('club_news').update({title:r.querySelector('.content-inline-title').value.trim(),body:r.querySelector('.content-inline-body').value.trim(),enabled:r.querySelector('.content-inline-enabled').checked,updated_at:new Date().toISOString()}).eq('id',r.dataset.id);if(error)message('news-message',error.message);else{message('news-message','News gespeichert.',true);saveStamp();loadNewsAdmin();}});
  list.querySelectorAll('.content-delete-news').forEach(btn=>btn.onclick=async()=>{const id=btn.closest('.content-admin-row').dataset.id;if(!confirm('News wirklich löschen?'))return;const {error}=await supabaseClient.from('club_news').delete().eq('id',id);if(error)message('news-message',error.message);else{message('news-message','News gelöscht.',true);saveStamp();loadNewsAdmin();}});
}

function formatDateLocal(v){const d=new Date(v),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}

async function addEventAdmin(){
  const title=$('event-title').value.trim(), desc=$('event-description').value.trim(), date=$('event-date').value, url=$('event-url').value.trim()||'https://www.twitch.tv/acyjannik';
  if(!title||!date)return message('events-message','Titel und Datum sind erforderlich.');
  if(!isSafeHttpUrl(url))return message('events-message','Bitte einen gültigen Link verwenden.');
  const {error}=await supabaseClient.from('club_events').insert({title,description:desc,event_date:new Date(date).toISOString(),location:'Twitch',twitch_url:url,enabled:true});
  if(error)message('events-message',error.message);else{$('event-title').value='';$('event-description').value='';$('event-date').value='';message('events-message','Event hinzugefügt.',true);saveStamp();loadEventsAdmin();}
}

async function addNewsAdmin(){
  const title=$('news-title').value.trim(), body=$('news-body').value.trim();
  if(!title||!body)return message('news-message','Titel und Text sind erforderlich.');
  const {error}=await supabaseClient.from('club_news').insert({title,body,enabled:true});
  if(error)message('news-message',error.message);else{$('news-title').value='';$('news-body').value='';message('news-message','News veröffentlicht.',true);saveStamp();loadNewsAdmin();}
}

async function loadClipsAdmin(){
  const list=$('clips-admin-list');
  if(!list)return;

  const {data,error}=await supabaseClient
    .from('club_clips')
    .select('*')
    .order('published_at',{ascending:false});

  if(error){
    list.innerHTML=`<div class="admin-empty">Clips konnten nicht geladen werden: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const clips=data||[];
  if(!clips.length){
    list.innerHTML='<div class="admin-empty">Noch keine Clips. Füge rechts deinen ersten echten Clip hinzu.</div>';
    return;
  }

  list.innerHTML=clips.map(c=>`
    <article class="clip-admin-card content-admin-row" data-id="${c.id}">
      <div class="clip-admin-header">
        <div>
          <strong>${escapeHtml(c.title)}</strong>
          <small>${escapeHtml(c.category||'ACY Clip')} · ${escapeHtml(c.enabled?'Aktiv':'Ausgeblendet')}</small>
        </div>
        <div class="clip-admin-top-actions">
          <a class="button button-small button-secondary" href="${escapeAttr(c.clip_url)}" target="_blank" rel="noreferrer">Clip öffnen ↗</a>
        </div>
      </div>

      <div class="clip-admin-grid">
        <label>Titel
          <input class="clip-edit-title" value="${escapeAttr(c.title)}">
        </label>
        <label>Kategorie
          <input class="clip-edit-category" value="${escapeAttr(c.category||'Fortnite')}">
        </label>
        <label>Clip-URL
          <input class="clip-edit-url" value="${escapeAttr(c.clip_url)}">
        </label>
        <label>Thumbnail-URL
          <input class="clip-edit-thumb" value="${escapeAttr(c.thumbnail_url||'')}">
        </label>
        <label class="clip-edit-full">Beschreibung
          <textarea class="clip-edit-description" rows="2">${escapeHtml(c.description||'')}</textarea>
        </label>
        <label class="admin-check clip-edit-enabled">
          <input class="clip-edit-active" type="checkbox" ${c.enabled?'checked':''}> Aktiv auf der Website
        </label>
      </div>

      <div class="admin-row-actions clip-admin-actions">
        <button class="button button-small button-primary content-save-clip" type="button">Änderungen speichern</button>
        <button class="button button-small button-secondary content-cancel-clip" type="button">Zurücksetzen</button>
        <button class="button button-small button-danger content-delete-clip" type="button">Löschen</button>
      </div>
    </article>
  `).join('');

  list.querySelectorAll('.content-save-clip').forEach(btn=>btn.onclick=async()=>{
    const row=btn.closest('.clip-admin-card');
    const id=row?.dataset.id;
    if(!id)return;

    const title=row.querySelector('.clip-edit-title')?.value.trim();
    const category=row.querySelector('.clip-edit-category')?.value.trim()||'Fortnite';
    const clip_url=row.querySelector('.clip-edit-url')?.value.trim();
    const thumbnail_url=row.querySelector('.clip-edit-thumb')?.value.trim();
    const description=row.querySelector('.clip-edit-description')?.value.trim();
    const enabled=row.querySelector('.clip-edit-active')?.checked;

    if(!title||!clip_url){
      return message('clips-message','Titel und Clip-URL sind erforderlich.');
    }
    if(!isSafeHttpUrl(clip_url)){
      return message('clips-message','Bitte eine gültige Clip-URL verwenden.');
    }
    if(thumbnail_url && !isSafeHttpUrl(thumbnail_url)){
      return message('clips-message','Bitte eine gültige Thumbnail-URL verwenden.');
    }

    const {error}=await supabaseClient.from('club_clips').update({
      title,
      category,
      clip_url,
      thumbnail_url:thumbnail_url||null,
      description:description||null,
      enabled,
      updated_at:new Date().toISOString()
    }).eq('id',id);

    if(error){
      message('clips-message',error.message);
    }else{
      message('clips-message','Clip gespeichert.',true);
      saveStamp();
      await loadClipsAdmin();
    }
  });

  list.querySelectorAll('.content-cancel-clip').forEach(btn=>{
    btn.onclick=()=>loadClipsAdmin();
  });

  list.querySelectorAll('.content-delete-clip').forEach(btn=>btn.onclick=async()=>{
    const id=btn.closest('.clip-admin-card')?.dataset.id;
    if(!id)return;
    if(!confirm('Clip wirklich löschen?'))return;

    const {error}=await supabaseClient.from('club_clips').delete().eq('id',id);
    if(error){
      message('clips-message',error.message);
    }else{
      message('clips-message','Clip gelöscht.',true);
      saveStamp();
      await loadClipsAdmin();
    }
  });
}

async function addClipAdmin(){
  const title=$('clip-title').value.trim();
  const clip_url=$('clip-url').value.trim();
  const thumbnail_url=$('clip-thumbnail').value.trim();
  const category=$('clip-category').value.trim()||'Fortnite';
  const description=$('clip-description').value.trim();
  if(!title||!clip_url)return message('clips-message','Titel und Clip-URL sind erforderlich.');
  if(!isSafeHttpUrl(clip_url))return message('clips-message','Bitte eine gültige Clip-URL verwenden.');
  if(thumbnail_url && !isSafeHttpUrl(thumbnail_url))return message('clips-message','Bitte eine gültige Thumbnail-URL verwenden.');
  const {error}=await supabaseClient.from('club_clips').insert({title,clip_url,thumbnail_url,category,description,enabled:true});
  if(error)message('clips-message',error.message);else{
    $('clip-title').value='';$('clip-url').value='';$('clip-thumbnail').value='';$('clip-description').value='';
    message('clips-message','Clip hinzugefügt.',true);saveStamp();loadClipsAdmin();
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
      bindSpotlightAdmin();
      await loadDashboard();
      await loadPollsAdmin();
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
      message('settings-message', 'Website-Inhalte gespeichert – inklusive „Über Jannik“.', true);
      updatePreview(payload);
      saveStamp();
    }
  });

  $('add-game-btn')?.addEventListener('click', addGame);
$('add-clip-btn')?.addEventListener('click', addClipAdmin);
$('add-event-btn')?.addEventListener('click', addEventAdmin);
$('add-news-btn')?.addEventListener('click', addNewsAdmin);
  $('add-social-btn')?.addEventListener('click', addSocial);
  $('upload-media-btn')?.addEventListener('click', uploadMedia);
  $('admin-refresh-all')?.addEventListener('click', async () => {
    const btn = $('admin-refresh-all');
    if (btn) { btn.disabled = true; btn.textContent = '↻ Aktualisiere…'; }
    try { await loadDashboard(); saveStamp(); } finally { if (btn) { btn.disabled = false; btn.textContent = '↻ Aktualisieren'; } }
  });

  $('media-use')?.addEventListener('change', () => {
    $('media-game-row').hidden = $('media-use').value !== 'game';
  });

  $('password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await resetPassword();
  });

}

// ------------------------------------------------------------
// V5.3 Community Poll Admin
// ------------------------------------------------------------
async function loadPollsAdmin() {
  const list = $('polls-admin-list');
  if (!list || !supabaseClient) return;

  try {
    const { data: polls, error } = await supabaseClient
      .from('club_polls')
      .select('id,question,description,active,closes_at,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!polls?.length) {
      list.innerHTML = '<div class="admin-note">Noch keine Umfragen erstellt.</div>';
      return;
    }

    const { data: votes } = await supabaseClient
      .from('club_poll_votes')
      .select('poll_id,option_id');

    const voteCounts = new Map();
    (votes || []).forEach(v => {
      const key = `${v.poll_id}:${v.option_id}`;
      voteCounts.set(key, (voteCounts.get(key) || 0) + 1);
    });

    list.innerHTML = polls.map(p => `
      <div class="admin-table-row poll-admin-row" data-poll-id="${p.id}">
        <div><strong>${escapeHtml(p.question)}</strong><small>${escapeHtml(p.description || '')}</small></div>
        <div><span>${p.active ? '🟢 Aktiv' : '⚪ Beendet'}</span><small>${p.closes_at ? new Date(p.closes_at).toLocaleString('de-DE') : 'ohne Enddatum'}</small></div>
        <button class="button button-danger button-small" type="button" data-poll-toggle="${p.id}" data-active="${p.active}">${p.active ? 'Beenden' : 'Aktivieren'}</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-poll-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.pollToggle);
        const active = btn.dataset.active === 'true';
        if (active && !confirm('Diese Umfrage wirklich beenden?')) return;

        if (!active) {
          await supabaseClient.from('club_polls').update({ active: false }).eq('active', true);
        }
        const { error } = await supabaseClient.from('club_polls').update({ active: !active }).eq('id', id);
        if (error) return message('poll-admin-message', error.message);
        message('poll-admin-message', active ? 'Umfrage beendet.' : 'Umfrage aktiviert.', true);
        await loadPollsAdmin();
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="admin-note">${escapeHtml(error?.message || 'Umfragen konnten nicht geladen werden.')}</div>`;
  }
}

$('test-email-btn')?.addEventListener('click', async () => {
  const button = $('test-email-btn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Testet SMTP…';
  }
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Keine aktive Admin-Sitzung.');

    const response = await fetch('/api/club-notification-email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testSmtp: true,
        type: 'community_vote',
        title: 'ACY Club SMTP-Test',
        body: 'Dies ist eine Test-E-Mail für die ACY Club Benachrichtigungen.',
        linkUrl: '/club-profile.html#notification-settings'
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = payload.error
        || (payload.emailFailed != null ? `${payload.emailFailed} E-Mail-Versandfehler bei ${payload.emailEligible ?? 0} Empfängern.` : `HTTP ${response.status}`);
      message('poll-admin-message',
        `SMTP-Test fehlgeschlagen · API ${payload.apiVersion || 'älteres Backend'} · ${detail}`);
      return;
    }

    message('poll-admin-message',
      `SMTP-Test erfolgreich · API ${payload.apiVersion || 'älteres Backend'} · ${payload.sentTo ? `Mail an ${payload.sentTo} übergeben · Absender ${payload.envelopeFrom || 'SMTP_USER'}.` : `${payload.emailSent ?? 0} E-Mail(s) gesendet.`}`,
      true);
  } catch (error) {
    message('poll-admin-message', `SMTP-Test fehlgeschlagen · ${error?.message || 'Unbekannter Fehler'}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'SMTP-Testmail senden';
    }
  }
});

$('add-poll-btn')?.addEventListener('click', async () => {
  const question = $('poll-question-admin')?.value.trim();
  const description = $('poll-description-admin')?.value.trim();
  const options = ($('poll-options-admin')?.value || '').split('\n').map(x => x.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,8);
  const closesRaw = $('poll-closes-admin')?.value;

  if (!question) return message('poll-admin-message', 'Bitte eine Frage eingeben.');
  if (options.length < 2) return message('poll-admin-message', 'Bitte mindestens zwei unterschiedliche Antworten angeben.');

  const closes_at = closesRaw ? new Date(closesRaw).toISOString() : null;

  try {
    await supabaseClient.from('club_polls').update({ active: false }).eq('active', true);

    const { data: poll, error } = await supabaseClient
      .from('club_polls')
      .insert({
        question,
        description: description || null,
        closes_at,
        active: true,
        created_by: currentUser.id
      })
      .select('id')
      .single();

    if (error) throw error;

    const { error: optionError } = await supabaseClient
      .from('club_poll_options')
      .insert(options.map((label, index) => ({
        poll_id: poll.id,
        label,
        sort_order: index
      })));

    if (optionError) throw optionError;

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const response = await fetch('/api/club-notification-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'community_vote',
            title: 'Neuer Community Vote',
            body: question,
            linkUrl: '/club-profile.html#community-poll'
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          const backendVersion = payload.apiVersion || 'älteres Backend';
          const eligible = payload.categoryEnabledCount ?? payload.emailEligible ?? 0;
          message('poll-admin-message',
            `Umfrage veröffentlicht. ${payload.emailSent || 0} E-Mail(s) gesendet · ${eligible} für Votes freigeschaltet · ${payload.emailFailed || 0} Fehler · Versand-API ${backendVersion}.`, true);
        } else if (response.status === 503) {
          message('poll-admin-message',
            'Umfrage veröffentlicht. E-Mail-Versand ist noch nicht in Vercel konfiguriert.', true);
        } else {
          console.warn('Vote email dispatch:', payload.error, payload);
          message('poll-admin-message',
            `Umfrage veröffentlicht. E-Mail-Versand: ${payload.error || `HTTP ${response.status}`}`, true);
        }
      }
    } catch (notifyError) {
      console.warn('Vote email dispatch:', notifyError);
      message('poll-admin-message',
        'Umfrage veröffentlicht. E-Mail-Versand konnte nicht abgeschlossen werden.', true);
    }

    $('poll-question-admin').value = '';
    $('poll-description-admin').value = '';
    $('poll-options-admin').value = '';
    $('poll-closes-admin').value = '';
    await loadPollsAdmin();
  } catch (error) {
    message('poll-admin-message', error?.message || 'Umfrage konnte nicht erstellt werden.');
  }
});

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
      bindSpotlightAdmin();
      await loadDashboard();
      await loadPollsAdmin();
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
