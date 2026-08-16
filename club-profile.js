let supabaseClient = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

// V12.8 — never let one slow Supabase/API request freeze the whole dashboard.
function withTimeout(promise, ms = 8000, label = 'Request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} Timeout`)), ms))
  ]);
}

async function safeLoad(label, fn, ms = 8000) {
  try {
    return await withTimeout(Promise.resolve().then(fn), ms, label);
  } catch (error) {
    console.warn(`[V12.8] ${label} skipped:`, error);
    return null;
  }
}

// V14.3 — Central refresh system. The dashboard used to fire a small army of
// independent requests at once, which made slow Supabase calls feel like a
// frozen page. Refreshes are now explicit, bounded and visible.
const ACY_REFRESH_REGISTRY = new Map();
const ACY_REFRESH_BUSY = new Set();

function registerAcyRefresh(key, label, fn, targetId) {
  if (!key || typeof fn !== 'function') return;
  ACY_REFRESH_REGISTRY.set(key, { key, label, fn, targetId });
}

function acyRefreshTime() {
  return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function setAcyRefreshStatus(text, type = '') {
  const el = $('club-refresh-status');
  if (!el) return;
  el.textContent = text;
  el.className = `acy-refresh-status ${type}`.trim();
}

async function runAcyRefresh(key, { silent = false } = {}) {
  const entry = ACY_REFRESH_REGISTRY.get(key);
  if (!entry || ACY_REFRESH_BUSY.has(key)) return null;
  ACY_REFRESH_BUSY.add(key);
  const buttons = [...document.querySelectorAll(`[data-acy-refresh="${CSS.escape(key)}"]`)];
  buttons.forEach(button => {
    button.disabled = true;
    button.classList.add('is-refreshing');
    button.setAttribute('aria-busy', 'true');
  });
  try {
    const result = await withTimeout(Promise.resolve().then(entry.fn), 12000, entry.label);
    const time = acyRefreshTime();
    buttons.forEach(button => {
      button.classList.remove('is-refreshing');
      button.title = `${entry.label} · zuletzt ${time}`;
    });
    if (!silent) setAcyRefreshStatus(`${entry.label} aktualisiert · ${time}`, 'success');
    return result;
  } catch (error) {
    console.warn(`[V14.3] ${entry.label} refresh failed:`, error);
    buttons.forEach(button => button.classList.remove('is-refreshing'));
    if (!silent) setAcyRefreshStatus(`${entry.label} konnte nicht aktualisiert werden.`, 'error');
    throw error;
  } finally {
    ACY_REFRESH_BUSY.delete(key);
    buttons.forEach(button => {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
    });
  }
}

function injectAcyRefreshButtons() {
  const definitions = [
    ['profile','Profil','profile-section'],
    ['twitch','Twitch','twitch-section'],
    ['badges','Badges','member-badges-section'],
    ['progression','Fortschritt','progression-catalog'],
    ['events','Events','member-events-section'],
    ['wheel','Glücksrad','club-wheel-section'],
    ['streak','Daily-Serie','daily-streak-section'],
    ['quests','Quests','club-quests-section'],
    ['rewards','Rewards','club-rewards-section'],
    ['news','News','member-news-section'],
    ['messages','Nachrichten','club-messages'],
    ['chat','Club Chat','club-chat'],
    ['social','Freunde','social-connections-section'],
    ['directory','Mitglieder','member-directory-section'],
    ['clips','Clips','clips-section'],
    ['leaderboard','Ranking','member-leaderboard-section'],
    ['stats','Statistik','stats-section'],
    ['discord','Discord','discord-section'],
    ['pet','Pet','pet-section'],
    ['game','Aktuelles Game','current-game-card'],
    ['spotlight','Spotlight','member-spotlight'],
    ['hub','ACY Club Übersicht','member-hub'],
    ['community-games','Community Games','hub-community-games'],
    ['poll','Community Vote','community-poll'],
    ['notifications','Benachrichtigungen','notification-settings'],
    ['settings','Einstellungen','club-settings-section']
  ];
  definitions.forEach(([key, label, targetId]) => {
    const target = $(targetId);
    if (!target || target.querySelector(`[data-acy-refresh="${key}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'acy-section-refresh';
    button.dataset.acyRefresh = key;
    button.setAttribute('aria-label', `${label} aktualisieren`);
    button.title = `${label} aktualisieren`;
    button.innerHTML = '<span aria-hidden="true">↻</span><span class="sr-only">Aktualisieren</span>';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      runAcyRefresh(key).catch(() => {});
    });
    target.appendChild(button);
  });
}

async function runAcyRefreshAll() {
  const button = $('club-refresh-all');
  if (button) { button.disabled = true; button.classList.add('is-refreshing'); }
  setAcyRefreshStatus('Club-Daten werden aktualisiert…');
  try {
    // Profile is the shared source for identity/XP. Resolve it first.
    await runAcyRefresh('profile', { silent: true }).catch(() => null);
    const keys = [...ACY_REFRESH_REGISTRY.keys()].filter(key => key !== 'profile');
    const concurrency = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < keys.length) {
        const key = keys[cursor++];
        await runAcyRefresh(key, { silent: true }).catch(() => null);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
    setAcyRefreshStatus(`Alles aktualisiert · ${acyRefreshTime()}`, 'success');
  } finally {
    if (button) { button.disabled = false; button.classList.remove('is-refreshing'); }
  }
}

function initAcyRefreshSystem() {
  registerAcyRefresh('profile', 'Profil', async () => { await loadProfile(); await loadMemberHub(); }, 'profile-section');
  registerAcyRefresh('twitch', 'Twitch', async () => { await loadTwitch(); await loadTwitchAccountV11(); }, 'twitch-section');
  registerAcyRefresh('badges', 'Badges', async () => { await loadProfile(); await checkAchievements(); }, 'member-badges-section');
  registerAcyRefresh('progression', 'Fortschritt', loadProgressionCatalog, 'progression-catalog');
  registerAcyRefresh('events', 'Events', loadClubContent, 'member-events-section');
  registerAcyRefresh('wheel', 'Glücksrad', async () => { await loadWheelState(); await loadWheelHistory(); }, 'club-wheel-section');
  registerAcyRefresh('streak', 'Daily-Serie', loadDailyStreak, 'daily-streak-section');
  registerAcyRefresh('quests', 'Quests', loadQuests, 'club-quests-section');
  registerAcyRefresh('rewards', 'Rewards', loadMyRewards, 'club-rewards-section');
  registerAcyRefresh('news', 'News', loadClubContent, 'member-news-section');
  registerAcyRefresh('messages', 'Nachrichten', async () => { await loadDirectMessages(new URLSearchParams(location.search).get('dm') || ''); await loadDmUnreadCount(); }, 'club-messages');
  registerAcyRefresh('chat', 'Club Chat', loadClubChat, 'club-chat');
  registerAcyRefresh('social', 'Freunde', loadSocialConnections, 'social-connections-section');
  registerAcyRefresh('directory', 'Mitglieder', () => loadMemberDirectory($('member-directory-search')?.value || ''), 'member-directory-section');
  registerAcyRefresh('clips', 'Clips', loadClubClips, 'clips-section');
  registerAcyRefresh('leaderboard', 'Ranking', loadLeaderboard, 'member-leaderboard-section');
  registerAcyRefresh('stats', 'Statistik', loadMemberStats, 'stats-section');
  registerAcyRefresh('discord', 'Discord', loadDiscordLink, 'discord-section');
  registerAcyRefresh('pet', 'Pet', loadPet, 'pet-section');
  registerAcyRefresh('game', 'Aktuelles Game', loadCurrentGamePresence, 'current-game-card');
  registerAcyRefresh('spotlight', 'Spotlight', loadSpotlight, 'member-spotlight');
  registerAcyRefresh('hub', 'ACY Club Übersicht', loadMemberHub, 'member-hub');
  registerAcyRefresh('community-games', 'Community Games', loadCommunityGameHighlights, 'hub-community-games');
  registerAcyRefresh('poll', 'Community Vote', loadCommunityPoll, 'community-poll');
  registerAcyRefresh('notifications', 'Benachrichtigungen', loadNotifications, 'notification-settings');
  registerAcyRefresh('settings', 'Einstellungen', loadNotificationPreferences, 'club-settings-section');
  injectAcyRefreshButtons();
  $('club-refresh-all')?.addEventListener('click', runAcyRefreshAll);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
  return el;
}

function setStatus(text, type = '') {
  const el = $('profile-save-status');
  if (!el) {
    console.warn('Status element missing:', text);
    return;
  }
  el.textContent = text;
  el.className = `club-auth-status ${type}`.trim();
}

function setPetStatus(text, type = '') {
  const el = $('pet-status');
  if (!el) return;
  el.textContent = text;
  el.className = `club-auth-status ${type}`.trim();
}


// V10.4 — XP / Rank visual glow system
function glowTierForXp(xp=0){
  const value=Math.max(0,Number(xp)||0);
  if(value>=920000)return 8;
  if(value>=390000)return 7;
  if(value>=170000)return 6;
  if(value>=80000)return 5;
  if(value>=35000)return 4;
  if(value>=15000)return 3;
  if(value>=6000)return 2;
  if(value>=1500)return 1;
  if(value>=600)return 0;
  return -1;
}

function applyGlowTier(element, xp=0){
  if(!element)return;
  const tier=glowTierForXp(xp);
  element.classList.remove(...Array.from({length:9},(_,i)=>`glow-tier-${i}`),'glow-tier-none');
  element.classList.add(tier>=0?`glow-tier-${tier}`:'glow-tier-none');
  element.dataset.glowTier=String(Math.max(-1,tier));
}

function applyProfileGlow(xp=0){
  applyGlowTier(document.querySelector('.member-hero-card'),xp);
  applyGlowTier(document.querySelector('.member-avatar-wrap'),xp);
  applyGlowTier(document.querySelector('.member-quick'),xp);

  const badgeGrid=$('badge-grid');
  applyGlowTier(badgeGrid,xp);
  if(badgeGrid){
    badgeGrid.querySelectorAll('.member-badge').forEach((badge,index)=>{
      badge.classList.remove(...Array.from({length:9},(_,i)=>`glow-tier-${i}`),'glow-tier-none');
      const tier=Math.max(-1,glowTierForXp(xp)+Math.min(2,Math.floor(index/3)));
      badge.classList.add(tier>=0?`glow-tier-${tier}`:'glow-tier-none');
    });
  }
}

const CLUB_LEVELS = [
  { min: 0, title: 'ACY Rookie' },
  { min: 100, title: 'ACY Member' },
  { min: 300, title: 'ACY Regular' },
  { min: 600, title: 'ACY OG' },
  { min: 1000, title: 'ACY Legend' },
  { min: 1500, title: 'ACY Champion' },
  { min: 2500, title: 'ACY Elite' },
  { min: 4000, title: 'ACY Master' },
  { min: 6000, title: 'ACY Icon' },
  { min: 8500, title: 'ACY Mythic' },
  { min: 11500, title: 'ACY Immortal' },
  { min: 15000, title: 'ACY Hall of Fame' },
  { min: 20000, title: 'ACY Ascended' },
  { min: 27000, title: 'ACY Celestial' },
  { min: 35000, title: 'ACY Eternal' },
  { min: 45000, title: 'ACY Apex' },
  { min: 60000, title: 'ACY Vanguard' },
  { min: 80000, title: 'ACY Paragon' },
  { min: 105000, title: 'ACY Overlord' },
  { min: 135000, title: 'ACY Sovereign' },
  { min: 170000, title: 'ACY Cosmic' },
  { min: 210000, title: 'ACY Transcendent' },
  { min: 260000, title: 'ACY Eternal Flame' },
  { min: 320000, title: 'ACY Grandmaster' },
  { min: 390000, title: 'ACY Omega' },
  { min: 470000, title: 'ACY Apex Legend' },
  { min: 560000, title: 'ACY Ultra' },
  { min: 660000, title: 'ACY Infinity' },
  { min: 780000, title: 'ACY Beyond' },
  { min: 920000, title: 'ACY Hall of Fame+' }
];

function levelForXp(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let current = CLUB_LEVELS[0];
  for (const level of CLUB_LEVELS) {
    if (value >= level.min) current = level;
  }
  return current;
}

function levelIndexForXp(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let idx = 0;
  CLUB_LEVELS.forEach((level, i) => { if (value >= level.min) idx = i; });
  return idx;
}

function renderProgress(xp) {
  const idx = levelIndexForXp(xp);
  const level = CLUB_LEVELS[idx];
  setText('member-level', String(idx + 1));
  setText('level-number', String(idx + 1));
  setText('member-xp', `${xp.toLocaleString('de-DE')} XP`);
  setText('member-glow-title', `${level.title} · Level ${idx + 1}`);

  const levelGrid = $('catalog-levels-render');
  if (levelGrid) {
    levelGrid.innerHTML = CLUB_LEVELS.map((item, levelIndex) => {
      const reached = xp >= item.min;
      const current = levelIndex === idx;
      const levelRatio = CLUB_LEVELS.length > 1 ? levelIndex / (CLUB_LEVELS.length - 1) : 0;
      const achievedAlpha = Math.min(0.19, 0.055 + (levelRatio * 0.135));
      const futureAlpha = 0.018 + (levelRatio * 0.012);
      const cardAlpha = reached ? achievedAlpha : futureAlpha;
      return `<div class="catalog-level catalog-level-v14 ${reached ? 'is-complete' : ''} ${current ? 'is-current' : ''}" data-level="${levelIndex + 1}" style="--level-card-alpha:${cardAlpha.toFixed(3)};--level-card-progress:${levelRatio.toFixed(3)};">
        <span>${levelIndex + 1}</span><strong>${escapeHtml(item.title)}</strong><small>${item.min.toLocaleString('de-DE')} XP</small>
      </div>`;
    }).join('');
  }
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
    'Profile Complete': '✨',
    'Early Member': '⏳',
    'ACY Veteran': '🛡️',
    'Fortnite': '🎮',
    'Event Fan': '🎮',
    'Event Hunter': '🔥',
    'Event Regular': '⚡',
    'Event Legend': '🏆',
    '100 XP Club': '🌟',
    '500 XP Club': '👑',
    '1000 XP Club': '💎',
    'ACY OG': '👑',
    'ACY Legend': '🏆',
    'Discord Member': '💬',
    'Member of the Month': '👑',
    'Mod': '🛡️'
  };
  const badgeGrid = $('badge-grid');
  if (!badgeGrid) return;
  badgeGrid.innerHTML = list.map((badge) => `
    <div class="member-badge glow-tier-${Math.max(0,Math.min(8,Math.max(0,glowTierForXp(xp)) + Math.min(2,Math.floor(list.indexOf(badge)/3))))}">
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



// V14.3 — local art fallbacks keep game UI visual even when Supabase image_url is empty.
const ACY_GAME_ART = {
  'fortnite': '/assets/games/fortnite.svg',
  'gta v': '/assets/games/gta-v.svg',
  'thick as thieves': '/assets/games/thick-as-thieves.svg',
  'meccha chameleon': '/assets/games/meccha-chameleon.jpg',
  'roblox': '/assets/games/roblox-acy-cover.svg'
};
function acyGameArt(game = {}) {
  const direct = String(game.image_url || '').trim();
  if (direct) return direct;
  const key = String(game.name || '').trim().toLowerCase();
  return ACY_GAME_ART[key] || '';
}
function renderCurrentGamePreview(game) {
  const preview = $('current-game-preview');
  const img = $('current-game-preview-img');
  const name = $('current-game-preview-name');
  const tag = $('current-game-preview-tag');
  if (!preview || !img || !name || !tag) return;
  if (!game) { preview.hidden = true; return; }
  const art = acyGameArt(game);
  if (art) { img.src = art; img.alt = game.name || 'Game'; img.hidden = false; }
  else { img.removeAttribute('src'); img.hidden = true; }
  name.textContent = game.name || 'Game';
  tag.textContent = game.tag || 'COMMUNITY';
  preview.hidden = false;
}

// ------------------------------------------------------------
// V6.1 Community Games: current-game presence
// ------------------------------------------------------------
async function loadCurrentGamePresence() {
  const select = $('current-game-select');
  const save = $('current-game-save');
  if (!select || !save || !currentUser) return;

  try {
    let games = [];
    let gamesError = null;
    const { data: dbGames, error: dbGamesError } = await supabaseClient
      .from('games').select('id,name,tag,image_url').eq('enabled', true).order('sort_order').order('name');
    games = Array.isArray(dbGames) ? dbGames : [];
    gamesError = dbGamesError;
    if (gamesError) {
      // If the games table is temporarily blocked by an RLS/config mismatch,
      // use the public content API for the visual selector instead of leaving
      // the control empty. Saving still requires a real database game id.
      try {
        const response = await fetch(`/api/site-content?_=${Date.now()}`, { cache:'no-store' });
        const payload = await response.json();
        const fallbackGames = Array.isArray(payload?.games) ? payload.games : [];
        if (fallbackGames.length) games = fallbackGames;
      } catch (fallbackError) {
        console.warn('Game catalog fallback unavailable:', fallbackError);
      }
      if (!games.length) throw gamesError;
    }
    const { data: presence, error: presenceError } = await supabaseClient
      .from('club_game_presence').select('game_id,updated_at').eq('user_id', currentUser.id).maybeSingle();
    if (presenceError) throw presenceError;

    select.innerHTML = '<option value="">Ich spiele gerade nichts / ausblenden</option>' +
      games.map(game => `<option value="${escapeAttr(game.id)}">${escapeHtml(game.name)}</option>`).join('');
    select.value = presence?.game_id || '';
    const selectedGame = (games || []).find(item => String(item.id) === String(select.value));
    renderCurrentGamePreview(selectedGame || null);
    setText('current-game-status', presence?.game_id ? 'Aktuell gesetzt' : 'Noch nicht gesetzt');
    select.onchange = () => renderCurrentGamePreview((games || []).find(item => String(item.id) === String(select.value)) || null);

    save.onclick = async () => {
      save.disabled = true;
      setText('current-game-status', 'Speichert…');
      try {
        const gameId = select.value;
        if (!gameId) {
          const { error } = await supabaseClient.from('club_game_presence').delete().eq('user_id', currentUser.id);
          if (error) throw error;
          setText('current-game-status', 'Ausgeblendet');
          setText('current-game-note', 'Dein aktuelles Game wird nicht mehr in der Community-Übersicht angezeigt.');
        } else {
          const { error } = await supabaseClient.from('club_game_presence').upsert({
            user_id: currentUser.id,
            game_id: gameId,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
          if (error) throw error;
          const game = (games || []).find(item => item.id === gameId);
          setText('current-game-status', 'Aktuell gesetzt');
          void progressQuestsForAction('daily_game');
          setText('current-game-note', `${game?.name || 'Game'} wird jetzt in der Community-Übersicht gezählt.`);
        }
      } catch (error) {
        console.error('Current game save failed:', error);
        setText('current-game-status', 'Fehler');
        setText('current-game-note', error.message || 'Konnte nicht gespeichert werden.');
      } finally {
        save.disabled = false;
      }
    };
  } catch (error) {
    console.warn('Current game unavailable:', error);
    setText('current-game-status', 'Nicht verfügbar');
    setText('current-game-note', 'Die Community-Games-Funktion ist noch nicht mit der Datenbank verbunden. Bitte V6.1-SQL ausführen.');
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

document.getElementById('notification-bell')?.addEventListener('click', () => {
  const panel = document.getElementById('notification-panel');
  if (panel) panel.hidden = !panel.hidden;
});
document.getElementById('notification-close')?.addEventListener('click', () => {
  const panel = document.getElementById('notification-panel');
  if (panel) panel.hidden = true;
});

document.getElementById('notification-read-all')?.addEventListener('click', async () => {
  const button = document.getElementById('notification-read-all');
  const container = document.getElementById('notifications-list');
  const badge = document.getElementById('notification-count');
  if (!supabaseClient || !container) return;

  const originalText = button?.textContent || 'Alle gelesen';
  if (button) {
    button.disabled = true;
    button.textContent = 'Wird gelesen…';
  }

  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Deine Sitzung ist abgelaufen.');

    const response = await fetch('/api/club-notifications?action=mark_all_read', {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Benachrichtigungen konnten nicht als gelesen markiert werden.');

    // The user asked for read notifications to disappear, so remove them
    // from the visible panel immediately instead of merely changing styling.
    container.innerHTML = '<div class="club-content-empty">Keine neuen Benachrichtigungen.</div>';
    if (badge) {
      badge.textContent = '';
      badge.hidden = true;
    }
  } catch (error) {
    console.warn('Mark all notifications read failed:', error);
    if (container) {
      const errorBox = document.createElement('div');
      errorBox.className = 'club-content-empty';
      errorBox.textContent = error?.message || 'Benachrichtigungen konnten nicht aktualisiert werden.';
      container.prepend(errorBox);
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
});


// ------------------------------------------------------------
function formatRelativeTime(value){
  const t=new Date(value||0).getTime(); if(!Number.isFinite(t)||!t)return '';
  const sec=Math.max(0,Math.floor((Date.now()-t)/1000));
  if(sec<60)return 'gerade eben'; if(sec<3600)return `vor ${Math.floor(sec/60)} Min.`; if(sec<86400)return `vor ${Math.floor(sec/3600)} Std.`; if(sec<604800)return `vor ${Math.floor(sec/86400)} Tagen`;
  return new Date(t).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
}

// V6.2 Direct Messages
// ------------------------------------------------------------
let dmMessages = [];
let dmConversations = new Map();
let dmActiveUserId = null;
let dmChannel = null;
let dmUnreadUsers = new Set();

function dmDisplayName(profile) {
  return profile?.display_name || profile?.username || 'ACY Member';
}

function dmAvatar(profile, className = 'dm-avatar') {
  const name = dmDisplayName(profile);
  if (profile?.avatar_url) {
    return `<img class="${className}" src="${escapeAttr(profile.avatar_url)}" alt="" loading="lazy">`;
  }
  return `<div class="${className} dm-avatar-fallback">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
}

function dmSetStatus(message = '', type = '') {
  const el = $('dm-status');
  if (!el) return;
  el.textContent = message;
  el.className = `dm-status ${type}`.trim();
}

async function dmProfiles(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id,username,display_name,avatar_url')
    .in('id', unique);
  if (error) throw error;
  return new Map((data || []).map(p => [p.id, p]));
}

function dmOtherId(message) {
  return message.sender_id === currentUser.id ? message.recipient_id : message.sender_id;
}

function dmLastMessage(messages) {
  return messages.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

async function loadDmUnreadCount() {
  const badge = $('dm-unread-count');
  if (!badge || !supabaseClient || !currentUser) return;
  try {
    const { data, error } = await supabaseClient
      .from('club_notifications')
      .select('id,link_url,read_at')
      .eq('user_id', currentUser.id)
      .eq('notification_type', 'direct_message')
      .is('read_at', null);
    if (error) throw error;

    dmUnreadUsers = new Set(
      (data || []).map(n => {
        const match = String(n.link_url || '').match(/[?&]dm=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
      }).filter(Boolean)
    );

    const unread = Array.isArray(data) ? data.length : 0;
    badge.textContent = unread === 1 ? '1 neue Nachricht' : `${unread} neue Nachrichten`;
    badge.hidden = unread === 0;
    renderDmConversations();
  } catch (error) {
    console.warn('DM unread count unavailable:', error);
  }
}

async function markDmNotificationsRead(senderId) {
  if (!senderId || !supabaseClient || !currentUser) return;
  try {
    await supabaseClient
      .from('club_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', currentUser.id)
      .eq('notification_type', 'direct_message')
      .eq('read_at', null)
      .like('link_url', `/club-profile.html?dm=${senderId}`);
    await loadDmUnreadCount();
    await refreshNotificationBadge();
  } catch (error) {
    console.warn('DM notification read state failed:', error);
  }
}

function renderDmConversations() {
  const list = $('dm-conversations');
  if (!list) return;

  const rows = [...dmConversations.values()]
    .sort((a,b) => new Date(b.last.created_at) - new Date(a.last.created_at));

  if (!rows.length) {
    list.innerHTML = `
      <div class="dm-empty">
        <strong>Noch keine Nachrichten.</strong>
        <span>Öffne ein Mitgliedsprofil und starte eine Unterhaltung.</span>
      </div>`;
    return;
  }

  list.innerHTML = rows.map(row => {
    const active = row.userId === dmActiveUserId ? ' is-active' : '';
    const unread = dmUnreadUsers.has(row.userId);
    const unreadClass = unread ? ' is-unread' : '';
    const profile = row.profile || {};
    return `<button class="dm-conversation${active}${unreadClass}" type="button" data-dm-user="${escapeAttr(row.userId)}">
      ${dmAvatar(profile)}
      <span class="dm-conversation-main">
        <strong>${escapeHtml(dmDisplayName(profile))}</strong>
        <small>${escapeHtml(row.last.message)}</small>
      </span>
      ${unread ? '<span class="dm-unread-dot" title="Neue Nachricht">Neu</span>' : ''}
      <time>${formatChatTime(row.last.created_at)}</time>
    </button>`;
  }).join('');

  list.querySelectorAll('[data-dm-user]').forEach(button => {
    button.addEventListener('click', () => openDmConversation(button.dataset.dmUser));
  });
}

function renderDmThread() {
  const messagesEl = $('dm-messages');
  const head = $('dm-thread-head');
  const form = $('dm-form');
  if (!messagesEl || !head || !form) return;

  if (!dmActiveUserId) {
    form.hidden = true;
    head.innerHTML = `<div class="dm-thread-placeholder"><strong>Private Nachricht</strong><span>Wähle links ein Mitglied aus.</span></div>`;
    messagesEl.innerHTML = '<div class="club-content-empty">Noch keine Unterhaltung ausgewählt.</div>';
    return;
  }

  const conversation = dmConversations.get(dmActiveUserId);
  const profile = conversation?.profile || {};
  head.innerHTML = `<div class="dm-thread-person">${dmAvatar(profile)}<div><strong>${escapeHtml(dmDisplayName(profile))}</strong><span>@${escapeHtml(profile.username || '')}</span></div></div>`;
  form.hidden = false;

  const messages = dmMessages
    .filter(m => dmOtherId(m) === dmActiveUserId)
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

  if (!messages.length) {
    messagesEl.innerHTML = '<div class="dm-empty-thread"><strong>Neue Unterhaltung</strong><span>Schreib die erste Nachricht.</span></div>';
  } else {
    messagesEl.innerHTML = messages.map(m => {
      const own = m.sender_id === currentUser.id;
      return `<article class="dm-message ${own ? 'is-own' : ''}" data-dm-message="${escapeAttr(m.id)}">
        <div class="dm-bubble">${escapeHtml(m.message).replace(/\n/g,'<br>')}</div>
        <time>${formatChatTime(m.created_at)}</time>
        ${own ? `<button type="button" class="dm-delete" data-dm-delete="${escapeAttr(m.id)}" aria-label="Nachricht löschen" title="Nachricht löschen">×</button>` : ''}
      </article>`;
    }).join('');
  }

  messagesEl.querySelectorAll('[data-dm-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.dmDelete;
      if (!id || !confirm('Diese Nachricht wirklich löschen?')) return;
      const { error } = await supabaseClient
        .from('club_direct_messages')
        .delete()
        .eq('id', id)
        .eq('sender_id', currentUser.id);
      if (error) dmSetStatus(error.message || 'Nachricht konnte nicht gelöscht werden.', 'error');
    });
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}


// V8.1.2 — remember which Club cards were open.
// We use sessionStorage so the state survives navigation/back-forward
// and page reloads during the same browser session.
const MEMBER_FOLD_STATE_KEY = 'acy-club-open-folds-v1';

function getRememberedMemberFolds() {
  try {
    const raw = sessionStorage.getItem(MEMBER_FOLD_STATE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveRememberedMemberFolds() {
  const ids = [...document.querySelectorAll('.member-fold, .member-card details')]
    .filter(el => el.open && el.id)
    .map(el => el.id);

  try {
    sessionStorage.setItem(MEMBER_FOLD_STATE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable in privacy modes. The UI still works normally.
  }
}

function restoreRememberedMemberFolds() {
  const ids = getRememberedMemberFolds();
  ids.forEach(id => {
    const target = document.getElementById(id);
    if (target?.tagName === 'DETAILS') target.open = true;
  });
}

function initRememberedMemberFolds() {
  document.querySelectorAll('.member-fold, .member-card details').forEach(details => {
    details.addEventListener('toggle', saveRememberedMemberFolds);
  });

  restoreRememberedMemberFolds();

  // Browser back/forward can restore the page from bfcache.
  window.addEventListener('pageshow', () => {
    restoreRememberedMemberFolds();
  });
}

function initMemberSectionNavigation() {
  const nav = document.querySelector('.member-section-nav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => document.getElementById(link.getAttribute('href').slice(1))).filter(Boolean);

  links.forEach(link => {
    link.addEventListener('click', () => {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (target?.tagName === 'DETAILS') target.open = true;
    });
  });

  const setActive = (id) => links.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
  });
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActive(visible.target.id);
  }, { rootMargin: '-22% 0px -65% 0px', threshold: [0, .2, .6] });
  sections.forEach(section => observer.observe(section));
}

function openMemberFold(id, shouldScroll = false) {
  const target = document.getElementById(id);
  if (target?.tagName === 'DETAILS') target.open = true;
  if (shouldScroll && target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

async function loadDirectMessages(initialUserId = '') {
  const list = $('dm-conversations');
  if (!list || !supabaseClient || !currentUser) return;

  try {
    const { data: messages, error } = await supabaseClient
      .from('club_direct_messages')
      .select('id,sender_id,recipient_id,message,created_at')
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) throw error;

    dmMessages = Array.isArray(messages) ? messages : [];
    const ids = dmMessages.map(dmOtherId);
    if (initialUserId) ids.push(initialUserId);

    const profiles = await dmProfiles(ids);
    dmConversations = new Map();

    dmMessages.forEach(message => {
      const userId = dmOtherId(message);
      const existing = dmConversations.get(userId);
      if (!existing || new Date(message.created_at) > new Date(existing.last.created_at)) {
        dmConversations.set(userId, {
          userId,
          profile: profiles.get(userId) || {},
          last: message
        });
      }
    });

    if (initialUserId && !dmConversations.has(initialUserId)) {
      const profile = profiles.get(initialUserId);
      if (profile) {
        dmConversations.set(initialUserId, {
          userId: initialUserId,
          profile,
          last: { created_at: new Date().toISOString(), message: 'Neue Unterhaltung' }
        });
      }
    }

    renderDmConversations();
    await loadDmUnreadCount();

    if (initialUserId && initialUserId !== currentUser.id) {
      openMemberFold('club-messages', true);
      await openDmConversation(initialUserId);
    } else if (dmActiveUserId && dmConversations.has(dmActiveUserId)) {
      renderDmThread();
    }

    if (dmChannel) await supabaseClient.removeChannel(dmChannel);
    dmChannel = supabaseClient
      .channel('acy-direct-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'club_direct_messages',
        filter: `recipient_id=eq.${currentUser.id}`
      }, async payload => {
        if (!dmMessages.some(m => m.id === payload.new.id)) {
          const profileMap = await dmProfiles([payload.new.sender_id]);
          dmMessages.push(payload.new);
          const userId = payload.new.sender_id;
          if (dmActiveUserId !== userId) dmUnreadUsers.add(userId);
          dmConversations.set(userId, {
            userId,
            profile: profileMap.get(userId) || {},
            last: payload.new
          });
          renderDmConversations();
          if (dmActiveUserId === userId) renderDmThread();
        }
        await loadDmUnreadCount();
        await refreshNotificationBadge();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'club_direct_messages',
        filter: `sender_id=eq.${currentUser.id}`
      }, payload => {
        if (!dmMessages.some(m => m.id === payload.new.id)) {
          dmMessages.push(payload.new);
          const userId = payload.new.recipient_id;
          const row = dmConversations.get(userId) || { userId, profile: {}, last: payload.new };
          row.last = payload.new;
          dmConversations.set(userId, row);
          renderDmConversations();
          if (dmActiveUserId === userId) renderDmThread();
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'club_direct_messages'
      }, payload => {
        dmMessages = dmMessages.filter(m => m.id !== payload.old.id);
        loadDirectMessages(dmActiveUserId || '');
      })
      .subscribe();
  } catch (error) {
    console.warn('Direct messages unavailable:', error);
    list.innerHTML = `<div class="club-content-empty">${escapeHtml(error?.message || 'Nachrichten konnten nicht geladen werden.')}</div>`;
  }
}

async function openDmConversation(userId) {
  if (!userId || userId === currentUser.id) return;

  dmActiveUserId = userId;
  openMemberFold('club-messages');
  renderDmConversations();
  await markDmNotificationsRead(userId);
  dmUnreadUsers.delete(userId);
  renderDmConversations();
  renderDmThread();

  const input = $('dm-input');
  input?.focus();
}

$('dm-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('dm-input');
  const button = $('dm-send');
  if (!input || !dmActiveUserId || !supabaseClient) return;

  const message = input.value.trim();
  if (!message) return;

  if (message.length > 1000) {
    dmSetStatus('Maximal 1000 Zeichen.', 'error');
    return;
  }

  button.disabled = true;
  dmSetStatus('');

  try {
    const { error } = await supabaseClient
      .from('club_direct_messages')
      .insert({
        sender_id: currentUser.id,
        recipient_id: dmActiveUserId,
        message
      });

    if (error) throw error;

    // Private messages get a push notification; public chat deliberately does not.
    try {
      const senderProfile = await supabaseClient.from('profiles').select('display_name,username').eq('id', currentUser.id).maybeSingle();
      const { data:sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        void fetch('/api/push-private-message',{
          method:'POST',
          headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
          body:JSON.stringify({
            recipientId:dmActiveUserId,
            senderName:senderProfile?.data?.display_name || senderProfile?.data?.username || 'Jemand',
            message
          })
        }).catch(()=>{});
      }
    } catch {}

    input.value = '';
          void progressQuestsForAction('social_message');
    updateDmCounter();
  } catch (error) {
    console.warn('Direct message send failed:', error);
    dmSetStatus(error.message || 'Nachricht konnte nicht gesendet werden.', 'error');
  } finally {
    button.disabled = false;
  }
});

function updateDmCounter() {
  const input = $('dm-input');
  const counter = $('dm-counter');
  if (input && counter) counter.textContent = `${input.value.length} / 1000`;
}

$('dm-input')?.addEventListener('input', updateDmCounter);
$('dm-input')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('dm-form')?.requestSubmit();
  }
});


// ------------------------------------------------------------
// V5.2 Community Polls
// ------------------------------------------------------------
let activePoll = null;
let pollChannel = null;

async function loadCommunityPoll() {
  const box = $('community-poll');
  const optionsEl = $('poll-options');
  if (!box || !optionsEl || !supabaseClient || !currentUser) return;

  try {
    const now = new Date().toISOString();
    const { data: polls, error: pollError } = await supabaseClient
      .from('club_polls')
      .select('id,question,description,closes_at,created_at')
      .eq('active', true)
      .or(`closes_at.is.null,closes_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (pollError) throw pollError;
    activePoll = polls?.[0] || null;

    if (!activePoll) {
      optionsEl.innerHTML = '<div class="club-content-empty">Gerade gibt es keine aktive Umfrage.</div>';
      setText('poll-question', 'Community Vote');
      setText('poll-description', 'Die nächste Umfrage kommt bald.');
      setText('poll-meta', '');
      return;
    }

    setText('poll-question', activePoll.question);
    setText('poll-description', activePoll.description || 'Stimm ab und gestalte die Community mit.');
    const { data: options, error: optionError } = await supabaseClient
      .from('club_poll_options')
      .select('id,label,sort_order')
      .eq('poll_id', activePoll.id)
      .order('sort_order');

    if (optionError) throw optionError;

    const { data: myVote } = await supabaseClient
      .from('club_poll_votes')
      .select('option_id')
      .eq('poll_id', activePoll.id)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    const { data: votes } = await supabaseClient
      .from('club_poll_votes')
      .select('option_id')
      .eq('poll_id', activePoll.id);

    const counts = new Map();
    (votes || []).forEach(v => counts.set(v.option_id, (counts.get(v.option_id) || 0) + 1));
    const total = (votes || []).length;
    const votedOption = myVote?.option_id || null;

    optionsEl.innerHTML = (options || []).map(option => {
      const count = counts.get(option.id) || 0;
      const percent = total ? Math.round(count / total * 100) : 0;
      const selected = votedOption === option.id;
      return `<button type="button" class="poll-option ${selected ? 'is-selected' : ''}" data-poll-option="${escapeAttr(option.id)}" ${votedOption ? 'disabled' : ''}>
        <span class="poll-option-label"><strong>${escapeHtml(option.label)}</strong><span>${percent}% · ${count}</span></span>
        <span class="poll-bar"><span style="width:${percent}%"></span></span>
      </button>`;
    }).join('');

    if (!options?.length) {
      optionsEl.innerHTML = '<div class="club-content-empty">Diese Umfrage hat noch keine Antworten.</div>';
    }

    optionsEl.querySelectorAll('[data-poll-option]').forEach(button => {
      button.addEventListener('click', () => voteInPoll(Number(button.dataset.pollOption)));
    });

    setText('poll-meta', votedOption
      ? `Deine Stimme ist gespeichert. ${total} ${total === 1 ? 'Stimme' : 'Stimmen'} insgesamt.`
      : `${total} ${total === 1 ? 'Stimme' : 'Stimmen'} bisher · +5 XP für deine Stimme`);
  } catch (error) {
    console.warn('Community poll unavailable:', error);
    optionsEl.innerHTML = `<div class="club-content-empty">${escapeHtml(error?.message || 'Umfrage konnte nicht geladen werden.')}</div>`;
  }

  if (pollChannel) await supabaseClient.removeChannel(pollChannel);
  if (activePoll) {
    pollChannel = supabaseClient.channel(`club-poll-${activePoll.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'club_poll_votes',
        filter: `poll_id=eq.${activePoll.id}`
      }, () => loadCommunityPoll())
      .subscribe();
  }
}

async function voteInPoll(optionId) {
  if (!activePoll || !optionId || !currentUser) return;
  const optionsEl = $('poll-options');
  try {
    optionsEl?.querySelectorAll('button').forEach(b => b.disabled = true);
    const { error } = await supabaseClient
      .from('club_poll_votes')
      .insert({
        poll_id: activePoll.id,
        option_id: optionId,
        user_id: currentUser.id
      });
    if (error) throw error;
    await loadCommunityPoll();
    void progressQuestsForAction('poll_vote');
    await loadProfile();
    await loadMemberStats();
    await loadMemberHub();
  } catch (error) {
    console.warn('Poll vote failed:', error);
    setText('poll-meta', error?.message || 'Stimme konnte nicht gespeichert werden.');
    await loadCommunityPoll();
  }
}



// ------------------------------------------------------------
// V5.6 XP & Achievement Catalog
// ------------------------------------------------------------
const PET_SPECIES = {
  cat:      { icon: '🐱', label: 'Katze', detail: 'Neugierig, gemütlich, leicht beleidigt.' },
  dog:      { icon: '🐶', label: 'Hund', detail: 'Treuer Begleiter mit Energieüberschuss.' },
  fox:      { icon: '🦊', label: 'Fuchs', detail: 'Clever, frech und ziemlich charmant.' },
  axolotl:  { icon: '🦎', label: 'Axolotl', detail: 'Entspannt. Immer. Irgendwie.' },
  dragon:   { icon: '🐲', label: 'Drache', detail: 'Klein angefangen. Große Pläne.' },
  unicorn:  { icon: '🦄', label: 'Einhorn', detail: 'Magisch, selten und völlig übertrieben.' },
  penguin:  { icon: '🐧', label: 'Pinguin', detail: 'Klein, cool und immer schick unterwegs.' },
  panda:    { icon: '🐼', label: 'Panda', detail: 'Gemütlich, knuffig und snackorientiert.' },
  bunny:    { icon: '🐰', label: 'Hase', detail: 'Fluffig, schnell und leicht chaotisch.' },
  koala:    { icon: '🐨', label: 'Koala', detail: 'Professioneller Schlaf- und Kuschelexperte.' },
  hamster:  { icon: '🐹', label: 'Hamster', detail: 'Winzig, wuselig und erstaunlich fleißig.' },
  turtle:   { icon: '🐢', label: 'Schildkröte', detail: 'Langsam, entspannt und unbeeindruckt.' },
  owl:      { icon: '🦉', label: 'Eule', detail: 'Weise, nachtaktiv und leicht mysteriös.' },
  frog:     { icon: '🐸', label: 'Frosch', detail: 'Fröhlich, grün und immer für Quatsch zu haben.' },
  bee:      { icon: '🐝', label: 'Biene', detail: 'Fleißig, klein und ständig beschäftigt.' }
};

let currentPet = null;

const XP_CATALOG = [
  { key: 'registration', icon: '💜', title: 'ACY Club beitreten', xp: 50, detail: 'Einmalig bei der bestätigten Registrierung.' },
  { key: 'profile_complete', icon: '✨', title: 'Profil vervollständigen', xp: 25, detail: 'Anzeigename und Bio ausfüllen.' },
  { key: 'avatar_added', icon: '🖼️', title: 'Profilbild hinzufügen', xp: 25, detail: 'Einmalig für dein erstes gespeichertes Profilbild.' },
  { key: 'discord_connected', icon: '💬', title: 'Discord verbinden', xp: 50, detail: 'Einmalig für die Verbindung mit Discord.' },
  { key: 'event_attended', icon: '🎮', title: 'An einem Event teilnehmen', xp: 100, detail: 'Für jedes Event, an dem du teilnimmst.' },
  { key: 'poll_vote', icon: '🗳️', title: 'Bei einem Community Vote abstimmen', xp: 5, detail: 'Einmal pro Umfrage.' },
  { key: 'member_7_days', icon: '🎉', title: '7 Tage Mitglied sein', xp: 50, detail: 'Einmalig nach einer Woche im ACY Club.' },
  { key: 'member_30_days', icon: '🏅', title: '30 Tage Mitglied sein', xp: 150, detail: 'Einmalig nach 30 Tagen im ACY Club.' }
];

const ACHIEVEMENT_CATALOG = [
  { key: 'acy_rookie', icon: '💜', title: 'ACY Rookie', detail: 'Clubmitglied werden.', progress: () => ({ value: 1, max: 1 }) },
  { key: 'profile_complete', icon: '✨', title: 'Profile Complete', detail: 'Anzeigename und Bio vollständig ausfüllen.', progress: s => ({ value: s.profileComplete ? 1 : 0, max: 1 }) },
  { key: 'discord_member', icon: '💬', title: 'Discord Member', detail: 'Discord mit deinem ACY Club Account verbinden.', progress: s => ({ value: s.discord ? 1 : 0, max: 1 }) },
  { key: 'event_fan', icon: '🎮', title: 'Event Fan', detail: 'An mindestens 1 Event teilnehmen.', progress: s => ({ value: s.events, max: 1 }) },
  { key: 'event_hunter', icon: '🔥', title: 'Event Hunter', detail: 'An 5 Events teilnehmen.', progress: s => ({ value: s.events, max: 5 }) },
  { key: 'event_regular', icon: '⚡', title: 'Event Regular', detail: 'An 10 Events teilnehmen.', progress: s => ({ value: s.events, max: 10 }) },
  { key: 'event_legend', icon: '🏆', title: 'Event Legend', detail: 'An 25 Events teilnehmen.', progress: s => ({ value: s.events, max: 25 }) },
  { key: 'xp_100', icon: '🌟', title: '100 XP Club', detail: '100 XP erreichen.', progress: s => ({ value: s.xp, max: 100 }) },
  { key: 'xp_500', icon: '👑', title: '500 XP Club', detail: '500 XP erreichen.', progress: s => ({ value: s.xp, max: 500 }) },
  { key: 'xp_1000', icon: '💎', title: '1000 XP Club', detail: '1.000 XP erreichen.', progress: s => ({ value: s.xp, max: 1000 }) },
  { key: 'xp_2000', icon: '🏅', title: '2000 XP Club', detail: '2.000 XP erreichen.', progress: s => ({ value: s.xp, max: 2000 }) },
  { key: 'xp_5000', icon: '🔥', title: '5000 XP Club', detail: '5.000 XP erreichen.', progress: s => ({ value: s.xp, max: 5000 }) },
  { key: 'xp_10000', icon: '⚡', title: '10000 XP Club', detail: '10.000 XP erreichen.', progress: s => ({ value: s.xp, max: 10000 }) },
  { key: 'xp_25000', icon: '💠', title: '25000 XP Club', detail: '25.000 XP erreichen.', progress: s => ({ value: s.xp, max: 25000 }) },
  { key: 'acy_og', icon: '👑', title: 'ACY OG', detail: '500 XP erreichen.', progress: s => ({ value: s.xp, max: 500 }) },
  { key: 'acy_legend', icon: '🏆', title: 'ACY Legend', detail: '1.000 XP erreichen.', progress: s => ({ value: s.xp, max: 1000 }) },
  { key: 'early_member', icon: '⏳', title: 'Early Member', detail: '30 Tage Mitglied sein.', progress: s => ({ value: s.days, max: 30 }) },
  { key: 'veteran_member', icon: '🛡️', title: 'ACY Veteran', detail: '90 Tage Mitglied sein.', progress: s => ({ value: s.days, max: 90 }) },
  { key: 'member_180_days', icon: '🗓️', title: 'Half-Year Club', detail: '180 Tage Mitglied sein.', progress: s => ({ value: s.days, max: 180 }) },
  { key: 'member_365_days', icon: '🎂', title: '1 Jahr ACY', detail: '365 Tage Mitglied sein.', progress: s => ({ value: s.days, max: 365 }) },
  { key: 'streak_7', icon: '🔥', title: '7-Tage-Serie', detail: '7 Tage Daily Streak erreichen.', progress: s => ({ value: s.streak, max: 7 }) },
  { key: 'streak_14', icon: '🔥', title: '14-Tage-Serie', detail: '14 Tage Daily Streak erreichen.', progress: s => ({ value: s.streak, max: 14 }) },
  { key: 'streak_30', icon: '💥', title: '30-Tage-Serie', detail: '30 Tage Daily Streak erreichen.', progress: s => ({ value: s.streak, max: 30 }) },
  { key: 'streak_60', icon: '⚡', title: '60-Tage-Serie', detail: '60 Tage Daily Streak erreichen.', progress: s => ({ value: s.streak, max: 60 }) },
  { key: 'streak_100', icon: '💎', title: '100-Tage-Serie', detail: '100 Tage Daily Streak erreichen.', progress: s => ({ value: s.streak, max: 100 }) },
  { key: 'game_explorer', icon: '🧭', title: 'Game Explorer', detail: 'Mindestens 5 verschiedene Games über Discord entdecken.', progress: s => ({ value: s.uniqueGames, max: 5 }) },
  { key: 'game_hunter', icon: '🎮', title: 'Game Hunter', detail: 'Mindestens 15 verschiedene Games über Discord entdecken.', progress: s => ({ value: s.uniqueGames, max: 15 }) },
  { key: 'quest_starter', icon: '🎯', title: 'Quest Starter', detail: 'Deine erste Quest erfolgreich abholen.', progress: s => ({ value: s.questClaims, max: 1 }) },
  { key: 'quest_runner', icon: '🏃', title: 'Quest Runner', detail: '10 Quests erfolgreich abschließen.', progress: s => ({ value: s.questClaims, max: 10 }) },
  { key: 'quest_master', icon: '🧠', title: 'Quest Master', detail: '25 Quests erfolgreich abschließen.', progress: s => ({ value: s.questClaims, max: 25 }) },
  { key: 'member_of_month', icon: '👑', title: 'Member of the Month', detail: 'Von der Community als Spotlight-Mitglied ausgewählt werden.', special: true }
];

function achievementCategoryV10(key){
  const k=String(key||'');
  if(k.startsWith('xp_')||k==='acy_og'||k==='acy_legend')return 'XP';
  if(k.includes('event'))return 'EVENTS';
  if(k.includes('game'))return 'GAMES';
  if(k.includes('quest'))return 'QUESTS';
  if(k.includes('member')||k.includes('profile')||k==='acy_rookie'||k==='discord_member'||k==='early_member'||k==='veteran_member')return 'PROFIL';
  if(k.includes('streak'))return 'STREAK';
  return 'COMMUNITY';
}

let progressionLoadGeneration = 0;

function renderProgressionCatalog(state) {
  const xpList = $('xp-catalog-list');
  const achievementList = $('achievement-catalog-list');
  if (!xpList || !achievementList) return;
  renderProgress(Number(state.xp || 0));
  setText('catalog-render-status', 'V14.3 · Progression geladen');

  const awarded = new Set(state.achievements || []);
  const xpEvents = new Set(state.xpEvents || []);

  xpList.innerHTML = XP_CATALOG.map(item => {
    let earned = false;
    if (item.key === 'event_attended' || item.key === 'poll_vote') {
      earned = item.key === 'event_attended' ? state.events > 0 : [...xpEvents].some(k => k.startsWith('poll_vote_'));
    } else {
      earned = xpEvents.has(item.key);
    }
    const earnedClass = earned ? ' is-earned' : '';
    const label = earned ? '✓ erhalten' : `+${item.xp} XP`;
    return `<div class="catalog-row${earnedClass}">
      <span class="catalog-icon">${item.icon}</span>
      <span class="catalog-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span>
      <span class="catalog-reward">${label}</span>
    </div>`;
  }).join('');

  const unlockedRows = ACHIEVEMENT_CATALOG.map(item => {
    try {
      const progress = typeof item.progress === 'function'
        ? (item.progress(state) || { value: 0, max: 1 })
        : { value: 0, max: 1 };
      const value = Math.max(0, Number(progress.value || 0));
      const max = Math.max(1, Number(progress.max || 1));
      const unlocked = awarded.has(item.key);
      const percent = Math.max(0, Math.min(100, Math.round((value/max)*100)));
      const complete = unlocked || value >= max || percent >= 100;
      return {item,progress,value,max,unlocked,complete,percent,category:achievementCategoryV10(item.key)};
    } catch (error) {
      console.warn('Achievement skipped:', item?.key, error);
      return {item,value:0,max:1,unlocked:awarded.has(item?.key),percent:0,category:achievementCategoryV10(item?.key)};
    }
  });
  const cats=[...new Set(unlockedRows.map(x=>x.category || 'COMMUNITY'))];
  achievementList.innerHTML=cats.map(cat=>`<section class="achievement-category-v10"><div class="achievement-category-head-v10"><span>${escapeHtml(cat)}</span><small>${unlockedRows.filter(x=>x.category===cat&&x.unlocked).length}/${unlockedRows.filter(x=>x.category===cat).length}</small></div><div class="achievement-category-grid-v10">${unlockedRows.filter(x=>x.category===cat).map(x=>{const item=x.item;return `<div class="catalog-row achievement-row${x.complete?' is-unlocked':''}"><div class="catalog-icon">${escapeHtml(item.icon)}</div><div class="catalog-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small><div class="catalog-progress"><span style="width:${x.percent}%"></span></div></div><div class="catalog-status">${x.unlocked?'✓ freigeschaltet':`${x.value}/${x.max}`}</div></div>`;}).join('')}</div></section>`).join('');

  const earnedCount = unlockedRows.filter(row =>
    row.unlocked || row.value >= row.max || row.percent >= 100
  ).length;
  setText('catalog-earned-summary', `${earnedCount} / ${ACHIEVEMENT_CATALOG.length} Achievements`);
  const summaryEl = $('catalog-earned-summary');
  if (summaryEl) summaryEl.dataset.earnedCount = String(earnedCount);
}

async function loadProgressionCatalog() {
  if (!currentUser) return;
  const loadGeneration = ++progressionLoadGeneration;

  const xp = Number($('member-xp')?.textContent?.replace(/[^\d]/g,'') || 0);
  const name = ($('member-name')?.textContent || '').trim();
  const bio = ($('member-bio')?.textContent || '').trim();

  // Always render the complete catalog immediately. No network call may block the UI.
  const localState = {
    xp,
    days: Math.max(0, Math.floor((Date.now() - new Date(currentUser.created_at || Date.now()).getTime()) / 86400000)),
    events: 0,
    discord: false,
    profileComplete: !!name && !!bio,
    uniqueGames: 0,
    questClaims: 0,
    streak: 0,
    achievements: [],
    xpEvents: new Set()
  };

  if (loadGeneration !== progressionLoadGeneration) return;
  renderProgressionCatalog(localState);
  renderClubLevelCatalog(xp);
  applyClubHubGlow(xp);

  // Then enrich the catalog from Supabase without ever replacing the already rendered UI with
  // an empty state. Each request is isolated so one RLS error cannot cancel the rest.
  const safe = async (promise, fallback) => {
    try {
      const result = await promise;
      if (result?.error) {
        console.warn('Progression query skipped:', result.error);
        return fallback;
      }
      return result?.data ?? fallback;
    } catch (error) {
      console.warn('Progression query failed:', error);
      return fallback;
    }
  };

  try {
    const [profile, attendance, achievements, xpEvents, gameLog, questProgress, streakRow] = await Promise.all([
      safe(supabaseClient.from('profiles').select('xp,created_at,display_name,bio,discord_connected').eq('id',currentUser.id).maybeSingle(), null),
      safe(supabaseClient.from('club_event_attendance').select('id').eq('user_id',currentUser.id), []),
      safe(supabaseClient.from('club_achievements').select('achievement_key').eq('user_id',currentUser.id), []),
      safe(supabaseClient.from('club_xp_events').select('event_key,xp').eq('user_id',currentUser.id), []),
      safe(supabaseClient.from('club_game_presence_log').select('game_id').eq('user_id',currentUser.id).gte('detected_at',new Date(Date.now()-90*86400000).toISOString()), []),
      safe(supabaseClient.from('club_quest_progress').select('claimed').eq('user_id',currentUser.id).eq('claimed',true), []),
      safe(supabaseClient.from('club_daily_streaks').select('current_streak').eq('user_id',currentUser.id).maybeSingle(), null)
    ]);

    const effectiveXp = Number(profile?.xp ?? xp);
    const created = profile?.created_at || currentUser.created_at;
    const days = Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000));

    const state = {
      xp: effectiveXp,
      days,
      events: (attendance || []).length,
      discord: !!profile?.discord_connected,
      profileComplete: !!(profile?.display_name || name).trim() && !!(profile?.bio || bio).trim(),
      uniqueGames: new Set((gameLog || []).map(row=>row.game_id).filter(Boolean)).size,
      questClaims: (questProgress || []).length,
      streak: Number(streakRow?.current_streak || 0),
      achievements: (achievements || []).map(a=>a.achievement_key).filter(Boolean),
      xpEvents: new Set((xpEvents || []).filter(e=>Number(e.xp||0)>0).map(e=>e.event_key))
    };

    if (loadGeneration !== progressionLoadGeneration) return;

    renderProgressionCatalog(state);
    renderClubLevelCatalog(effectiveXp);
    applyClubHubGlow(effectiveXp);


  } catch (error) {
    // The UI is already rendered above, so a backend problem cannot leave it stuck loading.
    console.warn('Progression enrichment unavailable:', error);
  }
}


function handleDiscordOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const error = params.get('error') || hash.get('error');
  const errorDescription = params.get('error_description') || hash.get('error_description');

  if (error) {
    const statusEl = $('discord-link-status');
    if (statusEl) {
      statusEl.textContent = `Discord-Verbindung fehlgeschlagen: ${decodeURIComponent(errorDescription || error).replace(/\+/g, ' ')}`;
      statusEl.className = 'club-auth-status error';
    }
    return false;
  }

  return params.has('code') || hash.has('access_token') || hash.has('refresh_token');
}

function petLevelForXp(xp = 0) {
  const levels = [
    { min: 0, level: 1, title: 'Kleiner Begleiter', effect: 'basic' },
    { min: 100, level: 2, title: 'Vertrauter Freund', effect: 'glow' },
    { min: 250, level: 3, title: 'Treuer Gefährte', effect: 'sparkle' },
    { min: 500, level: 4, title: 'ACY Sidekick', effect: 'crown' },
    { min: 1000, level: 5, title: 'ACY Legende', effect: 'legendary' }
  ];
  let current = levels[0];
  for (const entry of levels) if (xp >= entry.min) current = entry;
  const nextEntry = levels.find(entry => entry.min > xp);
  return {
    ...current,
    next: nextEntry ? nextEntry.min : null,
    nextTitle: nextEntry?.title || null
  };
}

function renderPetChoices(selected = '') {
  const grid = $('pet-choice-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(PET_SPECIES).map(([key, pet]) => `
    <label class="pet-choice ${selected === key ? 'is-selected' : ''}">
      <input type="radio" name="pet-species" value="${escapeAttr(key)}" ${selected === key ? 'checked' : ''}>
      <span class="pet-choice-icon"><img src="assets/pet-${escapeAttr(key)}.webp" alt="${escapeAttr(pet.label)}"></span>
      <span class="pet-choice-copy"><strong>${escapeHtml(pet.label)}</strong><small>${escapeHtml(pet.detail)}</small></span>
    </label>
  `).join('');

  grid.querySelectorAll('input[name="pet-species"]').forEach(input => {
    input.addEventListener('change', () => {
      grid.querySelectorAll('.pet-choice').forEach(card => card.classList.toggle('is-selected', card.querySelector('input')?.checked));
    });
  });
}

function renderPet(pet) {
  currentPet = pet || null;
  const empty = $('pet-empty-state');
  const active = $('pet-active-state');
  const chip = $('pet-level-chip');
  if (!empty || !active || !chip) return;

  if (!pet) {
    empty.hidden = false;
    active.hidden = true;
    chip.textContent = 'Noch kein Tier';
    renderPetChoices();
    return;
  }

  empty.hidden = true;
  active.hidden = false;

  const species = PET_SPECIES[pet.species] || { icon: '🐾', label: 'Begleiter', detail: '' };
  const level = petLevelForXp(Number(pet.pet_xp || 0));

  const petAvatar = $('pet-avatar');
  if (petAvatar) {
    petAvatar.className = `pet-avatar pet-level-${level.level} pet-effect-${level.effect}`;
    petAvatar.innerHTML = `<img src="assets/pet-${escapeAttr(pet.species)}.webp" alt="${escapeAttr(species.label)}">`;
  }
  setText('pet-species-label', species.label.toUpperCase());
  setText('pet-display-name', pet.name);
  setText('pet-level-text', `Level ${level.level} · ${Number(pet.pet_xp || 0)} Pflege-XP · ${level.title}`);
  chip.textContent = `Level ${level.level} · ${level.title}`;

  const stats = [
    ['hunger', 'pet-hunger-value', 'pet-hunger-bar'],
    ['happiness', 'pet-happiness-value', 'pet-happiness-bar'],
    ['energy', 'pet-energy-value', 'pet-energy-bar']
  ];
  stats.forEach(([key, valueId, barId]) => {
    const value = Math.max(0, Math.min(100, Number(pet[key] || 0)));
    setText(valueId, `${value}%`);
    const bar = $(barId);
    if (bar) bar.style.width = `${value}%`;
  });

  const next = level.next;
  setText('pet-xp-note', next
    ? `Noch ${Math.max(0, next - Number(pet.pet_xp || 0))} Pflege-XP bis ${level.nextTitle}`
    : 'Maximales Tier-Level erreicht.');

  setText('pet-progression-title', level.title);
  const fill = $('pet-progression-fill');
  if (fill) {
    const thresholds = [0,100,250,500,1000];
    const base = thresholds[level.level - 1];
    const nextThreshold = level.next ?? base + 1;
    const progress = level.next
      ? Math.max(0, Math.min(100, ((Number(pet.pet_xp || 0) - base) / Math.max(1, nextThreshold - base)) * 100))
      : 100;
    fill.style.width = `${progress}%`;
  }
  document.querySelectorAll('[data-pet-level]').forEach(step => {
    step.classList.toggle('is-current', Number(step.dataset.petLevel) === level.level);
    step.classList.toggle('is-complete', Number(step.dataset.petLevel) < level.level);
  });
  setText('pet-care-note', 'Hunger −1/h · Laune −0,5/h · Energie −0,5/h · 72h bei 0 = Tod.');
  if ($('pet-rename-input')) $('pet-rename-input').value = pet.name;
}


function initV10SettingsActions(){
  $('settings-open-notifications')?.addEventListener('click',()=>{$('notification-settings')?.setAttribute('open','');$('notification-settings')?.scrollIntoView({behavior:'smooth',block:'center'});});
  $('settings-toggle-sounds')?.addEventListener('click',()=>{const enabled=!soundEnabled();setSoundEnabled(enabled);setText('settings-v10-message',enabled?'Interface-Sounds aktiviert.':'Interface-Sounds deaktiviert.');});
}

async function loadNotificationPreferences() {
  const { data, error } = await supabaseClient.rpc('get_my_notification_preferences');
  if (error) throw error;

  const p = data || {};
  const setChecked = (id, value) => {
    const el = $(id);
    if (el) el.checked = value !== false;
  };

  setChecked('pref-in-app', p.in_app_enabled);
  setChecked('pref-email-enabled', p.email_enabled);

  const map = {
    'email-votes': 'email_votes',
    'email-events': 'email_events',
    'email-news': 'email_news',
    'email-live': 'email_live',
    'email-achievements': 'email_achievements',
    'email-direct-messages': 'email_direct_messages',
    'email-spotlight': 'email_spotlight',
    'email-rewards': 'email_rewards',
    'email-pet': 'email_pet'
  };

  for (const [id, key] of Object.entries(map)) {
    const el = document.querySelector(`[data-pref="${id}"]`);
    if (el) el.checked = p[key] !== false;
  }

  setText('notification-settings-email', currentUser?.email || '–');
  setText('notification-settings-status', p.email_enabled ? 'E-Mail aktiviert' : 'E-Mail deaktiviert');
}

$('save-notification-settings')?.addEventListener('click', async () => {
  const checked = id => Boolean($(id)?.checked);
  const pref = id => Boolean(document.querySelector(`[data-pref="${id}"]`)?.checked);
  const button = $('save-notification-settings');
  const status = $('notification-settings-message');

  if (button) {
    button.disabled = true;
    button.textContent = 'Speichert…';
  }

  try {
    const { data, error } = await supabaseClient.rpc('save_my_notification_preferences', {
      p_in_app_enabled: checked('pref-in-app'),
      p_email_enabled: checked('pref-email-enabled'),
      p_email_votes: pref('email-votes'),
      p_email_events: pref('email-events'),
      p_email_news: pref('email-news'),
      p_email_live: pref('email-live'),
      p_email_achievements: pref('email-achievements'),
      p_email_direct_messages: pref('email-direct-messages'),
      p_email_spotlight: pref('email-spotlight'),
      p_email_rewards: pref('email-rewards'),
      p_email_pet: pref('email-pet')
    });
    if (error) throw error;

    setText('notification-settings-status', data?.email_enabled ? 'E-Mail aktiviert' : 'Gespeichert');
    if (status) {
      status.textContent = 'Benachrichtigungseinstellungen gespeichert.';
      status.className = 'club-auth-status success';
    }
  } catch (error) {
    if (status) {
      status.textContent = error?.message || 'Einstellungen konnten nicht gespeichert werden.';
      status.className = 'club-auth-status error';
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Einstellungen speichern';
    }
  }
});

async function loadPet() {
  if (!supabaseClient || !currentUser) return;
  try {
    // Use the server-side RPC so loading is reliable even when the table's
    // client-side RLS policy is temporarily out of sync.
    const { data, error } = await supabaseClient.rpc('get_club_pet');
    if (error) throw error;
    if (data?._died) {
      renderPet(null);
      const label = PET_SPECIES[data.species]?.label || 'Begleiter';
      setPetStatus(`Dein ${label} ${data.name} ist leider gestorben. ${data.reason || ''} Du kannst jetzt einen neuen Begleiter adoptieren.`, 'error');
      return;
    }
    renderPet(data || null);
    if (data) setPetStatus('', '');
  } catch (error) {
    console.warn('Pet unavailable:', error);
    // Never leave the demo/placeholder pet visible when the database load fails.
    renderPet(null);
    const status = $('pet-status');
    if (status) {
      status.textContent = `Tier-Datenbank noch nicht bereit: ${error?.message || 'Unbekannter Fehler'}`;
      status.className = 'club-auth-status error';
    }
  }
}

async function createPet(species, name) {
  const { data, error } = await supabaseClient.rpc('create_club_pet', {
    p_species: species,
    p_name: name
  });
  if (error) throw error;
  renderPet(data);
  await loadProfile();
  setPetStatus('Dein Begleiter ist eingezogen. 🐾', 'success');
}

async function replacePet(species, name) {
  const { data, error } = await supabaseClient.rpc('replace_club_pet', {
    p_species: species,
    p_name: name
  });
  if (error) throw error;
  renderPet(data);
  await loadProfile();
  setPetStatus('Dein neuer Begleiter ist eingezogen. 🐾', 'success');
}

async function releasePet() {
  const { error } = await supabaseClient.rpc('release_club_pet');
  if (error) throw error;
  renderPet(null);
  setPetStatus('Dein Begleiter wurde verabschiedet. Du kannst jederzeit ein neues Tier adoptieren.', 'success');
}

$('pet-switch-toggle')?.addEventListener('click', () => {
  const empty = $('pet-empty-state');
  if (!empty) return;
  empty.hidden = !empty.hidden;
  if (!empty.hidden) {
    renderPetChoices(currentPet?.species || '');
    $('pet-name-input').value = currentPet?.name || '';
    $('pet-name-input')?.focus();
  }
});

$('pet-release-toggle')?.addEventListener('click', async () => {
  if (!currentPet) return;
  const ok = window.confirm(`Möchtest du ${currentPet.name} wirklich abgeben? Das aktuelle Tier und seine Pflege-XP werden gelöscht.`);
  if (!ok) return;
  const button = $('pet-release-toggle');
  if (button) button.disabled = true;
  try {
    await releasePet();
  } catch (error) {
    setPetStatus(error?.message || 'Tier konnte nicht abgegeben werden.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
});

async function performPetAction(action, button) {
  if (!currentPet || !button) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = action === 'feed' ? 'Füttere…' : action === 'play' ? 'Spiele…' : 'Streicheln…';

  try {
    const { data, error } = await supabaseClient.rpc('club_pet_action', { p_action: action });
    if (error) throw error;
    renderPet(data);
    if (data?.daily_xp_awarded) {
      void progressQuestsForAction('pet_daily');
      setPetStatus('Pflegeaktion erledigt: +5 Pflege-XP. 🐾', 'success');
      void sendPersonalEmailNotification(
        'pet',
        'Dein Pet war aktiv 🐾',
        'Deine Tierpflege ist erledigt. Dein Pet hat dafür +5 Pflege-XP erhalten.',
        '/club-profile.html#pet-section'
      );
    } else {
      setPetStatus('Dein Tier freut sich. 🐾', 'success');
    }
    await loadProfile();
    await loadProgressionCatalog();
    await loadMemberHub();
    await checkAchievements();
  } catch (error) {
    setPetStatus(error?.message || 'Aktion konnte nicht ausgeführt werden.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

$('pet-create-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const species = document.querySelector('input[name="pet-species"]:checked')?.value;
  const name = $('pet-name-input')?.value.trim();
  if (!species) return setPetStatus('Bitte zuerst ein Tier auswählen.', 'error');
  if (!name || name.length < 2) return setPetStatus('Der Name muss mindestens 2 Zeichen lang sein.', 'error');

  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Wird adoptiert…'; }
  try {
    if (currentPet) {
      const ok = window.confirm(`Dein aktuelles Tier ${currentPet.name} wird durch ein neues Tier ersetzt. Pflege-XP und Werte des alten Tiers werden zurückgesetzt. Fortfahren?`);
      if (!ok) return;
      await replacePet(species, name);
      $('pet-empty-state').hidden = true;
    } else {
      await createPet(species, name);
    }
  } catch (error) {
    setPetStatus(error?.message || 'Tier konnte nicht adoptiert werden.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Tier adoptieren'; }
  }
});

document.querySelectorAll('.pet-action-btn').forEach(button => {
  button.addEventListener('click', () => performPetAction(button.dataset.petAction, button));
});

$('pet-rename-toggle')?.addEventListener('click', () => {
  const form = $('pet-rename-form');
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) $('pet-rename-input')?.focus();
});

$('pet-rename-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('pet-rename-input')?.value.trim();
  if (!name || name.length < 2) return setPetStatus('Der Name muss mindestens 2 Zeichen lang sein.', 'error');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Speichern…'; }
  try {
    const { data, error } = await supabaseClient.rpc('rename_club_pet', { p_name: name });
    if (error) throw error;
    renderPet(data);
    $('pet-rename-form').hidden = true;
    setPetStatus('Name gespeichert.', 'success');
  } catch (error) {
    setPetStatus(error?.message || 'Name konnte nicht geändert werden.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Speichern'; }
  }
});


// V7.7 ACY Glücksrad
const WHEEL_SEGMENTS = [
  {key:'xp_25',angle:0},{key:'xp_50',angle:30},{key:'xp_100',angle:60},
  {key:'xp_250',angle:90},{key:'xp_500',angle:120},{key:'xp_1000',angle:150},
  {key:'pet_care',angle:180},{key:'pet_boost_big',angle:210},
  {key:'extra_spin',angle:240},{key:'extra_spin_2',angle:270},
  {key:'twitch_reward',angle:300},{key:'xp_jackpot',angle:330}
];

function formatWheelDate(value){
  try{return new Date(value).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '';}
}
async function loadWheelHistory(){
  const list=$('wheel-history');
  if(!list||!supabaseClient||!currentUser)return;
  const {data,error}=await supabaseClient.from('club_wheel_spins')
    .select('reward_label,reward_value,created_at').eq('user_id',currentUser.id)
    .order('created_at',{ascending:false}).limit(5);
  if(error){console.warn('Wheel history unavailable:',error);return;}
  list.innerHTML=data?.length?data.map(row=>`<div class="wheel-history-row"><strong>${escapeHtml(row.reward_label||'Reward')}</strong><small>${formatWheelDate(row.created_at)}</small></div>`).join(''):'<div class="club-content-empty">Noch keine Drehungen.</div>';
}

async function getWheelTokenBalance(){
  if(!supabaseClient||!currentUser)return 0;
  try{
    const {data,error}=await supabaseClient.from('profiles').select('wheel_spin_tokens').eq('id',currentUser.id).maybeSingle();
    if(error)throw error;
    return Math.max(0,Number(data?.wheel_spin_tokens||0));
  }catch(error){
    console.warn('Wheel token balance unavailable:',error);
    return 0;
  }
}

function setWheelLoadingState(){
  const button=$('club-wheel-spin');
  const chip=$('wheel-status-chip');
  if(button){
    button.disabled=true;
    button.textContent='⏳ Status wird geladen…';
  }
  if(chip)chip.textContent='Status wird geladen…';
}

function setWheelUnavailableState(){
  const button=$('club-wheel-spin');
  const chip=$('wheel-status-chip');
  if(button){
    button.disabled=true;
    button.textContent='⚠️ Status nicht verfügbar';
  }
  if(chip)chip.textContent='Status nicht verfügbar';
}

function setWheelCooldown(nextFreeAt, spinTokens = 0){
  const button=$('club-wheel-spin');
  const chip=$('wheel-status-chip');
  const tokens=Math.max(0,Number(spinTokens||0));

  // Extra spins intentionally bypass the daily cooldown.
  if(tokens>0){
    if(button){
      button.disabled=false;
      button.textContent=`🎡 Drehen · Extra-Dreh (${tokens})`;
    }
    if(chip)chip.textContent=`${tokens} Extra-Dreh${tokens===1?'':'e'} verfügbar`;
    return;
  }

  if(!nextFreeAt){
    if(button){button.disabled=false;button.textContent='🎡 Drehen';}
    if(chip)chip.textContent='1 Dreh verfügbar';
    return;
  }

  const next=new Date(nextFreeAt).getTime();
  if(!Number.isFinite(next)){
    setWheelUnavailableState();
    return;
  }

  let timer=null;
  const tick=()=>{
    const left=Math.max(0,next-Date.now());
    if(!left){
      if(button){button.disabled=false;button.textContent='🎡 Drehen';}
      if(chip)chip.textContent='1 Dreh verfügbar';
      if(timer)clearInterval(timer);
      return;
    }
    const h=Math.floor(left/3600000);
    const m=Math.floor((left%3600000)/60000);
    if(button){button.disabled=true;button.textContent='⏳ Später wieder';}
    if(chip)chip.textContent=`Nächster Dreh in ${h}h ${m}m`;
  };
  tick();
  timer=setInterval(tick,30000);
}

async function spinWheel(){
  const button=$('club-wheel-spin'),message=$('wheel-message'),wheel=$('club-wheel');
  if(!button||!message||!wheel||!supabaseClient||!currentUser)return;
  button.disabled=true;message.textContent='Das Rad dreht…';message.className='club-auth-status';
  try{
    const {data,error}=await supabaseClient.rpc('spin_club_wheel');
    if(error)throw error;
    if(data?.cooldown){
      message.textContent=`Dein nächster Dreh ist um ${formatWheelDate(data.next_free_at)} verfügbar.`;
      message.className='club-auth-status error';
      setWheelCooldown(data.next_free_at, data.spin_tokens);
    await loadWheelState();return;
    }
    const seg=WHEEL_SEGMENTS.find(s=>s.key===data.reward_key)||WHEEL_SEGMENTS[0];
    wheel.style.setProperty('--wheel-stop',`${1800+(360-seg.angle)}deg`);
    wheel.classList.remove('is-spinning');void wheel.offsetWidth;wheel.classList.add('is-spinning');
    await new Promise(resolve=>setTimeout(resolve,3400));
    message.textContent=`🎉 ${data.reward_label}${data.reward_class==='spin'?' · Du kannst sofort noch einmal drehen.':data.total_xp!=null?` · Jetzt ${Number(data.total_xp).toLocaleString('de-DE')} XP.`:''}`;
    triggerClubEffect(data.reward_class==='xp' ? 'reward' : 'level', `🎉 ${data.reward_label}`);
    if (['extra_spin','twitch_reward'].includes(data.reward_key) || Number(data.reward_value||0) >= 250) {
      void sendDiscordCommunityEvent('wheel_rare_reward', {reward:`${data.reward_label}`}, `wheel-${currentUser.id}-${Date.now()}`);
    }
    message.className='club-auth-status success';
    if(Number.isFinite(data.total_xp)){renderProgress(data.total_xp);setText('member-xp',`${data.total_xp} XP`);}
    if(data.reward_class==='pet')await loadPet();
    void progressQuestsForAction('wheel_spin');
      await loadWheelHistory();
    await loadMyRewards();
    setWheelCooldown(data.next_free_at, data.spin_tokens);
    await loadWheelState();
  }catch(error){
    console.error('Wheel spin error:',error);message.textContent=error?.message||'Das Glücksrad konnte nicht gedreht werden.';
    message.className='club-auth-status error';button.disabled=false;
  }
}
document.getElementById('club-wheel-spin')?.addEventListener('click',spinWheel);
async function loadWheelState(){
  if(!supabaseClient||!currentUser)return false;
  setWheelLoadingState();

  try{
    const [{data:profile,error:profileError},{data:latestSpin,error:spinError}]=await Promise.all([
      supabaseClient.from('profiles')
        .select('wheel_spin_tokens')
        .eq('id',currentUser.id)
        .maybeSingle(),
      supabaseClient.from('club_wheel_spins')
        .select('created_at')
        .eq('user_id',currentUser.id)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle()
    ]);

    if(profileError)throw profileError;
    if(spinError)throw spinError;

    const tokens=Math.max(0,Number(profile?.wheel_spin_tokens||0));
    setText('reward-spin-token-count',String(tokens));

    const last=latestSpin?.created_at?new Date(latestSpin.created_at).getTime():0;
    const validLast=Number.isFinite(last)&&last>0;
    const nextFreeAt=validLast
      ? new Date(last+86400000).toISOString()
      : null;

    setWheelCooldown(nextFreeAt,tokens);
    return true;
  }catch(error){
    console.warn('Wheel state unavailable:',error);
    setWheelUnavailableState();
    return false;
  }
}


// V7.8 Rewards
let myRewardsState = {catalog:[],inventory:[]};

async function loadMyRewards(){
  const list=$('my-rewards-list'), catalog=$('reward-catalog-list');
  if(!list||!catalog||!supabaseClient)return;
  try{
    // Rewards inventory tells us which items are still available to redeem.
    // Extra-Dreh is different: once redeemed, the inventory item becomes
    // "used" and the actual spin token lives on profiles.wheel_spin_tokens.
    const [{data,error},{data:profile,error:profileError}] = await Promise.all([
      supabaseClient.rpc('get_my_rewards'),
      supabaseClient.from('profiles').select('wheel_spin_tokens').eq('id',currentUser.id).maybeSingle()
    ]);
    if(error)throw error;
    if(profileError)throw profileError;

    myRewardsState=data||{catalog:[],inventory:[]};
    const inv=Array.isArray(myRewardsState.inventory)?myRewardsState.inventory:[];
    const available=inv.filter(x=>x.status==='available');
    const used=inv.filter(x=>x.status==='used');

    const spinTokens=Math.max(0,Number(profile?.wheel_spin_tokens||0));

    setText('my-rewards-count',`${available.length} verfügbar`);
    setText('reward-available-count',String(available.length));
    setText('reward-used-count',String(used.length));
    setText('reward-spin-token-count',String(spinTokens));

    list.innerHTML=available.length?available.map(item=>`
      <article class="my-reward-card">
        <div class="my-reward-icon">${escapeHtml(item.icon||'🎁')}</div>
        <div class="my-reward-main"><strong>${escapeHtml(item.name||'Reward')}</strong><small>${escapeHtml(item.description||'')}</small></div>
        <button class="button button-primary button-small" type="button" data-use-reward="${escapeAttr(item.id)}">Einlösen</button>
      </article>
    `).join(''):'<div class="club-content-empty">Noch keine verfügbaren Rewards. Vielleicht dreht das Glücksrad ja mal für dich.</div>';

    const cats=Array.isArray(myRewardsState.catalog)?myRewardsState.catalog:[];
    catalog.innerHTML=cats.length?cats.map(item=>`
      <article class="reward-catalog-card">
        <span>${escapeHtml(item.icon||'🎁')}</span>
        <div><strong>${escapeHtml(item.name||'Reward')}</strong><small>${escapeHtml(item.description||'')}</small></div>
      </article>
    `).join(''):'<div class="club-content-empty">Noch kein Reward-Katalog.</div>';

    list.querySelectorAll('[data-use-reward]').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        btn.disabled=true;btn.textContent='Wird eingelöst…';
        try{
          const {data:result,error}=await supabaseClient.rpc('use_reward',{p_inventory_id:btn.dataset.useReward});
          if(error)throw error;
          if(Number.isFinite(result?.total_xp)){renderProgress(result.total_xp);setText('member-xp',`${result.total_xp} XP`);}
          setText('rewards-message',`🎁 ${result?.name||'Reward'} eingelöst.`);
          triggerClubEffect('reward', `🎁 ${result?.name||'Reward'} eingelöst.`);
          if (['twitch','wheel_spin'].includes(result?.reward_type)) {
            void sendDiscordCommunityEvent('reward_rare', {reward: `${result?.icon||'🎁'} ${result?.name||'Reward'}`}, `reward-${btn.dataset.useReward}-${result?.reward_type}-${Date.now()}`);
            void sendPersonalEmailNotification(
              'reward',
              'Neuer Reward 🎁',
              `Du hast im ACY Club „${result?.name||'einen Reward'}“ erhalten.`,
              '/club-profile.html#club-rewards-section'
            );
          }
          const status=$('rewards-message'); if(status)status.className='club-auth-status success';

          // Immediately refresh both Rewards and wheel-token display.
          await loadMyRewards();

          if(result?.reward_type==='wheel_spin'){
            const currentTokens=Number(result?.spin_tokens||0);
            setText('wheel-status-chip',`${currentTokens>1?currentTokens+' Extra-Drehs':'Extra-Dreh'} verfügbar`);
            setText('wheel-message','Du hast einen Extra-Dreh erhalten.');
          }
        }catch(error){
          btn.disabled=false;btn.textContent='Einlösen';
          const status=$('rewards-message');
          if(status){
            const raw=String(error?.message||'');
            status.textContent=/wheel_spin_tokens/i.test(raw)
              ? 'Reward-System: Die Extra-Dreh-Spalte fehlt noch in Supabase. Bitte supabase/club_rewards.sql einmal ausführen.'
              : (raw||'Reward konnte nicht eingelöst werden.');
            status.className='club-auth-status error';
          }
        }
      });
    });
  }catch(error){
    console.warn('Rewards unavailable:',error);
    list.innerHTML='<div class="club-content-empty">Rewards konnten gerade nicht geladen werden.</div>';
    catalog.innerHTML='';
  }
}


// V14.1 — Daily Streak uses a real 24-hour cooldown instead of a calendar-day lock.
let dailyStreakTimer = null;
let dailyStreakState = null;

function formatStreakCooldown(ms){
  const totalMinutes=Math.max(0,Math.ceil(ms/60000));
  const hours=Math.floor(totalMinutes/60);
  const minutes=totalMinutes%60;
  if(hours>0) return `${hours} Std. ${String(minutes).padStart(2,'0')} Min.`;
  return `${minutes} Min.`;
}

function streakRewardFor(streak){
  const value=Math.max(1,Number(streak)||1);
  return value>=30?100:value>=14?75:value>=7?50:value>=3?35:25;
}

function renderDailyStreakState(){
  const state=dailyStreakState;
  if(!state)return;
  const {row,button,title,text,reward}=state;
  const petArt = $('daily-streak-pet-art');
  if (petArt) {
    const species = currentPet?.species || 'cat';
    const label = PET_SPECIES[species]?.label || 'Begleiter';
    petArt.innerHTML = `<img src="assets/pet-${escapeAttr(species)}.webp" alt="${escapeAttr(label)}">`;
  }
  const now=Date.now();
  const lastMs=row.last_checkin_at?new Date(row.last_checkin_at).getTime():0;
  const cooldownUntil=lastMs+24*60*60*1000;
  const cooldownActive=Boolean(lastMs)&&now<cooldownUntil;
  const nextStreak=(lastMs && now-lastMs<=48*60*60*1000)
    ? Math.max(1,Number(row.current_streak||0)+1)
    : 1;
  const nextReward=streakRewardFor(nextStreak);

  setText('daily-streak-current',String(row.current_streak||0));
  setText('daily-streak-best',String(row.best_streak||0));
  setText('daily-streak-total',String(row.total_checkins||0));
  setText('daily-streak-chip',`${Number(row.current_streak||0)} Tage`);

  if(cooldownActive){
    const remaining=cooldownUntil-now;
    setText('daily-streak-reward',`+${streakRewardFor(row.current_streak||1)} XP`);
    setText('daily-streak-title','Heute schon erledigt. 💜');
    setText('daily-streak-text',`Dein nächster Check-in ist in ${formatStreakCooldown(remaining)} möglich. Die 24 Stunden zählen ab deinem letzten Check-in.`);
    if(button){
      button.disabled=true;
      button.textContent=`⏳ Noch ${formatStreakCooldown(remaining)}`;
    }
    return;
  }

  setText('daily-streak-reward',`+${nextReward} XP`);
  if(lastMs && now-lastMs<=48*60*60*1000){
    setText('daily-streak-title','Weiter so! 🔥');
    setText('daily-streak-text',`Dein 24h-Cooldown ist vorbei. Mit dem nächsten Check-in wird deine Serie auf ${nextStreak} Tage erhöht.`);
  }else if(lastMs){
    setText('daily-streak-title','Neue Serie starten. 🔥');
    setText('daily-streak-text','Dein letzter Check-in ist länger als 48 Stunden her. Mit dem nächsten Check-in startest du eine neue Serie.');
  }else{
    setText('daily-streak-title','Starte deine Serie.');
    setText('daily-streak-text','Dein erster Check-in gibt dir direkt XP.');
  }
  if(button){
    button.disabled=false;
    button.textContent=`🔥 +${nextReward} XP abholen`;
  }
}

async function loadDailyStreak(){
  const current=$('daily-streak-current');
  const button=$('daily-streak-claim');
  if(!current||!supabaseClient||!currentUser)return;

  try{
    const {data,error}=await supabaseClient.from('club_daily_streaks')
      .select('current_streak,best_streak,total_checkins,last_checkin_date,last_checkin_at')
      .eq('user_id',currentUser.id).maybeSingle();
    if(error)throw error;

    const row=data||{current_streak:0,best_streak:0,total_checkins:0,last_checkin_date:null,last_checkin_at:null};
    dailyStreakState={row,button};
    renderDailyStreakState();

    if(dailyStreakTimer)clearInterval(dailyStreakTimer);
    dailyStreakTimer=setInterval(renderDailyStreakState,30000);
  }catch(error){
    console.warn('Daily streak unavailable:',error);
  }
}

async function claimDailyStreak(){
  const button=$('daily-streak-claim'),message=$('daily-streak-message');
  if(!button||!supabaseClient||!currentUser)return;
  button.disabled=true;
  if(message){message.textContent='Check-in wird gespeichert…';message.className='club-auth-status';}
  try{
    const {data,error}=await supabaseClient.rpc('claim_daily_streak');
    if(error)throw error;
    if(data?.claimed){
      const achievementText = data.new_achievement ? ` · 🏆 ${data.new_achievement}` : '';
      setText('daily-streak-message',`🔥 +${data.reward_xp} XP · Serie: ${data.current_streak} Tage!${achievementText}`);
      triggerClubEffect(data.new_achievement ? 'level' : 'reward', data.new_achievement ? `🏆 ${data.new_achievement} freigeschaltet!` : `🔥 Tagesbonus +${data.reward_xp} XP`);
      if (data.new_achievement) {
        void sendDiscordCommunityEvent('daily_streak_milestone', {days:data.current_streak}, `streak-${currentUser.id}-${data.current_streak}`);
        void sendDiscordCommunityEvent('achievement_unlocked', {achievement:data.new_achievement}, `achievement-${currentUser.id}-${data.new_achievement}`);
        void sendPersonalEmailNotification(
          'achievement',
          'Achievement freigeschaltet 🏆',
          `Du hast im ACY Club das Achievement „${data.new_achievement}“ freigeschaltet.`,
          '/club-profile.html#club-quests-section'
        );
      }
      const status=$('daily-streak-message');if(status)status.className='club-auth-status success';
      if(Number.isFinite(data.total_xp)){renderProgress(data.total_xp);setText('member-xp',`${data.total_xp} XP`);}
    }else{
      const remaining=Number(data?.cooldown_remaining_seconds||0)*1000;
      setText('daily-streak-message',remaining>0?`⏳ Noch ${formatStreakCooldown(remaining)} bis zum nächsten Check-in.`:'Heute bereits abgeholt. 💜');
      const status=$('daily-streak-message');if(status)status.className='club-auth-status';
    }
    await loadDailyStreak();
  }catch(error){
    if(message){message.textContent=error?.message||'Tagesbonus konnte nicht abgeholt werden.';message.className='club-auth-status error';}
    button.disabled=false;
    await loadDailyStreak();
  }
}
document.getElementById('daily-streak-claim')?.addEventListener('click',claimDailyStreak);

async function loadModeratorAccessShortcut(){
  const link=$('moderator-access-btn');
  if(!link||!currentUser)return;
  try{
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(!token)return;
    const response=await fetch('/api/mod-auth',{
      headers:{Authorization:`Bearer ${token}`},
      cache:'no-store'
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)return;
    const allowed=payload?.isModerator===true;
    link.hidden=!allowed;
    if(allowed){
      link.textContent=payload.isAdmin ? '⚙️ Admin / Mod' : '🛡️ Moderator';
      link.title=payload.isAdmin ? 'Admin- und Moderationsbereich öffnen' : 'Moderationsbereich öffnen';
    }
  }catch(error){
    console.warn('Moderator shortcut unavailable:',error);
  }
}

async function init() {
  try {
    const cfg = await (await fetch('/api/config', { cache: 'no-store' })).json();
    if (!cfg.configured) throw new Error('Supabase ist noch nicht konfiguriert.');
    supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
    });
    window.__acySupabaseClient = supabaseClient;
    window.dispatchEvent(new CustomEvent('acy:supabase-ready', { detail: { client: supabaseClient } }));
    initAcyRefreshSystem();

    const oauthCallback = handleDiscordOAuthCallback();
    const { data } = await supabaseClient.auth.getSession();
    if (!data?.session?.user) {
      window.location.href = '/club.html';
      return;
    }

    currentUser = data.session.user;

    // Priority UI: identity, games and pet must not wait behind optional widgets.
    initMemberSectionNavigation();
    initSoundToggle();
    initNotificationFilters();
    initV10SettingsActions();
    initMemberDirectoryFilters();
    initRememberedMemberFolds();
    void safeLoad('Profile', loadProfile);
    void safeLoad('Current Game', loadCurrentGamePresence);
    void safeLoad('Pet', loadPet);
    void safeLoad('Twitch', loadTwitch);
    void safeLoad('Twitch Account', loadTwitchAccountV11);
    void safeLoad('Discord', loadDiscordLink);
    void safeLoad('Moderator Access', loadModeratorAccessShortcut);

    const dmTarget = new URLSearchParams(window.location.search).get('dm');

    // Supabase may finish the OAuth identity exchange immediately after the
    // initial session promise resolves. Give the auth client one turn to
    // settle, then verify the identity again.
    if (oauthCallback) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Registration XP is awarded after the email-confirmed session exists.
    // The server-side unique constraint makes this safe to call more than once.
    void safeLoad('Registration XP', () => awardProgression('registration'));
    void safeLoad('Twitch Init', initTwitchAccountV11);
    startTwitchAutoWatchV11();
    const twitchParams=new URLSearchParams(window.location.search);
    if(twitchParams.get('twitch_connected')==='1'){
      setStatus('Twitch wurde erfolgreich verbunden.','success');
      history.replaceState({},'',window.location.pathname+window.location.hash);
    }else if(twitchParams.get('twitch_error')){
      setStatus(decodeURIComponent(twitchParams.get('twitch_error')),'error');
      history.replaceState({},'',window.location.pathname+window.location.hash);
    }
    startTwitchStatusPolling();
    initQuestTabs();
    startMemberDirectoryPolling();
    startNotificationRealtime();

    // V14.3 — load in bounded batches instead of launching ~25 requests at once.
    // Critical identity/game/pet/Twitch modules already started above. Optional
    // modules are queued in small groups so a slow endpoint cannot make the whole
    // dashboard feel blocked.
    const loads = [
      ['Club Content', loadClubContent],
      ['Member Directory', () => loadMemberDirectory('')],
      ['Social Connections', loadSocialConnections],
      ['Social Presence', startSocialPresence],
      ['Direct Messages', () => loadDirectMessages(dmTarget || '')],
      ['Community Poll', loadCommunityPoll],
      ['Club Chat', loadClubChat],
      ['Club Clips', loadClubClips],
      ['Achievements', checkAchievements],
      ['Member Stats', loadMemberStats],
      ['Progression', loadProgressionCatalog],
      ['Daily Streak', loadDailyStreak],
      ['Rewards', loadMyRewards],
      ['Wheel History', loadWheelHistory],
      ['Wheel State', loadWheelState],
      ['Daily Login Quest', () => progressQuestsForAction('daily_login')],
      ['Quests', loadQuests],
      ['Leaderboard', loadLeaderboard],
      ['Member Hub', loadMemberHub],
      ['Notifications', loadNotifications],
      ['Spotlight', loadSpotlight],
      ['Community Games', loadCommunityGameHighlights],
      ['Notification Preferences', loadNotificationPreferences]
    ];
    let cursor = 0;
    const worker = async () => {
      while (cursor < loads.length) {
        const [label, fn] = loads[cursor++];
        await safeLoad(label, fn, 7000);
      }
    };
    void Promise.all(Array.from({length: 4}, worker)).then(() => {
      setAcyRefreshStatus(`Club bereit · ${acyRefreshTime()}`, 'success');
    });
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
  let { data, error } = await supabaseClient
    .from('profiles')
    .select('username,display_name,bio,avatar_url,created_at,xp,badges,discord_connected')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) throw error;

  // Existing Auth users can predate the profile trigger. In that case the
  // session is valid, but the dashboard falls back to the generic "Member"
  // profile. Repair the missing profile through a security-definer RPC.
  if (!data) {
    try {
      const { data: repaired, error: repairError } = await supabaseClient.rpc('ensure_my_profile');
      if (!repairError && repaired) {
        const refreshed = await supabaseClient
          .from('profiles')
          .select('username,display_name,bio,avatar_url,created_at,xp,badges,discord_connected')
          .eq('id', currentUser.id)
          .maybeSingle();
        if (!refreshed.error && refreshed.data) data = refreshed.data;
      }
    } catch (repairError) {
      console.warn('Profile auto-repair unavailable:', repairError);
    }
  }

  const profile = data || {
    username: currentUser.user_metadata?.username || 'member',
    display_name: currentUser.user_metadata?.display_name || 'ACY Member',
    bio: '',
    avatar_url: '',
    created_at: currentUser.created_at,
    xp: 0,
    badges: ['ACY Rookie']
  };

  // V12.9: share the resolved identity with all dashboard sections.
  // Several sections load in parallel; relying on the DOM here caused
  // "Hey, Member" to win a race against the real profile.
  window.__acyResolvedProfile = profile;
  console.info('[V12.9] Profile resolved:', profile.display_name || profile.username, currentUser.id);

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
  applyProfileGlow(Number(profile.xp || 0));
  if ((profile.display_name || '').trim() && (profile.bio || '').trim()) {
    void safeLoad('Profile Complete XP', () => awardProgression('profile_complete'));
  }

  const created = new Date(profile.created_at || currentUser.created_at);
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (days >= 30) {
    void safeLoad('30 Day XP', () => awardProgression('member_30_days'));
  } else if (days >= 7) {
    void safeLoad('7 Day XP', () => awardProgression('member_7_days'));
  }

  $('avatar-input').dataset.currentUrl = profile.avatar_url || '';
}

let twitchStatusTimer = null;


let twitchWatchTimerV11=null;
let twitchWatchActiveV11=false;
let twitchConnectedV11=false;
let twitchConnectedNameV11='';
let twitchAutoWatchV11=true;

async function loadTwitchAccountV11(){
  const status=$('twitch-account-status'), connect=$('twitch-connect-btn'), disconnect=$('twitch-disconnect-btn'), stats=$('twitch-club-stats');
  if(!status)return;
  try{
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(!token)return;
    const response=await fetch('/api/twitch-profile',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'Twitch-Profil konnte nicht geladen werden.');
    if(payload.connected){
      twitchConnectedV11=true;
      twitchConnectedNameV11=String(payload.account.display_name||payload.account.login||'Twitch');
      status.innerHTML=`🟣 Verbunden als <strong>${escapeHtml(twitchConnectedNameV11)}</strong>`;
      if(connect){
        connect.hidden=false;
        connect.disabled=true;
        connect.textContent='🟣 Twitch verbunden ✓';
        connect.classList.add('twitch-connected-button');
      }
      if(disconnect)disconnect.hidden=false;
      if(stats)stats.hidden=false;
      const p=payload.points||{};
      setText('twitch-watch-minutes',formatWatchMinutesV11(p.watch_minutes));
      setText('twitch-watch-points',String(Number(p.watch_points||0)));
      setText('twitch-stream-days',String(Number(p.stream_days||0)));
      setText('twitch-stream-streak',String(Number(p.current_stream_streak||0)));
      setText('twitch-best-streak',String(Number(p.best_stream_streak||0)));
    }else{
      twitchConnectedV11=false;
      twitchConnectedNameV11='';
      status.textContent='Noch nicht mit ACY verbunden.';
      if(connect){
        connect.hidden=false;
        connect.disabled=false;
        connect.textContent='🟣 Twitch verbinden';
        connect.classList.remove('twitch-connected-button');
      }
      if(disconnect)disconnect.hidden=true;
      if(stats)stats.hidden=true;
    }
  }catch(error){
    console.warn('Twitch account unavailable:',error);
    status.textContent=error.message||'Twitch-Konto konnte nicht geladen werden.';
  }
}

function formatWatchMinutesV11(minutes){
  const value=Math.max(0,Number(minutes)||0);
  const h=Math.floor(value/60),m=value%60;
  return h?`${h}h ${m}m`:`${m}m`;
}
function formatTwitchUptimeV11(startedAt){
  const ts=Date.parse(startedAt||'');
  if(!Number.isFinite(ts))return 'Live';
  const sec=Math.max(0,Math.floor((Date.now()-ts)/1000));
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);
  return h?`seit ${h}h ${String(m).padStart(2,'0')}m`:`seit ${m}m`;
}
async function autoTwitchWatchTickV11(){
  if(!twitchConnectedV11 || !twitchAutoWatchV11)return;
  try{
    const live=await heartbeatTwitchWatchV11();
    if(live && !twitchWatchActiveV11){
      // Heartbeat already registered a session. Switch the UI into auto mode.
      twitchWatchActiveV11=true;
      setText('twitch-watch-mode','🤖 Automatisches Stream-Tracking aktiv');
      setText('twitch-watch-mode-note','ACY erfasst deine aktive Stream-Zeit automatisch, sobald ACYJANNIK live ist.');
    }else if(!live && twitchWatchActiveV11){
      twitchWatchActiveV11=false;
      setText('twitch-watch-mode','⏹ Automatisches Tracking pausiert');
    }
  }catch(error){
    console.warn('Twitch auto watch tick:',error);
  }
}
function startTwitchAutoWatchV11(){
  if(twitchWatchTimerV11)clearInterval(twitchWatchTimerV11);
  twitchWatchTimerV11=setInterval(()=>autoTwitchWatchTickV11(),120000);
  void autoTwitchWatchTickV11();
}

async function stopTwitchWatchV11(){
  if(twitchWatchTimerV11){clearInterval(twitchWatchTimerV11);twitchWatchTimerV11=null;}
  try{
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(token) await fetch('/api/twitch-watch',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
  }catch{}
  twitchWatchActiveV11=false;
}

async function heartbeatTwitchWatchV11(){
  const {data}=await supabaseClient.auth.getSession();
  const token=data?.session?.access_token;
  if(!token)return;
  const response=await fetch('/api/twitch-watch',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||'Streamzeit konnte nicht aktualisiert werden.');
  if(!payload.live){
    if(twitchConnectedV11 && twitchConnectedNameV11){
      setText('twitch-account-status',`🟣 Verbunden als ${twitchConnectedNameV11} · offline`);
    }else{
      setText('twitch-account-status','Twitch ist aktuell offline.');
    }
    setText('twitch-live-activity','⏹ Stream offline');
    return false;
  }
  setText('twitch-live-activity',`${formatTwitchUptimeV11(payload.stream?.startedAt)} · ${Number(payload.stream?.viewerCount||0).toLocaleString('de-DE')} Zuschauer`);
  setText('twitch-current-title',payload.stream?.title||'Live');
  setText('twitch-current-game',payload.stream?.game||'–');
  const p=payload.points||{};
  setText('twitch-watch-minutes',formatWatchMinutesV11(p.watchMinutes??p.watch_minutes??0));
  setText('twitch-watch-points',String(p.watchPoints??p.watch_points??0));
  setText('twitch-stream-days',String(p.streamDays??p.stream_days??0));
  setText('twitch-stream-streak',String(p.currentStreak??p.current_stream_streak??0));
  setText('twitch-best-streak',String(p.bestStreak??p.best_streak??0));
  return true;
}
async function initTwitchAccountV11(){
  const connect=$('twitch-connect-btn'), disconnect=$('twitch-disconnect-btn');
  connect?.addEventListener('click',async()=>{
    try{
      const {data}=await supabaseClient.auth.getSession();
      const token=data?.session?.access_token;
      if(!token)throw new Error('Sitzung abgelaufen.');
      const r=await fetch('/api/twitch-connect',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const payload=await r.json(); if(!r.ok)throw new Error(payload.error||'Twitch OAuth konnte nicht gestartet werden.');
      window.location.href=payload.url;
    }catch(error){setStatus(error.message||'Twitch-Verbindung konnte nicht gestartet werden.','error');}
  });
  disconnect?.addEventListener('click',async()=>{
    if(!confirm('Twitch wirklich von deinem ACY Club Account trennen?'))return;
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(!token)return;
    const r=await fetch('/api/twitch-profile',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    const payload=await r.json().catch(()=>({}));
    if(!r.ok){setStatus(payload.error||'Twitch konnte nicht getrennt werden.','error');return;}
    stopTwitchWatchV11();
    await loadTwitchAccountV11();
    setStatus('Twitch wurde getrennt.','success');
  });
}

function startTwitchStatusPolling() {
  if (twitchStatusTimer) clearInterval(twitchStatusTimer);
  twitchStatusTimer = setInterval(() => {
    loadTwitch().catch(error => console.warn('Club Twitch refresh failed:', error));
  }, 60000);
}

async function loadTwitch() {
  const sub = $('twitch-member-sub');
  const game = $('member-twitch-game');
  const viewers = $('member-twitch-viewers');
  const title = $('twitch-member-title');
  const pill = $('member-live-pill');
  const dot = $('member-live-dot');
  const text = $('member-live-text');

  try {
    const res = await fetch(`/api/twitch-status?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Twitch API HTTP ${res.status}`);
    const data = await res.json();
    const live = !!data.live;
    setText('twitch-current-title',live?(data.title||'Live Stream'):'–');
    setText('twitch-current-game',live?(data.game||'–'):'–');
    setText('twitch-live-activity',live?`${formatTwitchUptimeV11(data.startedAt)} · ${Number(data.viewerCount||0).toLocaleString('de-DE')} Zuschauer`:'⏹ Stream offline');

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
    // Do not convert an API error into a false OFFLINE status.
    if (text) text.textContent = 'STATUS NICHT VERFÜGBAR';
    if (sub) sub.textContent = 'Twitch-Status gerade nicht verfügbar';
  }
}




async function syncDiscordPresenceLink(){
  if(!supabaseClient||!currentUser)return;
  try{
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(!token)return null;
    const response=await fetch('/api/discord-link',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${token}`,
        'Content-Type':'application/json'
      }
    });
    if(!response.ok){
      console.warn('Discord presence link sync:',await response.text());
      return null;
    }
    return await response.json();
  }catch(error){
    console.warn('Discord presence link sync skipped:',error);
    return null;
  }
}

async function loadDiscordLink() {
  const connectButton = $('discord-connect-btn');
  const disconnectButton = $('discord-disconnect-btn');
  const text = $('discord-link-text');
  const state = $('discord-link-state');
  const statusEl = $('discord-link-status');
  if (!connectButton || !text) return;

  try {
    const { data, error } = await supabaseClient.auth.getUserIdentities();
    if (error) throw error;

    const discordIdentity = (data?.identities || []).find(identity => identity.provider === 'discord');
    const connected = !!discordIdentity;

    text.textContent = connected ? 'Discord verbunden' : 'Nicht verbunden';
    if (state) state.classList.toggle('is-connected', connected);

    if (statusEl) {
      statusEl.textContent = connected
        ? 'Dein Discord-Konto ist mit diesem ACY Club Account verknüpft.'
        : 'Noch nicht verbunden.';
      statusEl.className = connected ? 'club-auth-status success' : 'club-auth-status';
    }

    connectButton.textContent = connected ? 'Discord verbunden ✓' : 'Discord verbinden';
    connectButton.disabled = connected;

    if (disconnectButton) {
      disconnectButton.hidden = !connected;
      disconnectButton.disabled = false;
      disconnectButton.textContent = 'Discord trennen';
    }

    // Keep the profile flag in sync with the actual Supabase identity.
    const { error: profileError } = await supabaseClient.from('profiles').update({
      discord_connected: connected,
      updated_at: new Date().toISOString()
    }).eq('id', currentUser.id);

    if (profileError) console.warn('Discord profile flag sync failed:', profileError);

    if (connected) {
      await syncDiscordPresenceLink();
      const result = await awardProgression('discord_connected');
      if (result?.totalXp !== undefined) {
        renderBadges((window.__memberBadges || []), Number(result.totalXp), true);
        setText('member-xp', `${result.totalXp} XP`);
        applyProfileGlow(Number(result.totalXp));
      }
    } else {
      // The Discord badge is derived from the live connection state.
      // The XP event is a zeroed one-time marker after disconnecting.
      renderBadges((window.__memberBadges || []), Number(
        String($('member-xp')?.textContent || '0').replace(/[^\d]/g, '') || 0
      ), false);
    }

    disconnectButton?.removeEventListener('click', disconnectDiscord);
    disconnectButton?.addEventListener('click', disconnectDiscord);
  } catch (error) {
    console.warn('Discord identity status unavailable:', error);
    text.textContent = 'Discord-Verknüpfung nicht verfügbar';
    if (statusEl) {
      statusEl.textContent = error?.message || 'Discord-Verknüpfung konnte nicht geprüft werden.';
      statusEl.className = 'club-auth-status error';
    }
  }
}


async function revokeDiscordProgression() {
  const { data, error } = await supabaseClient.rpc('revoke_club_xp', {
    p_user_id: currentUser.id,
    p_event_key: 'discord_connected',
    p_xp: 50
  });

  if (error) throw error;

  if (Number.isFinite(Number(data))) {
    renderProgress(Number(data));
    setText('member-xp', `${Number(data)} XP`);
  }

  return Number(data);
}

async function disconnectDiscord() {
  const button = $('discord-disconnect-btn');
  const connectButton = $('discord-connect-btn');
  const statusEl = $('discord-link-status');

  if (!confirm('Discord wirklich von deinem ACY Club Account trennen? Dein Discord-Account selbst wird dabei nicht gelöscht.')) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Discord wird getrennt…';
  }
  if (connectButton) connectButton.disabled = true;
  if (statusEl) {
    statusEl.textContent = 'Discord-Verbindung wird getrennt…';
    statusEl.className = 'club-auth-status';
  }

  try {
    if (!supabaseClient) throw new Error('Supabase ist nicht initialisiert.');

    const { data, error } = await supabaseClient.auth.getUserIdentities();
    if (error) throw error;

    const discordIdentity = (data?.identities || []).find(identity => identity.provider === 'discord');
    if (!discordIdentity) {
      await loadDiscordLink();
      return;
    }

    const { error: unlinkError } = await supabaseClient.auth.unlinkIdentity(discordIdentity);
    if (unlinkError) throw unlinkError;

    // Discord is now actually disconnected, so revoke the one-time +50 XP.
    // The DB keeps a zeroed event marker, preventing reconnect farming.
    await revokeDiscordProgression();
    try {
      const {data:sessionData}=await supabaseClient.auth.getSession();
      const token=sessionData?.session?.access_token;
      if(token){
        await fetch('/api/discord-link',{
          method:'DELETE',
          headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}
        }).catch(()=>{});
      }
    } catch {}

    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        discord_connected: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (profileError) throw profileError;

    // XP is deliberately NOT revoked. Connecting Discord is a one-time
    // progression milestone; disconnecting must not create an XP farming loop.
    if (statusEl) {
      statusEl.textContent = 'Discord wurde erfolgreich getrennt.';
      statusEl.className = 'club-auth-status success';
    }

    await loadDiscordLink();
  } catch (error) {
    console.error('Discord unlink failed:', error);
    if (statusEl) {
      statusEl.textContent = error?.message || 'Discord konnte nicht getrennt werden.';
      statusEl.className = 'club-auth-status error';
    }
    if (button) {
      button.disabled = false;
      button.textContent = 'Discord trennen';
    }
    if (connectButton) connectButton.disabled = false;
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


async function loadMemberHub() {
  const greeting = $('hub-greeting');
  const summary = $('hub-summary');
  const title = $('hub-level-title');
  const xp = $('hub-level-xp');
  const fill = $('hub-xp-fill');
  const next = $('hub-next-level');

  // V12.9: never derive the club identity from placeholder DOM text.
  // The hub can load in parallel with loadProfile(), so "ACY Member" used
  // to win the race and overwrite the real account name.
  let hubProfile = window.__acyResolvedProfile || null;
  if (!hubProfile && supabaseClient && currentUser) {
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('username,display_name,xp')
        .eq('id', currentUser.id)
        .maybeSingle();
      hubProfile = profile || null;
    } catch (error) {
      console.warn('[V12.9] Hub profile lookup failed:', error);
    }
  }

  const name = hubProfile?.display_name || hubProfile?.username || 'Member';
  const currentXp = Number(hubProfile?.xp ?? $('member-xp')?.textContent?.replace(/[^\d]/g, '') ?? 0);
  const level = levelForXp(currentXp);

  if (greeting) greeting.textContent = `Hey, ${name}.`;
  if (summary) summary.textContent = `${currentXp} XP · ${level.title}`;
  if (title) title.textContent = level.title;
  if (xp) xp.textContent = `${currentXp} XP`;

  const idx = levelIndexForXp(currentXp);
  const base = CLUB_LEVELS[idx].min;
  const nextLevel = CLUB_LEVELS[idx + 1];
  const nextThreshold = nextLevel?.min ?? base;
  const progress = nextLevel
    ? Math.max(0, Math.min(100, ((currentXp - base) / Math.max(1, nextThreshold - base)) * 100))
    : 100;
  if (fill) fill.style.width = `${progress}%`;
  if (next) next.textContent = nextLevel
    ? `Noch ${Math.max(0, nextThreshold - currentXp).toLocaleString('de-DE')} XP bis ${nextLevel.title}.`
    : 'Hall of Fame+ erreicht. Die Reise geht weiter.';
  setText('hub-level-title', `${levelForXp(currentXp).title} · Level ${idx + 1}/${CLUB_LEVELS.length}`);
  setText('hub-level-xp', `${currentXp.toLocaleString('de-DE')} XP`);

  const roadmap = $('hub-level-roadmap');
  if (roadmap) {
    const milestones = CLUB_LEVELS.slice(idx, Math.min(CLUB_LEVELS.length, idx + 5));
    roadmap.innerHTML = milestones.map((level, offset) => {
      const levelNo = idx + offset + 1;
      const reached = currentXp >= level.min;
      return `<div class="hub-roadmap-step ${reached?'is-reached':''}${offset===0?' is-current':''}">
        <span>${levelNo}</span>
        <strong>${escapeHtml(level.title)}</strong>
        <small>${level.min.toLocaleString('de-DE')} XP</small>
      </div>`;
    }).join('');
  }

  const xpSources = $('hub-xp-sources');
  if (xpSources) {
    xpSources.innerHTML = [
      ['🎯','Quests','Tägliche & wöchentliche Aufgaben'],
      ['🐾','Pet-Pflege','Pflege-XP und tägliche Aktionen'],
      ['🗳️','Community Votes','Bei Abstimmungen mitmachen'],
      ['📅','Events','An Events teilnehmen'],
      ['🎮','Gamespotter','Neue Games entdecken'],
      ['🔥','Streaks','Regelmäßig im Club aktiv sein'],
      ['🟣','Twitch','ACY Streamzeit & Watch Points']
    ].map(([icon,title,desc])=>`<div class="hub-xp-source"><span>${icon}</span><div><strong>${title}</strong><small>${desc}</small></div></div>`).join('');
  }

  const eventsList = $('hub-events-list');
  if (eventsList) {
    const cards = [...document.querySelectorAll('#member-events-list .event-item')].slice(0, 3);
    eventsList.innerHTML = cards.length
      ? cards.map(card => {
          const titleText = card.querySelector('.club-content-main strong')?.textContent || 'Event';
          const dateText = card.querySelector('.club-content-date')?.textContent || '';
          const attending = card.dataset.attending === 'true';
          return `<div class="hub-mini-row"><div><strong>${escapeHtml(titleText)}</strong><small>${escapeHtml(dateText)}</small></div><span>${attending ? '✅ Dabei' : '◯ Offen'}</span></div>`;
        }).join('')
      : '<div class="club-content-empty">Noch keine kommenden Events.</div>';
  }

  const achievementsList = $('hub-achievements-list');
  if (achievementsList) {
    const badges = [...document.querySelectorAll('#badge-grid .member-badge')].slice(0, 4);
    achievementsList.innerHTML = badges.length
      ? badges.map(card => {
          const icon = card.querySelector('.member-badge > span')?.textContent?.trim() || '✦';
          const name = card.querySelector('.member-badge > strong')?.textContent?.trim() || 'Achievement';
          return `<div class="hub-badge-mini">
            <span class="hub-badge-icon">${escapeHtml(icon)}</span>
            <span class="hub-badge-copy"><strong>${escapeHtml(name)}</strong><small>ACY Club Achievement</small></span>
          </div>`;
        }).join('')
      : '<div class="club-content-empty">Noch keine Achievements.</div>';
  }
}

async function refreshNotificationBadge() {
  try {
    await loadNotifications();
  } catch (error) {
    console.warn('Notification badge refresh skipped:', error);
  }
}


let notificationRealtimeChannel = null;
let notificationRefreshTimer = null;

function startNotificationRealtime() {
  if (!supabaseClient || !currentUser) return;
  if (notificationRealtimeChannel) {
    try { supabaseClient.removeChannel(notificationRealtimeChannel); } catch {}
  }

  notificationRealtimeChannel = supabaseClient
    .channel(`acy-notifications-${currentUser.id}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'club_notifications',
      filter:`user_id=eq.${currentUser.id}`
    }, async payload => {
      playUISound('success');
      showClubToast(
        payload.eventType === 'DELETE'
          ? 'Benachrichtigung entfernt.'
          : (payload.new?.title || 'Neue Benachrichtigung'),
        'success'
      );
      await loadNotifications();
    })
    .subscribe();

  if (notificationRefreshTimer) clearInterval(notificationRefreshTimer);
  notificationRefreshTimer = setInterval(() => {
    if (!document.hidden) loadNotifications().catch(()=>{});
  }, 60000);
}

let activeNotificationFilter = 'all';
let cachedNotifications = [];
function notificationIcon(type){
  return type==='live'?'🔴':type==='badge'?'🏆':type==='event'?'📅':type==='direct_message'?'💌':type==='reward'?'🎁':type==='pet'?'🐾':type==='poll'?'🗳️':'💜';
}
function renderNotifications(){
  const container=$('notifications-list'); const badge=$('notification-count');
  if(!container)return;
  const filtered=activeNotificationFilter==='unread'?cachedNotifications.filter(n=>!n.read_at):cachedNotifications;
  const unread=cachedNotifications.filter(n=>!n.read_at).length;
  if(badge){badge.textContent=unread?String(unread):'';badge.hidden=!unread;}
  container.innerHTML=filtered.length?filtered.slice(0,12).map(n=>`<div class="notification-row-wrap"><button class="notification-row ${n.read_at?'':'is-unread'}" type="button" data-notification-id="${n.id}" data-link="${escapeAttr(n.link_url||'')}"><span class="notification-icon">${notificationIcon(n.notification_type)}</span><span><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.body)}</small><em>${formatRelativeTime(n.created_at)}</em></span></button><button class="notification-delete-one" type="button" data-notification-delete="${n.id}" aria-label="Benachrichtigung löschen">×</button></div>`).join(''):'<div class="club-content-empty">Keine Benachrichtigungen in dieser Ansicht.</div>';
  container.querySelectorAll('.notification-row').forEach(row=>row.addEventListener('click',async()=>{
    const id=row.dataset.notificationId;
    try{await supabaseClient.from('club_notifications').update({read_at:new Date().toISOString()}).eq('id',id);}catch(error){console.warn('Notification read state failed:',error);}
    const link=row.dataset.link;
    if(link)window.location.href=link; else await loadNotifications();
  }));
  container.querySelectorAll('[data-notification-delete]').forEach(btn=>btn.addEventListener('click',async(event)=>{
    event.stopPropagation();
    const id=btn.dataset.notificationDelete;
    try{
      const {error}=await supabaseClient.from('club_notifications').delete().eq('id',id).eq('user_id',currentUser.id);
      if(error)throw error;
      cachedNotifications=cachedNotifications.filter(n=>String(n.id)!==String(id));
      renderNotifications();
    }catch(error){console.warn('Notification delete failed:',error);setStatus(error?.message||'Benachrichtigung konnte nicht gelöscht werden.','error');}
  }));
}
function initNotificationFilters(){
  document.querySelectorAll('[data-notification-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    activeNotificationFilter=btn.dataset.notificationFilter==='unread'?'unread':'all';
    document.querySelectorAll('[data-notification-filter]').forEach(b=>b.classList.toggle('is-active',b===btn));
    renderNotifications();
  }));
  $('mobile-dock-notifications')?.addEventListener('click',()=>{$('notification-panel').hidden=false;});
  $('notification-clear-all')?.addEventListener('click',async()=>{
    if(!currentUser)return;
    if(!confirm('Wirklich alle Benachrichtigungen löschen?'))return;
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(!token)return;
    try{
      const response=await fetch('/api/club-notifications?action=clear_all',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`}
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Benachrichtigungen konnten nicht gelöscht werden.');
      cachedNotifications=[];
      renderNotifications();
    }catch(error){
      console.warn('Notification clear failed:',error);
      setStatus(error?.message||'Benachrichtigungen konnten nicht gelöscht werden.','error');
    }
  });
}

async function loadNotifications() {
  if (!supabaseClient || !currentUser) return;
  try {
    const {data}=await supabaseClient.auth.getSession(); const token=data?.session?.access_token; if(!token)return;
    const response=await fetch(`/api/club-notifications?_=${Date.now()}`,{cache:'no-store',headers:{Authorization:`Bearer ${token}`}});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Benachrichtigungen konnten nicht geladen werden.');
    cachedNotifications=Array.isArray(payload.notifications)?payload.notifications:[];
    renderNotifications();
  }catch(error){console.warn('Notifications unavailable:',error); throw error;}
}

async function loadCommunityGameHighlights(){
  const box=$('hub-games-list'); if(!box||!supabaseClient)return;
  try{
    const {data,error}=await supabaseClient.from('club_game_activity').select('id,name,image_url,member_count,sessions_7d').order('member_count',{ascending:false}).order('sessions_7d',{ascending:false}).limit(6);
    if(error)throw error; const rows=Array.isArray(data)?data:[];
    box.innerHTML=rows.length?rows.map((g,i)=>`<article class="hub-game-row-v10"><span class="hub-game-rank-v10">#${i+1}</span><div class="hub-game-thumb-v10" style="background-image:url('${escapeAttr(acyGameArt(g))}')"></div><div class="hub-game-info-v10"><strong>${escapeHtml(g.name)}</strong><small>${Number(g.member_count||0)} live · ${Number(g.sessions_7d||0)}× diese Woche</small></div></article>`).join(''):'<div class="club-content-empty">Noch keine aktiven Community-Games.</div>';
  }catch(error){console.warn('Community game highlights unavailable:',error);box.innerHTML='<div class="club-content-empty">Community-Games momentan nicht verfügbar.</div>'; throw error;}
}

async function loadSpotlight() {
  const box = $('spotlight-content');
  if (!box) return;
  try {
    const response = await fetch(`/api/club-spotlight?_=${Date.now()}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Spotlight konnte nicht geladen werden.');
    if (!payload.spotlight?.member) {
      box.innerHTML = '<div class="club-content-empty">Diesen Monat gibt es noch kein Spotlight.</div>';
      return;
    }

    const m = payload.spotlight.member;
    const avatar = m.avatar_url
      ? `<img src="${escapeAttr(m.avatar_url)}" alt="" loading="lazy">`
      : `<div class="spotlight-avatar-fallback">${escapeHtml((m.display_name || m.username || 'A').charAt(0).toUpperCase())}</div>`;

    box.innerHTML = `<a class="spotlight-person" href="/member.html?id=${encodeURIComponent(m.id)}">
      <div class="spotlight-avatar">${avatar}</div>
      <div><strong>${escapeHtml(m.display_name || m.username)}</strong><small>@${escapeHtml(m.username)}</small><p>${escapeHtml(payload.spotlight.blurb || m.bio || 'Aktives ACY Club Mitglied.')}</p></div>
      <div class="spotlight-stats"><span>${Number(m.xp || 0)} XP</span><span>${Array.isArray(m.badges) ? m.badges.length : 0} Badges</span></div>
    </a>`;
  } catch (error) {
    console.warn('Spotlight unavailable:', error);
    box.innerHTML = '<div class="club-content-empty">Spotlight momentan nicht verfügbar.</div>';
    throw error;
  }
}

async function loadClubClips(){
  const list=$('member-clips-list');
  if(!list)return;
  try{
    const response=await fetch(`/api/club-clips?_=${Date.now()}`,{cache:'no-store'});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'Clips konnten nicht geladen werden.');
    const clips=Array.isArray(payload.clips)?payload.clips:[];
    if(!clips.length){
      list.innerHTML='<div class="club-content-empty">Noch keine Clips.</div>';
      return;
    }
    list.innerHTML=clips.map(c=>{
      const thumb=c.thumbnail_url
        ? `<img src="${escapeAttr(c.thumbnail_url)}" alt="" loading="lazy">`
        : `<div class="clip-placeholder"><span>▶</span></div>`;
      return `<a class="clip-card" href="${escapeAttr(c.clip_url)}" target="_blank" rel="noreferrer">
        <div class="clip-thumb">${thumb}<span class="clip-play">▶</span></div>
        <div class="clip-card-body">
          <span class="clip-category">${escapeHtml(c.category||'ACY Clip')}</span>
          <strong>${escapeHtml(c.title)}</strong>
          <p>${escapeHtml(c.description||'')}</p>
        </div>
      </a>`;
    }).join('');
  }catch(error){
    console.warn('Club clips unavailable:',error);
    list.innerHTML=`<div class="club-content-empty">${escapeHtml(error?.message||'Clips momentan nicht verfügbar.')}</div>`;
    throw error;
  }
}


let clubChatChannel = null;
let clubChatMessages = [];
let clubChatPresence = new Map();

const chatEscape = (value = '') => escapeHtml(value);

function formatChatTime(value) {
  try {
    return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function setChatStatus(message = '', type = '') {
  const el = $('club-chat-status');
  if (!el) return;
  el.textContent = message;
  el.className = `club-chat-status ${type}`.trim();
}

function renderChat(messages = clubChatMessages) {
  const list = $('club-chat-messages');
  if (!list) return;

  if (!messages.length) {
    list.innerHTML = `
      <div class="club-chat-empty">
        <div class="club-chat-empty-icon">💬</div>
        <strong>Noch niemand hat etwas geschrieben.</strong>
        <span>Sei der Erste und sag Hallo.</span>
      </div>`;
    return;
  }

  const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 100;
  list.innerHTML = messages.map((item) => {
    const profile = item.profiles || {};
    const display = profile.display_name || profile.username || 'ACY Member';
    const avatar = profile.avatar_url
      ? `<img src="${escapeAttr(profile.avatar_url)}" alt="" loading="lazy">`
      : `<span>${chatEscape(display.charAt(0).toUpperCase())}</span>`;
    const own = item.user_id === currentUser?.id;
    const text = chatEscape(item.message).replace(/\n/g, '<br>');
    return `<article class="club-chat-message ${own ? 'is-own' : ''}" data-chat-id="${escapeAttr(item.id)}">
      <div class="club-chat-avatar">${avatar}</div>
      <div class="club-chat-bubble-wrap">
        <div class="club-chat-message-head">
          <strong>${chatEscape(display)}</strong>
          <span>@${chatEscape(profile.username || '')}</span>
          <time datetime="${escapeAttr(item.created_at)}">${formatChatTime(item.created_at)}</time>
          ${own ? `<button type="button" class="club-chat-delete" data-chat-delete="${escapeAttr(item.id)}" title="Nachricht löschen" aria-label="Nachricht löschen">×</button>` : ''}
        </div>
        <div class="club-chat-bubble">${text}</div>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-chat-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.chatDelete;
      if (!id || !confirm('Diese Nachricht wirklich löschen?')) return;
      const { error } = await supabaseClient
        .from('club_chat_messages')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);
      if (error) setChatStatus(error.message || 'Nachricht konnte nicht gelöscht werden.', 'error');
    });
  });

  if (wasNearBottom || messages.length <= 1) list.scrollTop = list.scrollHeight;
}

async function loadClubChat() {
  const list = $('club-chat-messages');
  const form = $('club-chat-form');
  const input = $('club-chat-input');
  if (!list || !form || !input || !supabaseClient || !currentUser) return;

  // Important: club_chat_messages references auth.users, not profiles.
  // Supabase therefore cannot use `profiles (...)` as a nested relation here.
  // Load messages first and enrich them with profile data separately.
  async function fetchChatMessages(limit = 100) {
    const { data: messages, error } = await supabaseClient
      .from('club_chat_messages')
      .select('id,user_id,message,created_at')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const rows = Array.isArray(messages) ? messages : [];
    const ids = [...new Set(rows.map(row => row.user_id).filter(Boolean))];

    let profilesById = new Map();
    if (ids.length) {
      const { data: profiles, error: profileError } = await supabaseClient
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', ids);

      if (!profileError) {
        profilesById = new Map((profiles || []).map(profile => [profile.id, profile]));
      }
    }

    return rows.map(row => ({
      ...row,
      profiles: profilesById.get(row.user_id) || null
    }));
  }

  async function fetchSingleChatMessage(id) {
    const { data: row, error } = await supabaseClient
      .from('club_chat_messages')
      .select('id,user_id,message,created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!row) return null;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id,username,display_name,avatar_url')
      .eq('id', row.user_id)
      .maybeSingle();

    return { ...row, profiles: profile || null };
  }

  try {
    clubChatMessages = await fetchChatMessages(100);
    renderChat();

    if (clubChatChannel) {
      await supabaseClient.removeChannel(clubChatChannel);
      clubChatChannel = null;
    }

    clubChatChannel = supabaseClient
      .channel('acy-club-chat', { config: { presence: { key: currentUser.id } } })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'club_chat_messages'
      }, async (payload) => {
        try {
          const row = await fetchSingleChatMessage(payload.new.id);
          if (row && !clubChatMessages.some(m => m.id === row.id)) {
            clubChatMessages.push(row);
            clubChatMessages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
            clubChatMessages = clubChatMessages.slice(-100);
            renderChat();
          }
        } catch (error) {
          console.warn('Chat message refresh failed:', error);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'club_chat_messages'
      }, (payload) => {
        clubChatMessages = clubChatMessages.filter(m => m.id !== payload.old.id);
        renderChat();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = clubChatChannel.presenceState();
        clubChatPresence = new Map();

        Object.entries(state).forEach(([key, values]) => {
          clubChatPresence.set(key, values?.[0] || {});
        });

        const online = $('chat-online-count');
        if (online) online.textContent = `${Math.max(1, clubChatPresence.size)} online`;
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await clubChatChannel.track({
            user_id: currentUser.id,
            username: currentUser.user_metadata?.username || 'member',
            joined_at: new Date().toISOString()
          });
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setChatStatus('Live-Verbindung konnte nicht hergestellt werden. Nachrichten können nach dem Neuladen trotzdem verfügbar sein.', 'error');
        }
      });

    if (!form.dataset.chatBound) {
      form.dataset.chatBound = 'true';

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message) return;

        if (message.length > 500) {
          setChatStatus('Maximal 500 Zeichen.', 'error');
          return;
        }

        const button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        setChatStatus('');

        const { error: sendError } = await supabaseClient
          .from('club_chat_messages')
          .insert({ user_id: currentUser.id, message });

        if (sendError) {
          const raw = String(sendError.message || '');
          if (raw.includes('CHAT_RATE_LIMIT')) {
            setChatStatus('Bitte kurz warten, bevor du wieder schreibst.', 'error');
          } else if (raw.includes('CHAT_BANNED')) {
            setChatStatus('Du bist aktuell vom Chat ausgeschlossen.', 'error');
          } else {
            setChatStatus(sendError.message || 'Nachricht konnte nicht gesendet werden.', 'error');
            console.warn('Chat send error:', sendError);
          }
        } else {
          input.value = '';
          void progressQuestsForAction('weekly_chat');
          updateChatCounter();
          input.focus();
        }

        if (button) button.disabled = false;
      });

      input.addEventListener('input', updateChatCounter);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
    }

    updateChatCounter();
  } catch (error) {
    console.warn('Club chat unavailable:', error);
    list.innerHTML = `<div class="club-content-empty">Chat konnte nicht geladen werden: ${escapeHtml(error?.message || 'Unbekannter Fehler')}</div>`;
  }
}

