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




// Public content layer.
// Admin changes are loaded from one serverless endpoint, so the public page
// always reads the same normalized data source as the admin dashboard.
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
    if (community && settings.community_text) {
      community.textContent = settings.community_text;
    }
    if (heroImage && settings.hero_image_url) {
      heroImage.src = settings.hero_image_url;
    }

    const fallbackSocials = [
      { platform: 'twitch', label: 'Twitch', url: 'https://www.twitch.tv/acyjannik' },
      { platform: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@acyjannik' },
      { platform: 'whatsapp', label: 'WhatsApp', url: 'https://www.whatsapp.com/channel/0029VazFA8UIXnlmgPliHQ10' }
    ];
    const socials = Array.isArray(payload.socials) && payload.socials.length ? payload.socials : fallbackSocials;
    const socialGrid = document.getElementById('social-grid');
    if (socialGrid && socials.length) {
      const icons = {
        twitch: 'TW', tiktok: 'TK', whatsapp: 'WA',
        discord: 'DC', instagram: 'IG', youtube: 'YT'
      };
      socialGrid.innerHTML = socials.map((item) => {
        const icon = icons[item.platform] || String(item.label || '').slice(0, 2).toUpperCase();
        const sub = item.platform === 'tiktok' ? '@acyjannik' : item.label;
        return `<a class="social-card reveal" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">
          <span class="social-icon">${escapeHtml(icon)}</span>
          <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(sub)}</small></div><b>↗</b>
        </a>`;
      }).join('');
    }

    const fallbackGames = [
      { name: 'Fortnite', description: 'Main Game · Ranked · Community', image_url: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fortnite_at_E3_2018_(42719678112).jpg', featured: true },
      { name: 'GTA V', description: 'Open World · Aktuell · Fun', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg', featured: false },
      { name: 'Meccha Chameleon', description: 'Variety · Hide & Seek · Community', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/4704690/header.jpg', featured: false },
      { name: 'Thick As Thieves', description: 'Stealth · Heist · Community', image_url: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg', featured: false }
    ];
    const canonicalCovers = {
      'Fortnite': 'https://cdn.startselect.com/production/blog/preview-images/new-fortnite-season.jpg',
      'GTA V': 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg',
      'Meccha Chameleon': 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/4704690/header.jpg',
      'Thick As Thieves': 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341000/header.jpg'
    };
    const games = (Array.isArray(payload.games) && payload.games.length ? payload.games : fallbackGames)
      .map(game => ({ ...game, image_url: canonicalCovers[game.name] || game.image_url }));
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
