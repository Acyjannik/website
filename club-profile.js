let supabaseClient = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
  return el;
}

function setStatus(text, type = '') {
  const el = $('profile-save-status') || $('member-social-status') || $('poll-admin-message');
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



// ------------------------------------------------------------
// V6.1 Community Games: current-game presence
// ------------------------------------------------------------
async function loadCurrentGamePresence() {
  const select = $('current-game-select');
  const save = $('current-game-save');
  if (!select || !save || !currentUser) return;

  try {
    const [{ data: games, error: gamesError }, { data: presence, error: presenceError }] = await Promise.all([
      supabaseClient.from('games').select('id,name,tag').eq('enabled', true).order('sort_order').order('name'),
      supabaseClient.from('club_game_presence').select('game_id,updated_at').eq('user_id', currentUser.id).maybeSingle()
    ]);
    if (gamesError) throw gamesError;
    if (presenceError) throw presenceError;

    select.innerHTML = '<option value="">Ich spiele gerade nichts / ausblenden</option>' +
      (games || []).map(game => `<option value="${escapeAttr(game.id)}">${escapeHtml(game.name)}</option>`).join('');
    select.value = presence?.game_id || '';
    setText('current-game-status', presence?.game_id ? 'Aktuell gesetzt' : 'Noch nicht gesetzt');

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

    input.value = '';
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
    await loadProfile();
    await loadMemberStats();
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
  { key: 'acy_og', icon: '👑', title: 'ACY OG', detail: '500 XP erreichen.', progress: s => ({ value: s.xp, max: 500 }) },
  { key: 'acy_legend', icon: '🏆', title: 'ACY Legend', detail: '1.000 XP erreichen.', progress: s => ({ value: s.xp, max: 1000 }) },
  { key: 'early_member', icon: '⏳', title: 'Early Member', detail: '30 Tage Mitglied sein.', progress: s => ({ value: s.days, max: 30 }) },
  { key: 'veteran_member', icon: '🛡️', title: 'ACY Veteran', detail: '90 Tage Mitglied sein.', progress: s => ({ value: s.days, max: 90 }) },
  { key: 'member_of_month', icon: '👑', title: 'Member of the Month', detail: 'Von der Community als Spotlight-Mitglied ausgewählt werden.', special: true }
];

function renderProgressionCatalog(state) {
  const xpList = $('xp-catalog-list');
  const achievementList = $('achievement-catalog-list');
  if (!xpList || !achievementList) return;

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

  achievementList.innerHTML = ACHIEVEMENT_CATALOG.map(item => {
    const p = item.progress ? item.progress(state) : null;
    const unlocked = item.special ? awarded.has(item.key) : awarded.has(item.key);
    const value = p ? Math.min(p.value, p.max) : null;
    const percent = p ? Math.round((value / p.max) * 100) : (unlocked ? 100 : 0);
    const progressText = p ? `${value.toLocaleString('de-DE')} / ${p.max.toLocaleString('de-DE')}` : 'Spezial';
    return `<div class="catalog-row achievement-row${unlocked ? ' is-unlocked' : ''}">
      <span class="catalog-icon">${item.icon}</span>
      <span class="catalog-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small>
        ${p ? `<span class="catalog-progress"><span style="width:${percent}%"></span></span>` : ''}
      </span>
      <span class="catalog-status">${unlocked ? '✓ freigeschaltet' : progressText}</span>
    </div>`;
  }).join('');

  const earnedCount = ACHIEVEMENT_CATALOG.filter(item => awarded.has(item.key)).length;
  setText('catalog-earned-summary', `${earnedCount} / ${ACHIEVEMENT_CATALOG.length} Achievements`);
}

async function loadProgressionCatalog() {
  try {
    const [{ data: profile }, { data: attendance }, { data: achievements }, { data: xpEvents }] = await Promise.all([
      supabaseClient.from('profiles').select('xp,created_at,display_name,bio,discord_connected').eq('id', currentUser.id).maybeSingle(),
      supabaseClient.from('club_event_attendance').select('id'),
      supabaseClient.from('club_achievements').select('achievement_key'),
      supabaseClient.from('club_xp_events').select('event_key,xp')
    ]);

    const created = profile?.created_at || currentUser.created_at;
    const days = Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000));
    const state = {
      xp: Number(profile?.xp || 0),
      days,
      events: (attendance || []).length,
      discord: !!profile?.discord_connected,
      profileComplete: !!(profile?.display_name || '').trim() && !!(profile?.bio || '').trim(),
      achievements: (achievements || []).map(a => a.achievement_key),
      xpEvents: (xpEvents || []).filter(e => Number(e.xp || 0) > 0).map(e => e.event_key)
    };

    // event_attended_<id> and poll_vote_<id> are repeatable current-state keys.
    // Keep the catalog status meaningful without pretending there is only one.
    state.xpEvents = new Set((xpEvents || []).filter(e => Number(e.xp || 0) > 0).map(e => e.event_key));
    renderProgressionCatalog(state);
  } catch (error) {
    console.warn('Progression catalog unavailable:', error);
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
    ? `Noch ${Math.max(0, next - Number(pet.pet_xp || 0))} XP bis ${level.nextTitle}`
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
      setPetStatus('Heute gab es +5 XP für die Tierpflege. 🐾', 'success');
    } else {
      setPetStatus('Dein Tier freut sich. 🐾', 'success');
    }
    await loadProfile();
    await loadProgressionCatalog();
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
  {key:'xp_25',angle:0},{key:'xp_50',angle:51.43},{key:'xp_100',angle:102.86},
  {key:'xp_250',angle:154.29},{key:'pet_care',angle:205.72},
  {key:'extra_spin',angle:257.15},{key:'twitch_reward',angle:308.58}
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
function setWheelCooldown(nextFreeAt, spinTokens = 0){
  const button=$('club-wheel-spin');
  const chip=$('wheel-status-chip');

  const tokens = Math.max(0, Number(spinTokens || 0));
  if (tokens > 0) {
    if (button){button.disabled=false;button.textContent=`🎡 Drehen · Extra-Dreh (${tokens})`;}
    if (chip)chip.textContent=`${tokens} Extra-Dreh${tokens===1?'':'e'} verfügbar`;
    return;
  }

  if(!nextFreeAt){
    if(button){button.disabled=false;button.textContent='🎡 Drehen';}
    if(chip)chip.textContent='1 Dreh verfügbar';
    return;
  }

  const next=new Date(nextFreeAt).getTime();
  const tick=()=>{
    const left=Math.max(0,next-Date.now());
    if(!left){
      if(button){button.disabled=false;button.textContent='🎡 Drehen';}
      if(chip)chip.textContent='1 Dreh verfügbar';
      clearInterval(timer);
      return;
    }
    const h=Math.floor(left/3600000),m=Math.floor(left%3600000/60000);
    if(button){button.disabled=true;button.textContent='⏳ Später wieder';}
    if(chip)chip.textContent=`Nächster Dreh in ${h}h ${m}m`;
  };
  tick();
  const timer=setInterval(tick,30000);
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
      setWheelCooldown(data.next_free_at, data.spin_tokens);return;
    }
    const seg=WHEEL_SEGMENTS.find(s=>s.key===data.reward_key)||WHEEL_SEGMENTS[0];
    wheel.style.setProperty('--wheel-stop',`${1800+(360-seg.angle)}deg`);
    wheel.classList.remove('is-spinning');void wheel.offsetWidth;wheel.classList.add('is-spinning');
    await new Promise(resolve=>setTimeout(resolve,3400));
    message.textContent=`🎉 ${data.reward_label}${data.reward_class==='spin'?' · Du kannst sofort noch einmal drehen.':data.total_xp!=null?` · Jetzt ${Number(data.total_xp).toLocaleString('de-DE')} XP.`:''}`;
    message.className='club-auth-status success';
    if(Number.isFinite(data.total_xp)){renderProgress(data.total_xp);setText('member-xp',`${data.total_xp} XP`);}
    if(data.reward_class==='pet')await loadPet();
    await loadWheelHistory();setWheelCooldown(data.next_free_at, data.spin_tokens);
  }catch(error){
    console.error('Wheel spin error:',error);message.textContent=error?.message||'Das Glücksrad konnte nicht gedreht werden.';
    message.className='club-auth-status error';button.disabled=false;
  }
}
document.getElementById('club-wheel-spin')?.addEventListener('click',spinWheel);


