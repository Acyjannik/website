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