function updateChatCounter() {
  const input = $('club-chat-input');
  const counter = $('club-chat-counter');
  if (!input || !counter) return;
  counter.textContent = `${input.value.length} / 500`;
}



let socialPresenceTimer = null;

async function updateMyPresenceHeartbeat() {
  if (!supabaseClient || !currentUser) return;

  try {
    const { error } = await supabaseClient
      .from('club_online_presence')
      .upsert({
        user_id: currentUser.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.warn('Online presence heartbeat skipped:', error);
    }
  } catch (error) {
    console.warn('Online presence heartbeat skipped:', error);
  }
}


async function startSocialPresence() {
  if (socialPresenceTimer) clearInterval(socialPresenceTimer);
  await updateMyPresenceHeartbeat();
  socialPresenceTimer = setInterval(updateMyPresenceHeartbeat, 60000);
}

async function rpcSocial(fn, params={}) {
  const { data, error } = await supabaseClient.rpc(fn, params);
  if (error) throw error;
  return data;
}

function renderSocialConnections(data={}) {
  const friends=Array.isArray(data.friends)?data.friends:[];
  const incoming=Array.isArray(data.incoming)?data.incoming:[];
  const blocked=Array.isArray(data.blocked)?data.blocked:[];
  window.__socialFriendIds = new Set(friends.map(person => String(person.user_id)));
  const requestCount=incoming.length;
  setText('social-friend-count', `${friends.length} Freunde${requestCount?` · ${requestCount} Anfrage${requestCount===1?'':'n'}`:''}`);

  const renderPerson=(person, buttons='')=>`
    <div class="social-connection-item" data-social-user="${escapeAttr(person.user_id)}">
      <div class="social-connection-avatar">${person.avatar_url?`<img src="${escapeAttr(person.avatar_url)}" alt="" loading="lazy">`:`<span>${escapeHtml((person.display_name||person.username||'A').charAt(0).toUpperCase())}</span>`}</div>
      <div class="social-connection-main">
        <strong>${person.online ? '🟢' : '⚫'} ${escapeHtml(person.display_name||person.username||'Mitglied')}</strong>
        <small>@${escapeHtml(person.username||'')} · ${person.online ? (person.game_name ? `🎮 ${escapeHtml(person.game_name)}` : 'Online') : 'Offline'}</small>
      </div>
      <div class="social-connection-actions">${buttons}</div>
    </div>`;

  const incomingList=$('social-incoming-list');
  if(incomingList){
    incomingList.innerHTML=incoming.length?incoming.map(r=>renderPerson(r,
      `<button class="button button-primary button-small" data-social-accept="${escapeAttr(r.id)}">Annehmen</button>
       <button class="button button-secondary button-small" data-social-decline="${escapeAttr(r.id)}">Ablehnen</button>
       <button class="button button-danger button-small" data-social-block="${escapeAttr(r.user_id)}">Blockieren</button>`
    )).join(''):'<div class="club-content-empty">Keine offenen Anfragen.</div>';
  }

  const friendsList=$('social-friends-list');
  if(friendsList){
    friendsList.innerHTML=friends.length?friends.map(person=>renderPerson(person,
      `<span class="social-friend-state">✓ Freunde</span>
       <button class="button button-secondary button-small" data-social-message="${escapeAttr(person.user_id)}">Nachricht</button>
       <button class="button button-secondary button-small" data-social-remove="${escapeAttr(person.user_id)}">Freundschaft beenden</button>
       <button class="button button-danger button-small" data-social-block="${escapeAttr(person.user_id)}">Blockieren</button>`
    )).join(''):'<div class="club-content-empty">Noch keine Freunde.</div>';
  }

  const blockedList=$('social-blocked-list');
  if(blockedList){
    blockedList.innerHTML=blocked.length?blocked.map(person=>renderPerson(person,
      `<button class="button button-primary button-small" data-social-unblock="${escapeAttr(person.user_id)}">Entsperren</button>`
    )).join(''):'<div class="club-content-empty">Keine blockierten Kontakte.</div>';
  }

  document.querySelectorAll('[data-social-accept]').forEach(btn=>btn.onclick=async()=>{
    try{await rpcSocial('respond_friend_request',{p_request_id:btn.dataset.socialAccept,p_accept:true});triggerClubEffect('success','Freundschaft angenommen. 👥');
      void sendDiscordCommunityEvent('friend_accepted', {}, `friend-${btn.dataset.socialAccept}`);
      void progressQuestsForAction('friend_accepted');
      await loadSocialConnections();}catch(e){setStatus(e.message,'error');}
  });
  document.querySelectorAll('[data-social-decline]').forEach(btn=>btn.onclick=async()=>{
    try{await rpcSocial('respond_friend_request',{p_request_id:btn.dataset.socialDecline,p_accept:false});await loadSocialConnections();}catch(e){setStatus(e.message,'error');}
  });
  document.querySelectorAll('[data-social-remove]').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Freundschaft wirklich entfernen?'))return;
    try{await rpcSocial('remove_friend',{p_friend_user_id:btn.dataset.socialRemove});await loadSocialConnections();}catch(e){setStatus(e.message,'error');}
  });
  document.querySelectorAll('[data-social-block]').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Kontakt wirklich blockieren? Die Freundschaft wird dabei entfernt.'))return;
    try{await rpcSocial('block_member',{p_blocked_user_id:btn.dataset.socialBlock});await loadSocialConnections();await loadMemberDirectory();}catch(e){setStatus(e.message,'error');}
  });
  document.querySelectorAll('[data-social-unblock]').forEach(btn=>btn.onclick=async()=>{
    try{await rpcSocial('unblock_member',{p_blocked_user_id:btn.dataset.socialUnblock});await loadSocialConnections();}catch(e){setStatus(e.message,'error');}
  });
  document.querySelectorAll('[data-social-message]').forEach(btn=>btn.onclick=()=>{
    window.location.href=`/club-profile.html?dm=${encodeURIComponent(btn.dataset.socialMessage)}`;
  });
}

