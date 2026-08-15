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
    'Member of the Month': '👑'
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

document.getElementById('notification-bell')?.addEventListener('click', () => {
  const panel = document.getElementById('notification-panel');
  if (panel) panel.hidden = !panel.hidden;
});
document.getElementById('notification-close')?.addEventListener('click', () => {
  const panel = document.getElementById('notification-panel');
  if (panel) panel.hidden = true;
});

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
    // Registration XP is awarded after the email-confirmed session exists.
    // The server-side unique constraint makes this safe to call more than once.
    await awardProgression('registration');
    await loadProfile();
    await loadDiscordLink();
    await loadTwitch();
    await loadClubContent();
    await loadMemberDirectory();
    await loadClubChat();
    await loadClubClips();
    await checkAchievements();
    await loadMemberStats();
    // Optional dashboard extras are intentionally independent.
    await Promise.allSettled([
      checkAchievements(),
      loadMemberStats(),
      loadLeaderboard(),
      loadMemberHub(),
      loadNotifications(),
      loadSpotlight()
    ]);
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

async function loadMemberHub() {
  const greeting = $('hub-greeting');
  const summary = $('hub-summary');
  const title = $('hub-level-title');
  const xp = $('hub-level-xp');
  const fill = $('hub-xp-fill');
  const next = $('hub-next-level');

  const name = $('member-name')?.textContent || 'Member';
  const currentXp = Number($('member-xp')?.textContent?.replace(/[^\d]/g, '') || 0);
  const level = levelForXp(currentXp);

  if (greeting) greeting.textContent = `Hey, ${name}.`;
  if (summary) summary.textContent = `${currentXp} XP · ${level.title}`;
  if (title) title.textContent = level.title;
  if (xp) xp.textContent = `${currentXp} XP`;

  const thresholds = [0, 100, 250, 500, 1000, 2000];
  let idx = 0;
  for (let i = 0; i < thresholds.length; i++) if (currentXp >= thresholds[i]) idx = i;
  const base = thresholds[idx];
  const nextThreshold = thresholds[idx + 1] ?? base + 1000;
  const progress = Math.max(0, Math.min(100, ((currentXp - base) / Math.max(1, nextThreshold - base)) * 100));
  if (fill) fill.style.width = `${progress}%`;
  if (next) next.textContent = currentXp >= nextThreshold
    ? 'Maximales Club-Level erreicht.'
    : `Noch ${Math.max(0, nextThreshold - currentXp)} XP bis zum nächsten Level.`;

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
      ? badges.map(card => `<div class="hub-badge-mini">${card.innerHTML}</div>`).join('')
      : '<div class="club-content-empty">Noch keine Achievements.</div>';
  }
}

async function loadNotifications() {
  const container = $('notifications-list');
  const badge = $('notification-count');
  if (!container) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    const response = await fetch(`/api/club-notifications?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Benachrichtigungen konnten nicht geladen werden.');
    const notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    const unread = notifications.filter(n => !n.read_at).length;
    if (badge) {
      badge.textContent = unread ? String(unread) : '';
      badge.hidden = !unread;
    }
    container.innerHTML = notifications.length
      ? notifications.slice(0, 8).map(n => `
          <button class="notification-row ${n.read_at ? '' : 'is-unread'}" type="button" data-notification-id="${n.id}" data-link="${escapeAttr(n.link_url || '')}">
            <span class="notification-icon">${n.notification_type === 'live' ? '🔴' : n.notification_type === 'badge' ? '🏆' : n.notification_type === 'event' ? '📅' : '💜'}</span>
            <span><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.body)}</small></span>
          </button>`).join('')
      : '<div class="club-content-empty">Keine neuen Benachrichtigungen.</div>';

    container.querySelectorAll('.notification-row').forEach(row => {
      row.addEventListener('click', async () => {
        const id = row.dataset.notificationId;
        const { error } = await supabaseClient.from('club_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
        if (error) console.warn('Notification read state failed:', error);
        const link = row.dataset.link;
        if (link) window.location.href = link;
        else await loadNotifications();
      });
    });
  } catch (error) {
    console.warn('Notifications unavailable:', error);
  }
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

  try {
    const { data, error } = await supabaseClient
      .from('club_chat_messages')
      .select(`
        id,
        user_id,
        message,
        created_at,
        profiles (
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    clubChatMessages = Array.isArray(data) ? data : [];
    renderChat();

    if (clubChatChannel) await supabaseClient.removeChannel(clubChatChannel);

    clubChatChannel = supabaseClient
      .channel('acy-club-chat', { config: { presence: { key: currentUser.id } } })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'club_chat_messages'
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data: row } = await supabaseClient
            .from('club_chat_messages')
            .select(`
              id,
              user_id,
              message,
              created_at,
              profiles (
                username,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .maybeSingle();
          if (row && !clubChatMessages.some(m => m.id === row.id)) {
            clubChatMessages.push(row);
            clubChatMessages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
            clubChatMessages = clubChatMessages.slice(-100);
            renderChat();
          }
        }
        if (payload.eventType === 'DELETE') {
          clubChatMessages = clubChatMessages.filter(m => m.id !== payload.old.id);
          renderChat();
        }
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
      });

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
          setChatStatus('Nachricht konnte nicht gesendet werden.', 'error');
          console.warn('Chat send error:', sendError);
        }
      } else {
        input.value = '';
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
    updateChatCounter();
  } catch (error) {
    console.warn('Club chat unavailable:', error);
    list.innerHTML = `<div class="club-content-empty">Chat konnte nicht geladen werden. Hast du die V5.0-Datenbank in Supabase ausgeführt?</div>`;
  }
}

function updateChatCounter() {
  const input = $('club-chat-input');
  const counter = $('club-chat-counter');
  if (!input || !counter) return;
  counter.textContent = `${input.value.length} / 500`;
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

      return `<article class="member-directory-item member-directory-clickable" data-member-id="${escapeAttr(member.id)}">
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

    list.querySelectorAll('.member-directory-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.memberId;
        if (id) window.location.href = `/member.html?id=${encodeURIComponent(id)}`;
      });
    });
  } catch (error) {
    console.warn('Member directory unavailable:', error);
    if (countEl) countEl.textContent = '– Mitglieder';
    list.innerHTML = `<div class="club-content-empty">${escapeHtml(error?.message || 'Mitglieder konnten nicht geladen werden.')}</div>`;
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
      return `<button class="leaderboard-row" type="button" data-member-id="${escapeAttr(member.id)}">
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

function escapeAttr(value = '') {
  return escapeHtml(value);
}

init();
