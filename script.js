
async function loadPublicGames() {
  const grid = document.getElementById('games-grid');
  const activityGrid = document.getElementById('community-games-grid');
  if (!grid && !activityGrid) return;

  try {
    if (!window.supabase) throw new Error('Supabase client not available');
    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    const config = await configResponse.json();
    if (!config?.configured) throw new Error('Supabase not configured');
    const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    if (grid) {
      const { data: games, error } = await client
        .from('games')
        .select('id,name,description,tag,image_url,enabled,featured,sort_order')
        .eq('enabled', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .limit(3);

      if (error) throw error;
      const rows = games || [];
      grid.innerHTML = rows.length ? rows.map((game, i) => `
        <article class="game-card ${game.featured ? 'featured-game' : ''} reveal visible">
          ${game.image_url ? `<img loading="lazy" referrerpolicy="no-referrer" src="${escapeHtml(game.image_url)}" alt="${escapeHtml(game.name)}">` : ''}
          <span>${String(i + 1).padStart(2, '0')}</span>
          <div>
            <p>${escapeHtml(game.name)}</p>
            <small>${escapeHtml(game.description || game.tag || 'Community Game')}</small>
          </div>
        </article>
      `).join('') : '<div class="club-content-empty">Noch keine Games im öffentlichen Katalog.</div>';
    }

    if (activityGrid) {
      const { data: activity, error: activityError } = await client
        .from('club_game_activity')
        .select('id,name,tag,image_url,description,member_count,sessions_7d,last_seen_at,discovered_at,discovered_source')
        .order('member_count', { ascending: false })
        .order('name', { ascending: true })
        .limit(8);

      if (activityError) throw activityError;
      const rows = (activity || []).filter(row => Number(row.member_count) > 0);

      activityGrid.innerHTML = rows.length ? rows.map((game, i) => {
        const discovered = game.discovered_source === 'twitch' && game.discovered_at &&
          (Date.now() - new Date(game.discovered_at).getTime()) < 86400000;
        return `<article class="community-game-card reveal visible">
          <div class="community-game-art" ${game.image_url ? `style="background-image:url('${escapeHtml(game.image_url)}')"` : ''}></div>
          <div class="community-game-overlay"></div>
          <div class="community-game-body">
            <span class="community-game-rank">#${i + 1}</span>
            <strong>${escapeHtml(game.name)}${discovered ? ' <em class="community-game-new">NEU</em>' : ''}</strong>
            <small>${Number(game.member_count).toLocaleString('de-DE')} ${Number(game.member_count) === 1 ? 'Mitglied spielt' : 'Mitglieder spielen'} das gerade · ${Number(game.sessions_7d||0).toLocaleString('de-DE')}× diese Woche</small>
          </div>
        </article>`;
      }).join('') : `
        <div class="community-games-empty">
          <strong>Noch keine Live-Spielstände.</strong>
          <span>Im ACY Club kannst du auswählen, was du gerade spielst. Dann erscheint es hier.</span>
        </div>`;
    }
  } catch (error) {
    console.warn('Public games unavailable:', error);
    if (grid) grid.innerHTML = '<div class="club-content-empty">Games konnten gerade nicht geladen werden.</div>';
    if (activityGrid) activityGrid.innerHTML = '<div class="community-games-empty"><strong>Community-Games gerade nicht verfügbar.</strong><span>Der Club ist weiterhin erreichbar.</span></div>';
  }
}

let communityGamesTimer = null;
function startCommunityGamesPolling(){
  if (communityGamesTimer) clearInterval(communityGamesTimer);
  if (!document.getElementById('community-games-grid')) return;
  communityGamesTimer = setInterval(() => {
    if (!document.hidden) loadPublicGames().catch(()=>{});
  }, 30000);
}
loadPublicGames();
startCommunityGamesPolling();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.nav');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('mobile-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '✕' : '☰';
    menuButton.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('mobile-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = '☰';
      menuButton.setAttribute('aria-label', 'Menü öffnen');
    });
  });
}



// ------------------------------------------------------------
// V7.6 Cookie / Consent Manager
// - Necessary auth/session storage is always available.
// - Optional third-party Twitch embeds are blocked until consent.
// - Consent is stored in a first-party preference cookie.
// ------------------------------------------------------------
const CONSENT_COOKIE = 'acy_consent_v1';
const CONSENT_MAX_AGE = 31536000;