async function loadSocialConnections(){
  try{
    try{ await rpcSocial('sync_my_friendships'); }catch(syncError){
      console.warn('Friendship sync skipped:',syncError);
    }
    const data=await rpcSocial('get_my_social_connections');
    renderSocialConnections(data||{});
  }catch(error){
    console.warn('Social connections unavailable:',error);
    setText('social-friend-count','– Freunde');
    const friendsList=$('social-friends-list');
    if(friendsList) friendsList.innerHTML='<div class="club-content-empty">Freunde konnten gerade nicht geladen werden.</div>';
  }
}

async function sendFriendRequest(userId){
  try{
    const result=await rpcSocial('send_friend_request',{p_target_user_id:userId});
    if(result?.status==='accepted'){
      setStatus('Ihr seid bereits befreundet. Die Freundschaft wurde synchronisiert. 👥','success');
      triggerClubEffect('success','Freundschaft synchronisiert. 👥');
    }else{
      setStatus('Freundschaftsanfrage gesendet.','success');
      triggerClubEffect('success', 'Freundschaftsanfrage gesendet. 💜');
    }
    await loadSocialConnections();
    await loadMemberDirectory();
  }catch(error){setStatus(error?.message||'Anfrage konnte nicht gesendet werden.','error');}
}


let currentMemberFilter = 'all';
function applyMemberDirectoryFilter(filter='all'){
  currentMemberFilter = filter;
  const list=$('member-directory-list');
  if(!list)return;
  list.querySelectorAll('.member-directory-item').forEach(card=>{
    const matches = filter==='all'
      || (filter==='online' && card.dataset.online==='true')
      || (filter==='friends' && card.dataset.isFriend==='true')
      || (filter==='pets' && card.dataset.hasPet==='true');
    card.hidden = !matches;
  });
  document.querySelectorAll('.member-filter').forEach(btn=>{
    btn.classList.toggle('is-active',btn.dataset.memberFilter===filter);
  });
}
function initMemberDirectoryFilters(){
  document.querySelectorAll('[data-member-filter]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      applyMemberDirectoryFilter(btn.dataset.memberFilter||'all');
    });
  });
}



