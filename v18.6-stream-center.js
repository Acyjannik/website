(() => {
  'use strict';

  // V18.6.6 — Stream Center. Uses existing Twitch/live data only.
  const VERSION = 'V18.6.6';

  const $ = (id) => document.getElementById(id);

  function getValue(id, fallback = '–') {
    return $(id)?.textContent?.trim() || fallback;
  }

  function isLive() {
    const text = getValue('member-live-text', '');
    return /LIVE/i.test(text) || $('member-live-pill')?.classList.contains('is-live');
  }

  function refreshView() {
    const live = isLive();
    const state = $('acy-stream-center-state');
    const dot = $('acy-stream-center-dot');
    const game = $('acy-stream-center-game');
    const viewers = $('acy-stream-center-viewers');
    const title = $('acy-stream-center-title');
    if (!state || !game || !viewers || !title) return;

    state.textContent = live ? 'LIVE' : 'OFFLINE';
    state.dataset.live = live ? 'true' : 'false';
    if (dot) dot.dataset.live = live ? 'true' : 'false';
    game.textContent = getValue('member-twitch-game', 'Kein aktuelles Game');
    viewers.textContent = live ? `${getValue('member-twitch-viewers', '0')} Zuschauer` : 'Beim nächsten Stream wieder dabei';
    title.textContent = getValue('member-live-text', live ? 'ACYJANNIK ist live' : 'Aktuell offline');
  }

  function build() {
    if (location.pathname.endsWith('pet.html')) return;
    if ($('acy-stream-center-v186')) return;
    const home = $('acy-v18-home');
    if (!home) return;

    const section = document.createElement('section');
    section.id = 'acy-stream-center-v186';
    section.className = 'member-card member-span-2';
    section.innerHTML = `
      <div class="acy-stream-center-head">
        <div>
          <span class="eyebrow">STREAM CENTER</span>
          <h2>ACYJANNIK Live</h2>
          <p id="acy-stream-center-title">Live-Status wird geprüft…</p>
        </div>
        <span class="acy-stream-center-status"><i id="acy-stream-center-dot"></i><strong id="acy-stream-center-state">CHECKING</strong></span>
      </div>
      <div class="acy-stream-center-grid">
        <div><span>AKTUELLES GAME</span><strong id="acy-stream-center-game">–</strong></div>
        <div><span>ZUSCHAUER</span><strong id="acy-stream-center-viewers">–</strong></div>
        <div class="acy-stream-center-actions">
          <a class="button button-primary" href="https://www.twitch.tv/acyjannik" target="_blank" rel="noreferrer">Auf Twitch ansehen ↗</a>
          <a class="button button-secondary" href="#twitch-section">Stream-Details</a>
        </div>
      </div>`;

    home.insertAdjacentElement('afterend', section);
    refreshView();

    const observer = new MutationObserver(refreshView);
    ['member-live-text', 'member-twitch-game', 'member-twitch-viewers', 'member-live-pill'].forEach(id => {
      const el = $(id);
      if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    });

    window.setTimeout(() => {
      if (typeof window.loadTwitch === 'function') window.loadTwitch().catch(() => {});
    }, 700);
    window.setInterval(() => {
      if (typeof window.loadTwitch === 'function') window.loadTwitch().catch(() => {});
    }, 60000);
  }

  function styles() {
    if ($('acy-v186-stream-center-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-v186-stream-center-style';
    style.textContent = `
      #acy-stream-center-v186{margin-top:14px;overflow:hidden;background:linear-gradient(145deg,rgba(20,17,29,.96),rgba(12,12,18,.98))}
      .acy-stream-center-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px;border-bottom:1px solid rgba(255,255,255,.07)}
      .acy-stream-center-head h2{margin:5px 0 4px;font-size:25px;line-height:1.1}
      .acy-stream-center-head p{margin:0;color:#a1a1aa;line-height:1.45}
      .acy-stream-center-status{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(180,108,255,.25);border-radius:999px;background:rgba(168,85,247,.08);font-size:12px;white-space:nowrap}
      .acy-stream-center-status i{width:8px;height:8px;border-radius:50%;background:#a1a1aa;display:block}
      .acy-stream-center-status i[data-live="true"]{background:#a855f7;box-shadow:0 0 14px rgba(168,85,247,.7)}
      .acy-stream-center-status strong{font-size:11px;letter-spacing:.08em}
      .acy-stream-center-grid{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:10px;padding:16px 22px 22px}
      .acy-stream-center-grid>div{min-width:0;padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}
      .acy-stream-center-grid span{display:block;color:#a1a1aa;font-size:10px;letter-spacing:.12em}
      .acy-stream-center-grid strong{display:block;margin-top:5px;font-size:17px;line-height:1.25;overflow-wrap:anywhere}
      .acy-stream-center-actions{display:flex!important;align-items:center;gap:8px}
      .acy-stream-center-actions .button{flex:1;min-width:0}
      @media(max-width:700px){
        #acy-stream-center-v186{border-radius:22px}
        .acy-stream-center-head{padding:16px;align-items:flex-start}
        .acy-stream-center-head h2{font-size:22px}
        .acy-stream-center-head p{font-size:13px}
        .acy-stream-center-grid{grid-template-columns:1fr;gap:8px;padding:12px 16px 16px}
        .acy-stream-center-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:8px}
        .acy-stream-center-actions .button{width:100%}
      }
      @media(max-width:380px){
        .acy-stream-center-actions{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function init(){ styles(); build(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