function getCookie(name) {
  const parts = document.cookie.split(';').map(part => part.trim());
  const prefix = `${name}=`;
  const entry = parts.find(part => part.startsWith(prefix));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(prefix.length)); } catch { return entry.slice(prefix.length); }
}

function getConsent() {
  const raw = getCookie(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      necessary: true,
      externalContent: parsed.externalContent === true,
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return null;
  }
}

function saveConsent(externalContent) {
  const payload = {
    necessary: true,
    externalContent: Boolean(externalContent),
    updatedAt: new Date().toISOString()
  };
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  applyConsent(payload);
}

function openCookieSettings() {
  const modal = document.getElementById('cookie-modal');
  const checkbox = document.getElementById('consent-external-content');
  const consent = getConsent();
  if (checkbox) checkbox.checked = consent?.externalContent === true;
  if (modal) modal.hidden = false;
}

function closeCookieSettings() {
  const modal = document.getElementById('cookie-modal');
  if (modal) modal.hidden = true;
}

function loadExternalTwitchContent() {
  const host = window.location.hostname;
  const parent = host && host !== 'localhost' && host !== '127.0.0.1' ? host : 'acyjannik.de';
  const player = document.getElementById('twitch-player');
  const chat = document.getElementById('twitch-chat');
  const playerPlaceholder = document.getElementById('twitch-player-placeholder');
  const chatPlaceholder = document.getElementById('twitch-chat-placeholder');

  if (player) {
    player.src = `https://player.twitch.tv/?channel=acyjannik&parent=${encodeURIComponent(parent)}&autoplay=false&muted=true`;
    player.hidden = false;
  }
  if (chat) {
    chat.src = `https://www.twitch.tv/embed/acyjannik/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
    chat.hidden = false;
  }
  if (playerPlaceholder) playerPlaceholder.hidden = true;
  if (chatPlaceholder) chatPlaceholder.hidden = true;
}

function unloadExternalTwitchContent() {
  const player = document.getElementById('twitch-player');
  const chat = document.getElementById('twitch-chat');
  const playerPlaceholder = document.getElementById('twitch-player-placeholder');
  const chatPlaceholder = document.getElementById('twitch-chat-placeholder');

  if (player) {
    player.src = '';
    player.hidden = true;
  }
  if (chat) {
    chat.src = '';
    chat.hidden = true;
  }
  if (playerPlaceholder) playerPlaceholder.hidden = false;
  if (chatPlaceholder) chatPlaceholder.hidden = false;
}

function applyConsent(consent) {
  const banner = document.getElementById('cookie-banner');
  if (consent?.externalContent) {
    loadExternalTwitchContent();
  } else {
    unloadExternalTwitchContent();
  }
  if (banner) banner.hidden = Boolean(consent);
}

function initCookieManager() {
  const consent = getConsent();
  if (consent) {
    applyConsent(consent);
  } else {
    unloadExternalTwitchContent();
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.hidden = false;
  }

  document.getElementById('cookie-accept-all-btn')?.addEventListener('click', () => saveConsent(true));
  document.getElementById('cookie-essential-btn')?.addEventListener('click', () => saveConsent(false));
  document.getElementById('cookie-settings-btn')?.addEventListener('click', openCookieSettings);
  document.getElementById('cookie-modal-essential')?.addEventListener('click', () => {
    saveConsent(false);
    closeCookieSettings();
  });
  document.getElementById('cookie-modal-save')?.addEventListener('click', () => {
    saveConsent(Boolean(document.getElementById('consent-external-content')?.checked));
    closeCookieSettings();
  });
  document.querySelectorAll('[data-open-cookie-settings]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openCookieSettings();
    });
  });
  document.querySelectorAll('[data-close-cookie-modal]').forEach((el) => {
    el.addEventListener('click', closeCookieSettings);
  });
  document.querySelector('.cookie-modal-close')?.addEventListener('click', closeCookieSettings);
}

window.addEventListener('DOMContentLoaded', initCookieManager);


// Keep Twitch's required parent domain correct after deployment.
// Twitch requires the embedding domain to be declared in the player URL.
(function setupTwitchParents(){
  const host = window.location.hostname;
  const parent = host && host !== 'localhost' && host !== '127.0.0.1' ? host : 'acyjannik.de';
  const player = document.getElementById('twitch-player');
  const chat = document.getElementById('twitch-chat');
  const consent = getConsent();
  if (consent?.externalContent) {
    if (player) player.src = `https://player.twitch.tv/?channel=acyjannik&parent=${encodeURIComponent(parent)}&autoplay=false&muted=true`;
    if (chat) chat.src = `https://www.twitch.tv/embed/acyjannik/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
  }
})();


// Live status powered by the Twitch Helix API through /api/twitch-status.
// The Twitch secret never reaches the browser.
async function updateTwitchStatus() {
  const els = {
    headerDot: document.getElementById('header-live-dot'),
    headerText: document.getElementById('header-live-text'),
    heroDot: document.getElementById('hero-live-dot'),
    heroLabel: document.getElementById('hero-live-label'),
    heroTitle: document.getElementById('hero-live-title'),
    heroSubtitle: document.getElementById('hero-live-subtitle'),
    streamDot: document.getElementById('stream-live-dot'),
    streamStatus: document.getElementById('stream-status'),
    statusEyebrow: document.getElementById('twitch-status-eyebrow'),
    statusTitle: document.getElementById('twitch-status-title'),
    statusMeta: document.getElementById('twitch-status-meta'),
    liveDetails: document.getElementById('twitch-live-details'),
    liveViewers: document.getElementById('twitch-live-viewers'),
    liveStart: document.getElementById('twitch-live-start'),
    alert: document.getElementById('live-alert'),
    alertTitle: document.getElementById('live-alert-title'),
    alertMeta: document.getElementById('live-alert-meta'),
    hubGrid: document.getElementById('live-hub-grid'),
    hubThumb: document.getElementById('live-hub-thumb'),
    hubKicker: document.getElementById('live-hub-kicker'),
    hubTitle: document.getElementById('live-hub-title'),
    hubGame: document.getElementById('live-hub-game'),
    statStatus: document.getElementById('live-stat-status'),
    statStatusSub: document.getElementById('live-stat-status-sub'),
    statViewers: document.getElementById('live-stat-viewers'),
    statViewersSub: document.getElementById('live-stat-viewers-sub'),
    statStart: document.getElementById('live-stat-start'),
    statStartSub: document.getElementById('live-stat-start-sub'),
    statGame: document.getElementById('live-stat-game'),
    statGameSub: document.getElementById('live-stat-game-sub'),
  };

  const setDot = (el, active) => el?.classList.toggle('is-live', active);
  const formatViewers = n => Number.isFinite(n) ? n.toLocaleString('de-DE') : '–';
  const formatStart = value => value
    ? new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '–';

  try {
    const response = await fetch('/api/twitch-status', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const live = Boolean(data.live);
    const streamId = data.id ? String(data.id) : '';
    const game = data.game || 'Twitch';
    const title = data.title || 'ACYJANNIK ist live';

    setDot(els.headerDot, live);
    setDot(els.heroDot, live);
    setDot(els.streamDot, live);

    if (live) {
      const viewers = Number.isFinite(data.viewerCount) ? data.viewerCount : null;
      const startTime = formatStart(data.startedAt);

      if (els.headerText) els.headerText.textContent = 'LIVE';
      if (els.heroLabel) els.heroLabel.textContent = 'ACYJANNIK · LIVE';
      if (els.heroTitle) els.heroTitle.textContent = game;
      if (els.heroSubtitle) els.heroSubtitle.textContent = title;
      if (els.streamStatus) els.streamStatus.textContent = 'TWITCH LIVE';
      if (els.statusEyebrow) els.statusEyebrow.textContent = '🔴 LIVE';
      if (els.statusTitle) els.statusTitle.textContent = title;
      if (els.statusMeta) els.statusMeta.textContent = [game, viewers !== null ? `${formatViewers(viewers)} Zuschauer` : 'Live auf Twitch'].filter(Boolean).join(' · ');
      if (els.liveDetails) els.liveDetails.hidden = false;
      if (els.liveViewers) els.liveViewers.textContent = viewers !== null ? `👥 ${formatViewers(viewers)} Zuschauer` : '🔴 Live';
      if (els.liveStart) els.liveStart.textContent = data.startedAt ? `Seit ${startTime} Uhr` : '';

      if (els.hubKicker) els.hubKicker.textContent = '🔴 JETZT LIVE';
      if (els.hubTitle) els.hubTitle.textContent = title;
      if (els.hubGame) els.hubGame.textContent = `${game}${viewers !== null ? ` · ${formatViewers(viewers)} Zuschauer` : ''}`;
      if (els.statStatus) els.statStatus.textContent = 'LIVE';
      if (els.statStatusSub) els.statStatusSub.textContent = 'auf Twitch';
      if (els.statViewers) els.statViewers.textContent = viewers !== null ? formatViewers(viewers) : '–';
      if (els.statViewersSub) els.statViewersSub.textContent = 'Zuschauer jetzt';
      if (els.statStart) els.statStart.textContent = startTime;
      if (els.statStartSub) els.statStartSub.textContent = 'Streamstart';
      if (els.statGame) els.statGame.textContent = game;
      if (els.statGameSub) els.statGameSub.textContent = 'Kategorie';

      if (els.hubThumb) {
        const thumb = data.thumbnailUrl
          ? data.thumbnailUrl.replace('{width}', '1280').replace('{height}', '720')
          : '';
        els.hubThumb.style.backgroundImage = thumb ? `url("${thumb}")` : '';
        els.hubThumb.classList.toggle('has-image', Boolean(thumb));
      }

      if (els.alert) {
        const dismissed = sessionStorage.getItem('acy_live_alert_dismissed');
        const shouldShow = dismissed !== streamId;
        els.alert.hidden = !shouldShow;
        if (els.alertTitle) els.alertTitle.textContent = title;
        if (els.alertMeta) els.alertMeta.textContent = [game, viewers !== null ? `${formatViewers(viewers)} Zuschauer` : 'Jetzt auf Twitch'].filter(Boolean).join(' · ');
        els.alert.dataset.streamId = streamId;
      }

      document.title = `🔴 ${title} · ACYJANNIK`;
    } else {
      if (els.headerText) els.headerText.textContent = 'Twitch';
      if (els.heroLabel) els.heroLabel.textContent = 'ACYJANNIK';
      if (els.heroTitle) els.heroTitle.textContent = 'LIVE SOON';
      if (els.heroSubtitle) els.heroSubtitle.textContent = 'Auf Twitch vorbeischauen';
      if (els.streamStatus) els.streamStatus.textContent = 'OFFLINE';
      if (els.statusEyebrow) els.statusEyebrow.textContent = 'TWITCH';
      if (els.statusTitle) els.statusTitle.textContent = 'Acyjannik ist gerade offline';
      if (els.statusMeta) els.statusMeta.textContent = 'Schau später wieder vorbei oder folge dem Kanal auf Twitch.';
      if (els.liveDetails) els.liveDetails.hidden = true;
      if (els.alert) {
        els.alert.hidden = true;
        els.alert.dataset.streamId = '';
      }
      if (els.hubKicker) els.hubKicker.textContent = 'TWITCH';
      if (els.hubTitle) els.hubTitle.textContent = 'Gerade offline';
      if (els.hubGame) els.hubGame.textContent = 'Beim nächsten Stream wieder vorbeischauen.';
      if (els.statStatus) els.statStatus.textContent = 'OFFLINE';
      if (els.statStatusSub) els.statStatusSub.textContent = 'auf Twitch';
      if (els.statViewers) els.statViewers.textContent = '–';
      if (els.statViewersSub) els.statViewersSub.textContent = 'nicht live';
      if (els.statStart) els.statStart.textContent = '–';
      if (els.statStartSub) els.statStartSub.textContent = 'kein aktiver Stream';
      if (els.statGame) els.statGame.textContent = '–';
      if (els.statGameSub) els.statGameSub.textContent = 'Kategorie';
      if (els.hubThumb) {
        els.hubThumb.style.backgroundImage = '';
        els.hubThumb.classList.remove('has-image');
      }
      document.title = 'Acyjannik | Gaming · Streaming · Community';
    }
  } catch (error) {
    console.error('Twitch status error:', error);
    if (els.statusTitle) els.statusTitle.textContent = 'Twitch-Status momentan nicht verfügbar';
    if (els.statusMeta) els.statusMeta.textContent = 'Der Live-Player bleibt verfügbar. Die Statusanzeige wartet auf die API.';
    if (els.statStatus) els.statStatus.textContent = 'UNVERFÜGBAR';
    if (els.hubTitle) els.hubTitle.textContent = 'Live-Status nicht verfügbar';
    if (els.hubGame) els.hubGame.textContent = 'Der Twitch-Player bleibt erreichbar.';
  }
}

updateTwitchStatus();
setInterval(updateTwitchStatus, 30000);
document.getElementById('live-alert-close')?.addEventListener('click', () => {
  const alert = document.getElementById('live-alert');
  if (!alert) return;
  const streamId = alert.dataset.streamId || '';
  if (streamId) sessionStorage.setItem('acy_live_alert_dismissed', streamId);
  alert.hidden = true;
});





// Public content layer.
// Admin changes are loaded from one serverless endpoint, so the public page
// always reads the same normalized data source as the admin dashboard.

// ------------------------------------------------------------
// V7.5 Personal Home — tailor the public homepage to the visitor.
// Logged-out visitors get a concise invite; logged-in members see
// their own Club snapshot and direct next-step buttons.
// ------------------------------------------------------------
async function loadPersonalHomepage() {
  const card = document.getElementById('homepage-personal-card');
  if (!card) return;

  const eyebrow = document.getElementById('homepage-personal-eyebrow');
  const title = document.getElementById('homepage-personal-title');
  const text = document.getElementById('homepage-personal-text');
  const primary = document.getElementById('homepage-personal-primary');
  const secondary = document.getElementById('homepage-personal-secondary');
  const status = document.getElementById('homepage-personal-status');
  const xp = document.getElementById('homepage-personal-xp');
  const pet = document.getElementById('homepage-personal-pet');

  const showGuest = () => {
    if (eyebrow) eyebrow.textContent = 'DEIN ACY CLUB';
    if (title) title.textContent = 'Noch nicht im Club?';
    if (text) text.textContent = 'Erstelle dein Profil, sammle XP, schalte Achievements frei und lass dein eigenes Pet Teil der Community werden.';
    if (status) status.textContent = 'Gast';
    if (xp) xp.textContent = '–';
    if (pet) pet.textContent = '–';
    if (primary) {
      primary.href = '/club.html';
      primary.textContent = 'ACY Club beitreten';
    }
    if (secondary) {
      secondary.href = '#games';
      secondary.textContent = 'Games entdecken';
    }
    card.classList.remove('is-member');
  };

  try {
    // Reuse the same browser auth storage that the Club profile uses.
    for (let i = 0; i < 100 && !window.supabase; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!window.supabase) {
      showGuest();
      return;
    }

    const configResponse = await fetch('/api/config?_=' + Date.now(), { cache: 'no-store' });
    const config = await configResponse.json();
    if (!config?.configured || !config.supabaseUrl || !config.supabaseAnonKey) {
      showGuest();
      return;
    }

    const client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      }
    );

    let user = null;

    // 1) Standard Supabase lookup.
    try {
      const result = await client.auth.getSession();
      user = result?.data?.session?.user || null;
    } catch (error) {
      console.warn('Homepage getSession failed:', error);
    }

    // 2) Direct user lookup.
    if (!user) {
      try {
        const result = await client.auth.getUser();
        user = result?.data?.user || null;
      } catch (error) {
        console.warn('Homepage getUser failed:', error);
      }
    }

    // 3) Restore the persisted localStorage session directly.
    // No token is sent anywhere other than to Supabase's own setSession call.
    if (!user) {
      try {
        const keys = Object.keys(window.localStorage || {});
        const authKey = keys.find(key => /^sb-[a-z0-9-]+-auth-token$/i.test(key));

        if (authKey) {
          const storedRaw = window.localStorage.getItem(authKey);
          const stored = storedRaw ? JSON.parse(storedRaw) : null;

          if (stored?.access_token && stored?.refresh_token) {
            const restored = await client.auth.setSession({
              access_token: stored.access_token,
              refresh_token: stored.refresh_token
            });
            user = restored?.data?.user || restored?.data?.session?.user || null;
          }
        }
      } catch (error) {
        console.warn('Homepage persisted-session restore failed:', error);
      }
    }

    // 4) The public header can already have identified the current user.
    if (!user) {
      const cta = document.getElementById('public-club-cta');
      const headerName = cta?.dataset?.memberName || '';
      const headerUserId = cta?.dataset?.userId || '';

      if (headerUserId && /^[0-9a-f-]{36}$/i.test(headerUserId)) {
        user = { id: headerUserId };
        if (headerName) {
          if (eyebrow) eyebrow.textContent = 'WILLKOMMEN ZURÜCK';
          if (title) title.textContent = `Hey, ${headerName}.`;
        }
      }
    }

    if (!user) {
      showGuest();
      return;
    }

    const { data: profile } = await client
      .from('profiles')
      .select('id,display_name,username,xp')
      .eq('id', user.id)
      .maybeSingle();

    // If the header found an ID but the profile lookup fails, still show a
    // logged-in state instead of falsely claiming the visitor is a guest.
    const name = profile?.display_name || profile?.username || 'Member';
    const currentXp = Number(profile?.xp || 0);

    let ownPet = null;
    try {
      const result = await client.rpc('get_club_pet');
      ownPet = result?.data || null;
    } catch (error) {
      console.warn('Homepage pet lookup unavailable:', error);
    }

    const petName = ownPet?.name || '';
    const petSpecies = ownPet?.species || '';
    const petLabels = {
      cat:'Katze', dog:'Hund', fox:'Fuchs', axolotl:'Axolotl', dragon:'Drache',
      unicorn:'Einhorn', penguin:'Pinguin', panda:'Panda', bunny:'Hase',
      koala:'Koala', hamster:'Hamster', turtle:'Schildkröte', owl:'Eule',
      frog:'Frosch', bee:'Biene'
    };

    if (eyebrow) eyebrow.textContent = 'WILLKOMMEN ZURÜCK';
    if (title) title.textContent = `Hey, ${name}.`;
    if (text) {
      text.textContent = petName
        ? `Dein Club ist bereit. ${petName} wartet auf dich, und die Community läuft weiter.`
        : 'Dein Club ist bereit. Dir fehlt nur noch dein erster eigener Begleiter.';
    }
    if (status) status.textContent = 'Member';
    if (xp) xp.textContent = `${currentXp.toLocaleString('de-DE')} XP`;
    if (pet) pet.textContent = petName
      ? `${petName} · ${petLabels[petSpecies] || 'Pet'}`
      : 'Noch keins';

    if (primary) {
      primary.href = '/club-profile.html';
      primary.textContent = 'Zum Club-Profil';
    }
    if (secondary) {
      secondary.href = petName ? '#community-games' : '/club-profile.html#pet-section';
      secondary.textContent = petName ? 'Community entdecken' : 'Pet adoptieren';
    }

    card.classList.add('is-member');
  } catch (error) {
    console.error('Personal homepage failed:', error);
    showGuest();
  }
}

window.addEventListener('DOMContentLoaded', loadPersonalHomepage);

async function loadPublicContent() {
  try {
    const response = await fetch('/api/site-content', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    const payload = await response.json();

    if (!response.ok || !payload.configured || payload.error) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    const settings = payload.settings || {};
    const kicker = document.getElementById('hero-kicker-public');
    const title = document.getElementById('hero-title-public');
    const description = document.getElementById('hero-description-public');
    const community = document.getElementById('community-text-public');
    const about = document.getElementById('about-text-public');
    const heroImage = document.querySelector('.hero-photo');

    if (kicker && settings.hero_kicker) {
      kicker.innerHTML = `<span class="pulse"></span> ${escapeHtml(settings.hero_kicker)}`;
    }
    if (title && settings.hero_title) {
      title.textContent = settings.hero_title;
    }
    if (description && settings.hero_description) {
      description.textContent = settings.hero_description;
    }
    if (community && Object.prototype.hasOwnProperty.call(settings, 'community_text')) {
      community.textContent = settings.community_text || '';
    }
    if (about && Object.prototype.hasOwnProperty.call(settings, 'about_text')) {
      about.textContent = settings.about_text || '';
    }
    if (heroImage && settings.hero_image_url) {
      heroImage.src = settings.hero_image_url;
    }

    const fallbackSocials = [
      { platform: 'twitch', label: 'Twitch', url: 'https://www.twitch.tv/acyjannik' },
      { platform: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@acyjannik' },
      { platform: 'whatsapp', label: 'WhatsApp', url: 'https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10' },
      { platform: 'discord', label: 'Discord', url: 'https://discord.gg/74ACqBwfu' }
    ];
    const socials = Array.isArray(payload.socials) && payload.socials.length ? payload.socials : fallbackSocials;
    const socialGrid = document.getElementById('social-grid');
    if (socialGrid && socials.length) {
      const iconMap = {
        twitch: '/assets/social/twitch.svg',
        tiktok: '/assets/social/tiktok.svg',
        whatsapp: '/assets/social/whatsapp.svg',
        discord: '/assets/social/discord.svg'
      };
      socialGrid.innerHTML = socials.map((item) => {
        const iconSrc = iconMap[item.platform];
        const sub = item.platform === 'tiktok' ? '@acyjannik' :
          item.platform === 'discord' ? 'ACY Club' : item.label;
        const iconMarkup = iconSrc
          ? `<img class="social-icon-img" src="${iconSrc}" alt="">`
          : `<span class="social-icon-fallback">${escapeHtml(String(item.label || '').slice(0, 2).toUpperCase())}</span>`;
        return `<a class="social-card" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">
          ${iconMarkup}
          <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(sub)}</small></div><b>↗</b>
        </a>`;
      }).join('');
    }

    const fallbackGames = [
      { name: 'Fortnite', description: 'Main Game · Ranked · Community', image_url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fortnite_at_E3_2018_(42719678112).jpg', featured: true, sort_order: 1 },
      { name: 'GTA V', description: 'Open World · Aktuell · Fun', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg', featured: false, sort_order: 2 },
      { name: 'Thick As Thieves', description: 'Stealth · Heist · Community', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg', featured: false, sort_order: 3 },
      { name: 'Overwatch', description: 'Hero Shooter · Competitive · Community', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2357570/header.jpg', featured: false, sort_order: 4 },
      { name: 'MECCHA CHAMELEON', description: 'Hide & Seek · Party · Community', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/4704690/header.jpg', featured: false, sort_order: 5 },
      { name: 'Dead by Daylight', description: 'Horror · Multiplayer · Community', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/381210/header.jpg', featured: false, sort_order: 6 },
      { name: 'Roblox', description: 'Variety · Community · Fun', image_url: '/assets/games/roblox-acy-cover.svg', featured: false, sort_order: 7 }
    ];
    const canonicalCovers = {
      'Fortnite': 'https://cdn.startselect.com/production/blog/preview-images/new-fortnite-season.jpg',
      'GTA V': 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg',
      'Thick As Thieves': 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg'
    };
    const games = (Array.isArray(payload.games) && payload.games.length ? payload.games : fallbackGames)
      .map(game => ({ ...game, image_url: canonicalCovers[game.name] || game.image_url }))
      .sort((a,b) => Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999))
      .slice(0,3);
    const gamesGrid = document.getElementById('games-grid');
    if (gamesGrid && games.length) {
      gamesGrid.innerHTML = games.map((game, index) => {
        const number = String(index + 1).padStart(2, '0');
        const slug = String(game.name || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const image = game.image_url
          ? `<img src="${escapeAttr(game.image_url)}" alt="" loading="lazy">`
          : '';
        const featuredClass = game.featured ? ' featured-game' : '';
        return `<article class="game-card game-${escapeAttr(slug)}${featuredClass} reveal">
          ${image}
          <span>${number}</span>
          <div><p>${escapeHtml(String(game.name || '').toUpperCase())}</p>
          <small>${escapeHtml(game.description || game.tag || '')}</small></div>
        </article>`;
      }).join('');
    }

    // Re-run reveal observers for freshly injected cards, if the original
    // script exposes one; otherwise the cards simply appear normally.
    document.dispatchEvent(new CustomEvent('acy:content-loaded', {
      detail: payload
    }));

  } catch (error) {
    console.warn('Public content sync unavailable, using built-in fallback:', error);
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[ch]));
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

loadPublicContent();

async function loadPublicSpotlight() {
  const card = document.getElementById('public-spotlight-card');
  if (!card) return;
  try {
    const response = await fetch(`/api/club-spotlight?_=${Date.now()}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.spotlight?.member) {
      card.innerHTML = '<div class="club-content-empty">Noch kein Spotlight.</div>';
      return;
    }
    const m = payload.spotlight.member;
    const avatar = m.avatar_url
      ? `<img src="${escapeAttr(m.avatar_url)}" alt="" loading="lazy">`
      : `<div class="public-spotlight-avatar-fallback">${escapeHtml((m.display_name || m.username || 'A').charAt(0).toUpperCase())}</div>`;
    card.innerHTML = `<a href="/member.html?id=${encodeURIComponent(m.id)}" class="public-spotlight-link">
      <div class="public-spotlight-avatar">${avatar}</div>
      <div><span class="eyebrow">${escapeHtml(payload.spotlight.title || 'Member of the Month')}</span><h3>${escapeHtml(m.display_name || m.username)}</h3><small>@${escapeHtml(m.username)}</small><p>${escapeHtml(payload.spotlight.blurb || m.bio || 'Aktives ACY Club Mitglied.')}</p></div>
      <div class="public-spotlight-stats"><strong>${Number(m.xp || 0)} XP</strong><span>${Array.isArray(m.badges) ? m.badges.length : 0} Badges</span></div>
    </a>`;
  } catch (error) {
    console.warn('Public spotlight unavailable:', error);
    card.innerHTML = '<div class="club-content-empty">Spotlight momentan nicht verfügbar.</div>';
  }
}