async function sendDiscordCommunityEvent(eventType, payload = {}, dedupeKey = '') {
  if (!supabaseClient || !currentUser) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    await fetch('/api/discord-feed', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${token}`
      },
      body:JSON.stringify({eventType,payload,dedupeKey})
    });
  } catch (error) {
    console.warn('Discord community event skipped:', error);
  }
}


async function sendPersonalEmailNotification(type,title,body,linkUrl='/club-profile.html'){
  if(!supabaseClient||!currentUser)return;
  try{
    const {data}=await supabaseClient.auth.getSession();
    const token=data?.session?.access_token;
    if(!token)return;
    await fetch('/api/club-notification-email',{
      method:'POST',
      headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({personal:true,type,title,body,linkUrl})
    });
  }catch(error){console.warn('Personal email notification skipped:',error);}
}


// ------------------------------------------------------------
// V9.4 — Daily / Weekly Quests
// ------------------------------------------------------------
let questData = { daily: [], weekly: [], periods: {} };
let activeQuestTab = 'daily';

function questPeriodKey(type){
  return type === 'weekly' ? questData.periods?.weekly : questData.periods?.daily;
}

function renderQuestList(){
  const list=$('quest-list');
  const chip=$('quest-count-chip');
  if(!list) return;
  const items=Array.isArray(questData[activeQuestTab])?questData[activeQuestTab]:[];
  if(!items.length){
    list.innerHTML='<div class="club-content-empty">Keine Aufgaben verfügbar.</div>';
    if(chip)chip.textContent='0 offen';
    return;
  }
  const periodStart=questPeriodKey(activeQuestTab);
  const rows=items.map(item=>{
    const p=Math.min(Number(item.progress||0),Number(item.target||1));
    const target=Math.max(1,Number(item.target||1));
    const done=p>=target;
    const claimed=!!item.claimed;
    const percent=Math.round((p/target)*100);
    const button=done&&!claimed
      ? `<button class="button button-small button-primary quest-claim" data-quest="${escapeAttr(item.key)}" data-reward="${Number(item.reward_xp||0)}">+${Number(item.reward_xp||0)} XP abholen</button>`
      : claimed
        ? '<span class="quest-state quest-state-done">✓ Abgeholt</span>'
        : `<span class="quest-state">${p}/${target}</span>`;
    return `<article class="quest-row ${done?'is-complete':''}">
      <div class="quest-icon">${escapeHtml(item.icon||'🎯')}</div>
      <div class="quest-main">
        <div class="quest-head"><strong>${escapeHtml(item.title||'Aufgabe')}</strong>${button}</div>
        <small>${escapeHtml(item.description||'')}</small>
        <div class="quest-progress"><span style="width:${percent}%"></span></div>
        <div class="quest-meta"><span>${p}/${target}</span><span>+${Number(item.reward_xp||0)} XP</span></div>
      </div>
    </article>`;
  }).join('');
  list.innerHTML=rows;
  const open=items.filter(x=>!x.claimed).length;
  if(chip)chip.textContent=`${open} offen`;

  list.querySelectorAll('.quest-claim').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.quest;
    const reward=Number(btn.dataset.reward||0);
    if (btn.dataset.claiming === '1') return;
    btn.dataset.claiming = '1';
    btn.disabled=true;
    btn.textContent='Wird abgeholt…';
    try{
      const {data,error}=await supabaseClient.rpc('claim_quest',{
        p_quest_key:key,
        p_period_start:periodStart,
        p_reward_xp:reward
      });
      if(error)throw error;
      const total=Number(data?.total_xp);
      if(Number.isFinite(total)) renderProgress(total);
      void awardProgression(`quest_claimed_${key}`);
      playUISound('reward');
      triggerClubEffect('reward',`Quest abgeschlossen! +${reward} XP 🎯`);
      await loadQuests();
      await checkAchievements();
      await loadProgressionCatalog();
    }catch(error){
      console.warn('Quest claim failed:',error);
      setText('quest-message',error?.message||'Quest konnte nicht abgeholt werden.');
      setStatus(error?.message||'Quest konnte nicht abgeholt werden.','error');
      btn.dataset.claiming = '0';
      btn.disabled=false;
      btn.textContent=`+${reward} XP abholen`;
    }
  });
}

async function loadQuests(){
  const list=$('quest-list');
  if(!list||!supabaseClient||!currentUser)return;
  try{
    const {data,error}=await supabaseClient.rpc('get_my_quests');
    if(error)throw error;
    questData=data||{daily:[],weekly:[],periods:{}};

    try {
      await supabaseClient.rpc('sync_weekly_game_quest');
    } catch (questSyncError) {
      console.warn('Weekly game quest sync skipped:', questSyncError);
    }
    for(const type of ['daily','weekly']){
      const items=Array.isArray(questData[type])?questData[type]:[];
      const period=questPeriodKey(type);
      for(const item of items){
        const {data:row}=await supabaseClient.from('club_quest_progress')
          .select('progress,claimed')
          .eq('user_id',currentUser.id)
          .eq('quest_key',item.key)
          .eq('period_start',period)
          .maybeSingle();
        item.progress=Number(row?.progress||0);
        item.claimed=!!row?.claimed;
      }
    }
    renderQuestList();
  }catch(error){
    console.warn('Quests unavailable:',error);
    list.innerHTML=`<div class="club-content-empty">Aufgaben konnten nicht geladen werden: ${escapeHtml(error?.message||'Unbekannter Fehler')}</div>`;
    setText('quest-count-chip','Nicht verfügbar');
  }
}

async function incrementQuest(key,periodType='daily',amount=1){
  if(!supabaseClient||!currentUser)return;
  try{
    const period=questPeriodKey(periodType);
    if(!period)return;
    await supabaseClient.rpc('increment_quest',{
      p_quest_key:key,
      p_period_start:period,
      p_increment:amount
    });
    loadQuests().catch(()=>{});
  }catch(error){
    console.warn('Quest increment skipped:',error);
  }
}

function initQuestTabs(){
  document.querySelectorAll('[data-quest-tab]').forEach(btn=>btn.onclick=()=>{
    activeQuestTab=btn.dataset.questTab==='weekly'?'weekly':'daily';
    document.querySelectorAll('[data-quest-tab]').forEach(b=>b.classList.toggle('is-active',b===btn));
    renderQuestList();
  });
}


// ------------------------------------------------------------
// V9.6 — Quest Engine: action -> quest progress
// ------------------------------------------------------------
const QUEST_ACTIONS = Object.freeze({
  profile_complete: ['daily_login'],
  daily_login: ['daily_login'],
  daily_game: ['daily_game'],
  profile_complete: ['daily_profile'],
  pet_daily: ['daily_pet'],
  social_message: ['daily_social'],
  poll_vote: ['daily_poll'],
  wheel_spin: ['weekly_wheel'],
  friend_accepted: ['weekly_social'],
  event_attended: ['weekly_event']
});

async function progressQuestsForAction(actionKey, amount = 1) {
  if (!actionKey || !currentUser || !supabaseClient) return;
  const quests = QUEST_ACTIONS[actionKey] || [];
  if (!quests.length) return;

  const periodMap = {
    daily_login: 'daily',
    daily_game: 'daily',
    daily_profile: 'daily',
    daily_pet: 'daily',
    daily_social: 'daily',
    daily_poll: 'daily',
    weekly_wheel: 'weekly',
    weekly_social: 'weekly',
    weekly_event: 'weekly'
  };

  for (const questKey of quests) {
    const periodType = periodMap[questKey] || 'daily';
    const period = questPeriodKey(periodType);
    if (!period) continue;

    try {
      await supabaseClient.rpc('increment_quest', {
        p_quest_key: questKey,
        p_period_start: period,
        p_increment: Math.max(1, Number(amount) || 1)
      });
    } catch (error) {
      console.warn(`Quest progress skipped for ${questKey}:`, error);
    }
  }
  loadQuests().catch(() => {});
}


// V8.3 — Live member refresh + interface effects/sounds
let memberDirectoryTimer = null;
let memberDirectoryLoading = false;
const SOUND_PREF_KEY = 'acy-ui-sounds-v1';

function soundEnabled() {
  try {
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    return stored === null ? true : stored === 'on';
  } catch {
    return true;
  }
}

function setSoundEnabled(enabled) {
  try { localStorage.setItem(SOUND_PREF_KEY, enabled ? 'on' : 'off'); } catch {}
  const toggle = $('sound-toggle');
  const label = $('sound-toggle-label');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.classList.toggle('is-muted', !enabled);
  }
  if (label) label.textContent = enabled ? 'Sounds an' : 'Sounds aus';
}

let audioContext = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioContext = new Ctx();
  return audioContext;
}

function playUISound(kind = 'click') {
  if (!soundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const presets = {
    click:  { f: 520, g: 0.025, d: 0.045, type: 'sine' },
    success:{ f: 740, g: 0.045, d: 0.12, type: 'triangle' },
    reward: { f: 660, g: 0.045, d: 0.16, type: 'sine' },
    level:  { f: 880, g: 0.05,  d: 0.18, type: 'triangle' },
    error:  { f: 180, g: 0.035, d: 0.12, type: 'sawtooth' }
  };
  const p = presets[kind] || presets.click;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.f, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(p.g, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + p.d + 0.02);

  if (kind === 'success' || kind === 'reward' || kind === 'level') {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(p.f * 1.25, now + 0.045);
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.exponentialRampToValueAtTime(p.g * 0.6, now + 0.055);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + p.d + 0.05);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.045);
    osc2.stop(now + p.d + 0.07);
  }
}

function showClubToast(message, kind = 'success') {
  let toast = document.getElementById('club-effect-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'club-effect-toast';
    toast.className = 'club-effect-toast';
    document.body.appendChild(toast);
  }
  toast.className = `club-effect-toast ${kind}`;
  toast.textContent = message;
  clearTimeout(window.__clubToastTimer);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.__clubToastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function spawnClubConfetti(count = 30) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'club-confetti-layer';
  const symbols = ['✦','◆','●','★','♥'];
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'club-confetti';
    piece.textContent = symbols[i % symbols.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.2}s`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3400);
}