// V7.8 Rewards
let myRewardsState = {catalog:[],inventory:[]};

async function loadMyRewards(){
  const list=$('my-rewards-list'), catalog=$('reward-catalog-list');
  if(!list||!catalog||!supabaseClient)return;
  try{
    const {data,error}=await supabaseClient.rpc('get_my_rewards');
    if(error)throw error;
    myRewardsState=data||{catalog:[],inventory:[]};
    const inv=Array.isArray(myRewardsState.inventory)?myRewardsState.inventory:[];
    const available=inv.filter(x=>x.status==='available');
    const used=inv.filter(x=>x.status==='used');
    const spinTokens=available.filter(x=>x.reward_type==='wheel_spin').reduce((sum,x)=>sum+Number(x.reward_value||1),0);
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
          setText('rewards-message',`🎁 ${result?.name||'Reward'} eingelöst.`,);
          const status=$('rewards-message'); if(status)status.className='club-auth-status success';
          await loadMyRewards();
          if(result?.reward_type==='wheel_spin'){
            setText('wheel-status-chip','Extra-Dreh verfügbar');
            setText('wheel-message','Du hast einen Extra-Dreh erhalten.');
          }
        }catch(error){
          btn.disabled=false;btn.textContent='Einlösen';
          const status=$('rewards-message');if(status){status.textContent=error?.message||'Reward konnte nicht eingelöst werden.';status.className='club-auth-status error';}
        }
      });
    });
  }catch(error){
    console.warn('Rewards unavailable:',error);
    list.innerHTML='<div class="club-content-empty">Rewards konnten gerade nicht geladen werden.</div>';
    catalog.innerHTML='';
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

    const oauthCallback = handleDiscordOAuthCallback();
    const { data } = await supabaseClient.auth.getSession();
    if (!data?.session?.user) {
      window.location.href = '/club.html';
      return;
    }

    currentUser = data.session.user;
    initMemberSectionNavigation();
    await loadNotificationPreferences();
    await loadMyRewards();
    await loadWheelHistory();

    const dmTarget = new URLSearchParams(window.location.search).get('dm');

    // Supabase may finish the OAuth identity exchange immediately after the
    // initial session promise resolves. Give the auth client one turn to
    // settle, then verify the identity again.
    if (oauthCallback) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Registration XP is awarded after the email-confirmed session exists.
    // The server-side unique constraint makes this safe to call more than once.
    await awardProgression('registration');
    await loadProfile();
    await loadPet();
    await loadDiscordLink();
    await loadTwitch();
    await loadClubContent();
    await loadMemberDirectory();
     await loadSocialConnections();
     await startSocialPresence();
    await loadDirectMessages(dmTarget || '');
    await loadCommunityPoll();
    await loadClubChat();
    await loadClubClips();
    await checkAchievements();
    await loadMemberStats();
    await loadProgressionCatalog();
    await loadCurrentGamePresence();
    // Optional dashboard extras are intentionally independent.
    await Promise.allSettled([
      checkAchievements(),
      loadMemberStats(),
      loadProgressionCatalog(),
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
      const result = await awardProgression('discord_connected');
      if (result?.totalXp !== undefined) {
        renderBadges((window.__memberBadges || []), Number(result.totalXp), true);
        setText('member-xp', `${result.totalXp} XP`);
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
            <span class="notification-icon">${n.notification_type === 'live' ? '🔴' : n.notification_type === 'badge' ? '🏆' : n.notification_type === 'event' ? '📅' : n.notification_type === 'direct_message' ? '💌' : '💜'}</span>
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
      .from('club_game_presence')
      .upsert({
        user_id: currentUser.id,
        game_id: null,
        updated_at: new Date().toISOString()
      }, { onConflict:'user_id' });

    // If game_id is required by the legacy V6.1 schema, don't break the page.
    if (error) {
      const code = String(error.code || '');
      if (code === '23502' || /null value.*game_id/i.test(error.message || '')) return;
      console.warn('Presence heartbeat skipped:', error);
    }
  } catch (error) {
    console.warn('Presence heartbeat skipped:', error);
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
  setText('social-friend-count', `${friends.length} Freunde`);

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
      `<button class="button button-secondary button-small" data-social-message="${escapeAttr(person.user_id)}">Nachricht</button>
       <button class="button button-secondary button-small" data-social-remove="${escapeAttr(person.user_id)}">Entfernen</button>
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
    try{await rpcSocial('respond_friend_request',{p_request_id:btn.dataset.socialAccept,p_accept:true});await loadSocialConnections();}catch(e){setStatus(e.message,'error');}
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
    const data=await rpcSocial('get_my_social_connections');
    renderSocialConnections(data||{});
  }catch(error){
    console.warn('Social connections unavailable:',error);
    setText('social-friend-count','– Freunde');
  }
}

async function sendFriendRequest(userId){
  try{
    await rpcSocial('send_friend_request',{p_target_user_id:userId});
    setStatus('Freundschaftsanfrage gesendet.','success');
    await loadSocialConnections();
    await loadMemberDirectory();
  }catch(error){setStatus(error?.message||'Anfrage konnte nicht gesendet werden.','error');}
}

async function loadMemberDirectory(search = '') {
  const list = $('member-directory-list');
  const countEl = $('member-directory-count');
  if (!list) return;

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
      const pet=member.pet||null;
      const petPreview=pet
        ? `<div class="member-directory-pet"><img src="assets/pet-${escapeAttr(pet.species)}.webp" alt="${escapeAttr(petLabels[pet.species]||'Begleiter')}" loading="lazy"><span><strong>${escapeHtml(pet.name)}</strong><small>${escapeHtml(petLabels[pet.species]||'Begleiter')} · ${Number(pet.social_xp||0)} Social XP</small></span></div>`
        : `<div class="member-directory-pet is-empty"><span>🐾</span><span><strong>Kein Pet</strong><small>Noch kein Begleiter</small></span></div>`;

      return `<article class="member-directory-item member-directory-clickable" data-member-id="${escapeAttr(member.id)}">
        <div class="member-directory-avatar">${avatar}</div>
        <div class="member-directory-main">
          <div class="member-directory-name">${escapeHtml(member.display_name||member.username)}</div>
          <div class="member-directory-handle">@${escapeHtml(member.username||'')} · ${member.online ? '<span class="member-online-label">🟢 Online</span>' : '<span class="member-online-label is-offline">⚫ Offline'}</span></div>
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

    list.querySelectorAll('.member-directory-clickable').forEach(card=>{
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
    list.querySelectorAll('[data-message-member]').forEach(btn=>{
      btn.addEventListener('click',event=>{
        event.stopPropagation();
        const id=btn.dataset.messageMember;
        if(id&&id!==currentUser.id)window.location.href=`/club-profile.html?dm=${encodeURIComponent(id)}`;
      });
    });
  }catch(error){
    console.warn('Member directory unavailable:',error);
    if(countEl)countEl.textContent='– Mitglieder';
    list.innerHTML=`<div class="club-content-empty">${escapeHtml(error?.message||'Mitglieder konnten nicht geladen werden.')}</div>`;
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