window.addEventListener('DOMContentLoaded', loadPublicSpotlight);


// ACY Club public header state.
// If a Supabase session exists, replace "ACY Club beitreten" with the member's
// avatar and a direct link to their Club profile. No session means the public
// CTA stays exactly as normal.
async function updatePublicClubHeader() {
  const cta = document.getElementById('public-club-cta');
  if (!cta) return;

  try {
    // Supabase JS is loaded immediately before this script. Give a slow CDN
    // response a moment rather than silently abandoning the logged-in state.
    for (let i = 0; i < 30 && !window.supabase; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!window.supabase) return;

    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    const config = await configResponse.json();
    if (!config?.configured) return;

    const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data } = await client.auth.getSession();
    const user = data?.session?.user;
    if (!user) return;

    cta.dataset.userId = user.id;

    const { data: profile } = await client
      .from('profiles')
      .select('display_name,username,avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    const name = profile?.display_name || profile?.username || 'Mein Club';
    cta.dataset.memberName = name;
    const initial = (name.trim().charAt(0) || 'A').toUpperCase();

    cta.className = 'nav-club-member';
    cta.href = '/club-profile.html';
    cta.setAttribute('aria-label', `Mein ACY Club Profil: ${name}`);
    cta.innerHTML = profile?.avatar_url
      ? `<img class="public-member-avatar" src="${String(profile.avatar_url).replace(/"/g, '&quot;')}" alt="" loading="eager"><span class="public-member-copy"><small>ACY CLUB</small><strong>${escapePublicText(name)}</strong></span>`
      : `<span class="public-member-avatar public-member-fallback">${escapePublicText(initial)}</span><span class="public-member-copy"><small>ACY CLUB</small><strong>${escapePublicText(name)}</strong></span>`;
  } catch (error) {
    console.warn('Public Club header unavailable:', error);
  }
}

function escapePublicText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

updatePublicClubHeader();

// Small homepage interaction layer.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href');
  if (!id || id === '#') return;
  const target = document.querySelector(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', id);
});

document.addEventListener('pointermove', (event) => {
  const card = event.target.closest('.homepage-personal-card, .game-card, .social-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
  const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
  card.style.setProperty('--pointer-x', `${x}%`);
  card.style.setProperty('--pointer-y', `${y}%`);
});