function triggerClubEffect(kind = 'success', message = '') {
  if (kind === 'reward' || kind === 'level') {
    spawnClubConfetti(kind === 'level' ? 44 : 28);
  }
  playUISound(kind);
  if (message) showClubToast(message, kind);
}

function initSoundToggle() {
  const toggle = $('sound-toggle');
  if (!toggle) return;
  setSoundEnabled(soundEnabled());
  toggle.addEventListener('click', () => {
    const enabled = !soundEnabled();
    setSoundEnabled(enabled);
    if (enabled) playUISound('success');
  });
}

function startMemberDirectoryPolling() {
  if (memberDirectoryTimer) clearInterval(memberDirectoryTimer);
  memberDirectoryTimer = setInterval(() => {
    const search = $('member-directory-search')?.value || '';
    if (document.hidden || memberDirectoryLoading) return;
    loadMemberDirectory(search, { silent: true }).catch(error =>
      console.warn('Member directory refresh failed:', error)
    );
  }, 30000);
}

async function loadMemberDirectory(search = '', options = {}) {
  const list = $('member-directory-list');
  const countEl = $('member-directory-count');
  if (!list) return;

  memberDirectoryLoading = true;
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Sitzung abgelaufen.');

    const response = await fetch(`/api/club-members?search=${encodeURIComponent(search.trim())}&_=${Date.now()}`, {
      cache:'no-store',
      headers:{Authorization:`Bearer ${token}`}
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Mitglieder konnten nicht geladen werden.');

    const rows = Array.isArray(payload.members) ? payload.members : [];
    const previousOnline = window.__memberOnlineState || new Map();
    const nextOnline = new Map(rows.map(member => [String(member.id), Boolean(member.online)]));
    const onlineTransitions = rows
      .filter(member => previousOnline.has(String(member.id)) && previousOnline.get(String(member.id)) !== Boolean(member.online))
      .map(member => ({ id:String(member.id), online:Boolean(member.online), name:member.display_name || member.username || 'Mitglied' }));
    window.__memberOnlineState = nextOnline;
    if (countEl) countEl.textContent = `${rows.length} Mitglieder`;
    if (!rows.length) {
      list.innerHTML='<div class="club-content-empty">Keine Mitglieder gefunden.</div>';
      return;
    }

    const badgeIcon={'ACY Rookie':'💜','ACY Member':'🎮','Discord Member':'💬','ACY OG':'👑','ACY Legend':'🏆','Early Member':'⏳'};
    const petLabels={cat:'Katze',dog:'Hund',fox:'Fuchs',axolotl:'Axolotl',dragon:'Drache',unicorn:'Einhorn',penguin:'Pinguin',panda:'Panda',bunny:'Hase',koala:'Koala',hamster:'Hamster',turtle:'Schildkröte',owl:'Eule',frog:'Frosch',bee:'Biene'};

    list.innerHTML=rows.map(member=>{
      const avatar=member.avatar_url
        ? `<img src="${escapeAttr(member.avatar_url)}" alt="" loading="lazy">`
        : `<div class="member-directory-avatar-fallback">${escapeHtml((member.display_name||member.username||'A').charAt(0).toUpperCase())}</div>`;
      const level=levelForXp(Number(member.xp||0)).title;
      const badges=(Array.isArray(member.badges)?member.badges:[]).slice(0,3).map(b=>`${badgeIcon[b]||'✦'} ${escapeHtml(b)}`).join(' · ');
      const lastSeen=member.last_seen?formatRelativeTime(member.last_seen):'';
      const pet=member.pet||null;
      const petPreview=pet
        ? `<div class="member-directory-pet"><img src="assets/pet-${escapeAttr(pet.species)}.webp" alt="${escapeAttr(petLabels[pet.species]||'Begleiter')}" loading="lazy"><span><strong>${escapeHtml(pet.name)}</strong><small>${escapeHtml(petLabels[pet.species]||'Begleiter')} · ${Number(pet.social_xp||0)} Social XP</small></span></div>`
        : `<div class="member-directory-pet is-empty"><span>🐾</span><span><strong>Kein Pet</strong><small>Noch kein Begleiter</small></span></div>`;

      const isFriend = window.__socialFriendIds?.has(String(member.id)) === true;
      const glowTier = Math.max(-1, glowTierForXp(Number(member.xp||0)));
      const glowClass = glowTier >= 0 ? ` glow-tier-${glowTier}` : ' glow-tier-none';
      return `<article class="member-directory-item member-directory-clickable${glowClass}"
        data-member-id="${escapeAttr(member.id)}"
        data-online="${member.online ? 'true' : 'false'}"
        data-has-pet="${member.pet ? 'true' : 'false'}"
        data-is-friend="${isFriend ? 'true' : 'false'}">
        <div class="member-directory-avatar">${avatar}</div>
        <div class="member-directory-main">
          <div class="member-directory-name">${escapeHtml(member.display_name||member.username)}</div>
          <div class="member-directory-handle">@${escapeHtml(member.username||'')} · ${member.online ? '<span class="member-online-label">🟢 Online</span>' : `<span class="member-online-label is-offline">⚫ Offline${lastSeen?` · ${escapeHtml(lastSeen)}`:''}</span>`}</div>
          <p>${member.online && member.game_name ? `🎮 ${escapeHtml(member.game_name)}` : escapeHtml(member.bio||'ACY Club Member')}</p>
          ${petPreview}
        </div>
        <div class="member-directory-meta">
          <strong>${escapeHtml(level)}</strong><small>${Number(member.xp||0)} XP</small><span>${badges||'💜 ACY Rookie'}</span>
          ${member.pet&&member.id!==currentUser.id?`<button class="button button-secondary member-directory-pet-visit" type="button" data-pet-member="${escapeAttr(member.id)}">Pet besuchen</button>`:''}
          ${member.id!==currentUser.id?`<button class="button button-secondary" type="button" data-friend-member="${escapeAttr(member.id)}">Freund</button>
          <button class="button button-danger" type="button" data-block-member="${escapeAttr(member.id)}">Blockieren</button>
          <button class="button button-secondary member-directory-message" type="button" data-message-member="${escapeAttr(member.id)}">Nachricht</button>`:''}
        </div>
      </article>`;
    }).join('');

    applyMemberDirectoryFilter(currentMemberFilter);
    list.querySelectorAll('.member-directory-clickable').forEach(card=>{
      const transition = onlineTransitions.find(item => item.id === card.dataset.memberId);
      if (transition) {
        card.classList.add(transition.online ? 'member-online-changed' : 'member-offline-changed');
        setTimeout(() => card.classList.remove('member-online-changed','member-offline-changed'), 1500);
      }

      card.addEventListener('click',event=>{
        if(event.target.closest('[data-message-member],[data-pet-member],[data-friend-member],[data-block-member]'))return;
        const id=card.dataset.memberId;
        if(id)window.location.href=`/member.html?id=${encodeURIComponent(id)}`;
      });
    });
    list.querySelectorAll('[data-pet-member]').forEach(btn=>{
      btn.addEventListener('click',event=>{
        event.stopPropagation();
        const id=btn.dataset.petMember;
        if(id)window.location.href=`/member.html?id=${encodeURIComponent(id)}#pet-social`;
      });
    });
    list.querySelectorAll('[data-friend-member]').forEach(btn=>{
      btn.addEventListener('click',event=>{event.stopPropagation();sendFriendRequest(btn.dataset.friendMember);});
    });
    list.querySelectorAll('[data-block-member]').forEach(btn=>{
      btn.addEventListener('click',async event=>{
        event.stopPropagation();
        if(!confirm('Dieses Mitglied wirklich blockieren?'))return;
        try{await rpcSocial('block_member',{p_blocked_user_id:btn.dataset.blockMember});setStatus('Kontakt blockiert.','success');await loadSocialConnections();await loadMemberDirectory();}catch(e){setStatus(e.message,'error');}
      });
    });
    list.querySelectorAll('[data-report-member]').forEach(btn=>{
      btn.addEventListener('click',async event=>{
        event.stopPropagation();
        const id=btn.dataset.reportMember;
        const reason=window.prompt('Warum möchtest du dieses Mitglied melden?','Unangemessenes Verhalten');
        if(!reason)return;
        try{
          const {data}=await supabaseClient.auth.getSession(); const token=data?.session?.access_token; if(!token)throw new Error('Sitzung abgelaufen.');
          const response=await fetch('/api/reports',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({targetUserId:id,reason:reason.slice(0,180),details:''})});
          const payload=await response.json().catch(()=>({})); if(!response.ok)throw new Error(payload.error||'Meldung fehlgeschlagen.');
          triggerClubEffect('success','Meldung wurde an die Moderation gesendet.');
        }catch(error){setStatus(error.message,'error');}
      });
    });
    
list.querySelectorAll('[data-message-member]').forEach(btn=>{
      btn.addEventListener('click',event=>{
        event.stopPropagation();
        const id=btn.dataset.messageMember;
        if(id&&id!==currentUser.id)window.location.href=`/club-profile.html?dm=${encodeURIComponent(id)}`;
      });
    });
    if (onlineTransitions.length && options.silent) {
      const first = onlineTransitions[0];
      triggerClubEffect(
        'success',
        `${first.name} ist jetzt ${first.online ? 'online 🟢' : 'offline ⚫'}.`
      );
    }
  }catch(error){
    console.warn('Member directory unavailable:',error);
    if(!options.silent){
      if(countEl)countEl.textContent='– Mitglieder';
      list.innerHTML=`<div class="club-content-empty">${escapeHtml(error?.message||'Mitglieder konnten nicht geladen werden.')}</div>`;
    }
  } finally {
    memberDirectoryLoading = false;
  }
}

