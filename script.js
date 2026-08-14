const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.nav');
if (menuButton) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('mobile-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
}


// Keep Twitch's required parent domain correct after deployment.
// Twitch requires the embedding domain to be declared in the player URL.
(function setupTwitchParents(){
  const host = window.location.hostname;
  const parent = host && host !== 'localhost' && host !== '127.0.0.1' ? host : 'acyjannik.de';
  const player = document.getElementById('twitch-player');
  const chat = document.getElementById('twitch-chat');
  if (player) player.src = `https://player.twitch.tv/?channel=acyjannik&parent=${encodeURIComponent(parent)}&autoplay=false&muted=true`;
  if (chat) chat.src = `https://www.twitch.tv/embed/acyjannik/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
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
  };

  try {
    const response = await fetch('/api/twitch-status', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const live = Boolean(data.live);

    const setDot = (el, active) => {
      if (!el) return;
      el.classList.toggle('is-live', active);
    };

    setDot(els.headerDot, live);
    setDot(els.heroDot, live);
    setDot(els.streamDot, live);

    if (live) {
      if (els.headerText) els.headerText.textContent = 'LIVE';
      if (els.heroLabel) els.heroLabel.textContent = 'ACYJANNIK · LIVE';
      if (els.heroTitle) els.heroTitle.textContent = data.game || 'LIVE AUF TWITCH';
      if (els.heroSubtitle) els.heroSubtitle.textContent = data.title || 'Jetzt live auf Twitch';
      if (els.streamStatus) els.streamStatus.textContent = 'TWITCH LIVE';
      if (els.statusEyebrow) els.statusEyebrow.textContent = '🔴 LIVE';
      if (els.statusTitle) els.statusTitle.textContent = data.title || 'Acyjannik ist live';
      if (els.statusMeta) {
        const viewerText = Number.isFinite(data.viewerCount)
          ? `${data.viewerCount.toLocaleString('de-DE')} Zuschauer`
          : 'Live auf Twitch';
        els.statusMeta.textContent = [data.game, viewerText].filter(Boolean).join(' · ');
      }
    } else {
      if (els.headerText) els.headerText.textContent = 'Twitch';
      if (els.heroLabel) els.heroLabel.textContent = 'ACYJANNIK';
      if (els.heroTitle) els.heroTitle.textContent = 'LIVE SOON';
      if (els.heroSubtitle) els.heroSubtitle.textContent = 'Auf Twitch vorbeischauen';
      if (els.streamStatus) els.streamStatus.textContent = 'OFFLINE';
      if (els.statusEyebrow) els.statusEyebrow.textContent = 'TWITCH';
      if (els.statusTitle) els.statusTitle.textContent = 'Acyjannik ist gerade offline';
      if (els.statusMeta) els.statusMeta.textContent = 'Schau später wieder vorbei oder folge dem Kanal auf Twitch.';
    }
  } catch (error) {
    console.error('Twitch status error:', error);
    if (els.statusTitle) els.statusTitle.textContent = 'Twitch-Status momentan nicht verfügbar';
    if (els.statusMeta) els.statusMeta.textContent = 'Der Live-Player bleibt verfügbar. Die Statusanzeige wartet auf die API-Konfiguration.';
  }
}

updateTwitchStatus();
setInterval(updateTwitchStatus, 60000);


// Public content layer: reads only public Supabase rows.
// If Supabase is not configured yet, the static fallback content remains visible.
async function loadPublicContent() {
  try {
    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    const config = await configResponse.json();
    if (!config.configured) return;

    const headers = {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    };
    const base = `${config.supabaseUrl}/rest/v1`;

    const [settingsRes, socialsRes, gamesRes] = await Promise.all([
      fetch(`${base}/site_settings?select=*&id=eq.true&limit=1`, { headers, cache: 'no-store' }),
      fetch(`${base}/social_links?select=*&enabled=eq.true&order=sort_order.asc`, { headers, cache: 'no-store' }),
      fetch(`${base}/games?select=*&enabled=eq.true&order=sort_order.asc`, { headers, cache: 'no-store' }),
    ]);

    if (settingsRes.ok) {
      const rows = await settingsRes.json();
      const settings = rows[0];
      if (settings) {
        const kicker = document.getElementById('hero-kicker-public');
        const title = document.getElementById('hero-title-public');
        const description = document.getElementById('hero-description-public');
        const community = document.getElementById('community-text-public');
        const heroImage = document.querySelector('.hero-photo');
        if (kicker && settings.hero_kicker) kicker.innerHTML = `<span class="pulse"></span> ${escapeHtml(settings.hero_kicker)}`;
        if (title && settings.hero_title) title.innerHTML = escapeHtml(settings.hero_title).replace(/^ACY/, 'ACY');
        if (description && settings.hero_description) description.textContent = settings.hero_description;
        if (community && settings.community_text) community.textContent = settings.community_text;
        if (heroImage && settings.hero_image_url) heroImage.src = settings.hero_image_url;
      }
    }

    if (socialsRes.ok) {
      const socials = await socialsRes.json();
      const grid = document.getElementById('social-grid');
      if (grid && socials.length) {
        grid.innerHTML = socials.map((item) => {
          const icons = {twitch:'TW', tiktok:'TK', whatsapp:'WA', discord:'DC', instagram:'IG', youtube:'YT'};
          const icon = icons[item.platform] || item.label.slice(0,2).toUpperCase();
          const sub = item.platform === 'tiktok' ? '@acyjannik' : item.label;
          return `<a class="social-card reveal" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">
            <span class="social-icon">${escapeHtml(icon)}</span>
            <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(sub)}</small></div><b>↗</b>
          </a>`;
        }).join('');
      }
    }

    if (gamesRes.ok) {
      const games = await gamesRes.json();
      const grid = document.getElementById('games-grid');
      if (grid && games.length) {
        grid.innerHTML = games.map((game, index) => {
          const number = String(index + 1).padStart(2,'0');
          const slug = game.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
          const image = game.image_url ? `<img src="${escapeAttr(game.image_url)}" alt="" loading="lazy">` : '';
          return `<article class="game-card game-${escapeAttr(slug)} reveal">
            ${image}
            <span>${number}</span>
            <div><p>${escapeHtml(game.name.toUpperCase())}</p><small>${escapeHtml(game.description || game.tag || '')}</small></div>
          </article>`;
        }).join('');
      }
    }
  } catch (error) {
    console.debug('Public content not configured yet:', error);
  }
}

function escapeAttr(value = '') {
  return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadPublicContent();