async function checkAchievements() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    await fetch('/api/club-achievements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: '{}'
    });
  } catch (error) {
    console.warn('Achievement check skipped:', error);
  }
}

async function loadMemberStats() {
  try {
    const [{ data: attendance }, { data: achievements }, { data: profile }] = await Promise.all([
      supabaseClient.from('club_event_attendance').select('id'),
      supabaseClient.from('club_achievements').select('achievement_key'),
      supabaseClient.from('profiles').select('xp,created_at').eq('id', currentUser.id).maybeSingle()
    ]);

    setText('stat-events', String((attendance || []).length));
    setText('stat-badges', String((achievements || []).length));
    setText('stat-xp', `${Number(profile?.xp || 0)} XP`);
    const created = profile?.created_at || currentUser.created_at;
    const days = Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000));
    setText('stat-days', String(days));
  } catch (error) {
    console.warn('Member stats unavailable:', error);
  }
}

async function loadLeaderboard() {
  const list = $('member-leaderboard-list');
  const countEl = $('leaderboard-count');
  if (!list) return;

  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sitzung abgelaufen.');

    const response = await fetch(`/api/club-leaderboard?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Ranking konnte nicht geladen werden.');

    const members = Array.isArray(payload.members) ? payload.members : [];
    if (countEl) countEl.textContent = `${members.length} Mitglieder`;

    const icons = {1:'🥇',2:'🥈',3:'🥉'};
    list.innerHTML = members.slice(0, 10).map((member) => {
      const avatar = member.avatar_url
        ? `<img src="${escapeAttr(member.avatar_url)}" alt="" loading="lazy">`
        : `<div class="leaderboard-avatar-fallback">${escapeHtml((member.display_name || member.username || 'A').charAt(0).toUpperCase())}</div>`;
      const level = levelForXp(member.xp).title;
      const rank = icons[member.rank] || `#${member.rank}`;
      const glowTier = Math.max(-1, glowTierForXp(Number(member.xp||0)));
      const glowClass = glowTier >= 0 ? ` glow-tier-${glowTier}` : ' glow-tier-none';
      return `<button class="leaderboard-row${glowClass}" type="button" data-member-id="${escapeAttr(member.id)}">
        <span class="leaderboard-rank">${rank}</span>
        <span class="leaderboard-avatar">${avatar}</span>
        <span class="leaderboard-main"><strong>${escapeHtml(member.display_name)}</strong><small>@${escapeHtml(member.username)}</small></span>
        <span class="leaderboard-level">${escapeHtml(level)}</span>
        <span class="leaderboard-xp">${member.xp} XP</span>
      </button>`;
    }).join('') || '<div class="club-content-empty">Noch keine Mitglieder im Ranking.</div>';

    list.querySelectorAll('.leaderboard-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.memberId;
        if (id) window.location.href = `/member.html?id=${encodeURIComponent(id)}`;
      });
    });
  } catch (error) {
    console.warn('Leaderboard unavailable:', error);
    list.innerHTML = `<div class="club-content-empty">${escapeHtml(error?.message || 'Ranking momentan nicht verfügbar.')}</div>`;
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
          <div class="club-content-date" data-iso="${escapeAttr(e.event_date)}">${escapeHtml(when)}</div>
          <div class="club-content-main"><strong>${escapeHtml(e.title)}</strong><p>${escapeHtml(e.description||'')}</p><small>${escapeHtml(e.location||'Community')} · <span class="event-attendee-count">${count}</span> dabei</small></div>
          <button type="button" class="button button-small ${attending?'button-secondary':'button-primary'} event-attend-btn">${attending?'Dabei ✓':'Teilnehmen'}</button>
        </article>`;
      }).join(''):'<div class="club-content-empty">Noch keine kommenden Events. Neue Events werden hier automatisch angezeigt.</div>';

      eventsList.querySelectorAll('.event-attend-btn').forEach(btn=>{
        btn.onclick=async()=>{
          const item=btn.closest('.event-item');
          const eventId=Number(item?.dataset.eventId);
          if(!eventId) return;
          const isAttending = item?.dataset.attending === 'true';
          const eventTime=Date.parse(item?.querySelector('.club-content-date')?.dataset?.iso || '');
          if(Number.isFinite(eventTime) && eventTime<Date.now()){
            btn.disabled=true;
            btn.textContent='Vorbei';
            return;
          }
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
            if(result.attending) void progressQuestsForAction('event_attended');
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
  memberSearchTimer = setTimeout(() => {
    playUISound('click');
    loadMemberDirectory(value).catch(console.warn);
  }, 250);
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

  window.__acyResolvedProfile = {
    ...(window.__acyResolvedProfile || {}),
    display_name: displayName,
    bio,
    updated_at: new Date().toISOString()
  };
  setText('member-name', displayName);
  setText('member-bio', bio || 'Willkommen in deinem persönlichen ACY Club.');
  setStatus('Profil gespeichert.', 'success');
    void progressQuestsForAction('profile_complete');
  triggerClubEffect('success', 'Profil gespeichert.');
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
    window.__acyResolvedProfile = {
      ...(window.__acyResolvedProfile || {}),
      avatar_url: avatarUrl
    };

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
    triggerClubEffect('success', 'Profilbild gespeichert.');
  } catch (error) {
    console.error('Avatar upload failed:', error);
    setStatus(error.message || 'Profilbild-Upload fehlgeschlagen. Bitte prüfe den Supabase-Bucket club-avatars.', 'error');
  }
});

$('discord-connect-btn')?.addEventListener('click', connectDiscord);

$('logout')?.addEventListener('click', async () => {
  try { if (notificationRealtimeChannel) supabaseClient.removeChannel(notificationRealtimeChannel); } catch {}
  if (notificationRefreshTimer) clearInterval(notificationRefreshTimer);
  if (supabaseClient) await supabaseClient.auth.signOut();
  window.location.href = '/club.html';
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

init();
