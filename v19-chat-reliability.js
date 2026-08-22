(() => {
  'use strict';

  const BOOT_KEY = '__acyV19ChatReliabilityBooted';
  if (window[BOOT_KEY]) return;
  window[BOOT_KEY] = true;

  const $ = (id) => document.getElementById(id);
  let fallbackTimer = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let reconnectInFlight = false;

  function chatStatus(text, type = '') {
    const el = $('club-chat-status');
    if (!el) return;
    el.textContent = text;
    el.className = `club-chat-status ${type}`.trim();
  }

  function currentStatusText() {
    return $('club-chat-status')?.textContent?.trim() || '';
  }

  function hasConnectionError() {
    const text = currentStatusText();
    return /Live-Verbindung|Verbindung konnte nicht|wiederhergestellt|Timeout|Fehler/i.test(text);
  }

  function ensureChatStatusUI() {
    const chat = $('club-chat');
    if (!chat || chat.querySelector('.acy-chat-live-state')) return;
    const head = chat.querySelector('.member-card-head') || chat.querySelector('.member-fold-summary') || chat.firstElementChild;
    if (!head) return;
    const chip = document.createElement('span');
    chip.className = 'acy-chat-live-state is-connecting';
    chip.setAttribute('aria-live', 'polite');
    chip.innerHTML = '<span class="acy-chat-live-dot" aria-hidden="true"></span><span class="acy-chat-live-label">Verbindung wird geprüft…</span>';
    head.appendChild(chip);
  }

  function setLiveState(kind, label) {
    const chip = $('club-chat')?.querySelector('.acy-chat-live-state');
    if (!chip) return;
    chip.className = `acy-chat-live-state ${kind}`;
    const labelEl = chip.querySelector('.acy-chat-live-label');
    if (labelEl) labelEl.textContent = label;
  }

  function stopFallback() {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  async function fallbackRefresh() {
    if (reconnectInFlight || typeof window.loadClubChat !== 'function') return;
    try {
      await window.loadClubChat();
      if (!hasConnectionError()) {
        reconnectAttempts = 0;
        stopFallback();
        setLiveState('is-live', 'Live verbunden');
        chatStatus('');
      }
    } catch (error) {
      console.warn('[V19 Chat] fallback reload failed:', error);
    }
  }

  function startFallback() {
    if (fallbackTimer) return;
    fallbackRefresh();
    fallbackTimer = setInterval(() => {
      if (!hasConnectionError()) {
        stopFallback();
        return;
      }
      fallbackRefresh();
    }, 8000);
  }

  function scheduleReconnect() {
    if (reconnectTimer || reconnectInFlight || typeof window.loadClubChat !== 'function') return;
    reconnectAttempts += 1;
    const delay = Math.min(30000, 1200 * Math.pow(1.7, Math.min(reconnectAttempts - 1, 8)));
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      reconnectInFlight = true;
      try {
        await window.loadClubChat();
        if (!hasConnectionError()) {
          reconnectAttempts = 0;
          stopFallback();
          setLiveState('is-live', 'Live verbunden');
          chatStatus('');
        } else {
          setLiveState('is-offline', 'Live getrennt · Wiederherstellung…');
          startFallback();
          scheduleReconnect();
        }
      } catch (error) {
        console.warn('[V19 Chat] reconnect failed:', error);
        startFallback();
        scheduleReconnect();
      } finally {
        reconnectInFlight = false;
      }
    }, delay);
  }

  function inspectConnection() {
    ensureChatStatusUI();
    if (hasConnectionError()) {
      setLiveState('is-offline', 'Live getrennt · Wiederherstellung…');
      startFallback();
      scheduleReconnect();
      return;
    }
    setLiveState('is-live', 'Live verbunden');
    if (currentStatusText() === '') stopFallback();
  }

  function installCSS() {
    if (document.getElementById('acy-v19-chat-reliability-css')) return;
    const style = document.createElement('style');
    style.id = 'acy-v19-chat-reliability-css';
    style.textContent = `
      .acy-chat-live-state{display:inline-flex;align-items:center;gap:7px;margin-left:auto;padding:7px 11px;border:1px solid rgba(168,112,255,.28);border-radius:999px;background:rgba(35,22,55,.62);font-size:.78rem;color:#cdb1ff;white-space:nowrap}
      .acy-chat-live-dot{width:8px;height:8px;border-radius:50%;background:#a86cff;box-shadow:0 0 10px rgba(168,108,255,.65)}
      .acy-chat-live-state.is-live{border-color:rgba(79,220,125,.32);color:#aef3c5}.acy-chat-live-state.is-live .acy-chat-live-dot{background:#4fdc7d;box-shadow:0 0 10px rgba(79,220,125,.65)}
      .acy-chat-live-state.is-offline{border-color:rgba(255,116,116,.3);color:#ffb0b0}.acy-chat-live-state.is-offline .acy-chat-live-dot{background:#ff7474;box-shadow:0 0 10px rgba(255,116,116,.55)}
      .acy-chat-live-state.is-connecting .acy-chat-live-dot{animation:acyChatPulse 1.1s ease-in-out infinite}
      @keyframes acyChatPulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
      @media(max-width:700px){.acy-chat-live-state{font-size:.7rem;padding:6px 9px}.acy-chat-live-label{max-width:170px;overflow:hidden;text-overflow:ellipsis}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    ensureChatStatusUI();
    installCSS();

    const statusEl = $('club-chat-status');
    if (statusEl) {
      const observer = new MutationObserver(inspectConnection);
      observer.observe(statusEl, { childList: true, characterData: true, subtree: true, attributes: true });
    }

    let ticks = 0;
    const timer = setInterval(() => {
      if (!$('club-chat')) return;
      ensureChatStatusUI();
      installCSS();
      inspectConnection();
      ticks += 1;
      if (ticks > 5 && !hasConnectionError()) clearInterval(timer);
    }, 2500);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (hasConnectionError()) {
        startFallback();
        scheduleReconnect();
      } else {
        inspectConnection();
      }
    });

    window.addEventListener('online', () => {
      reconnectAttempts = 0;
      startFallback();
      scheduleReconnect();
    });

    window.addEventListener('offline', () => {
      setLiveState('is-offline', 'Offline · Nachrichten bleiben verfügbar');
      chatStatus('Keine Internetverbindung. Nachrichten bleiben verfügbar.', 'warning');
      startFallback();
    });

    setTimeout(inspectConnection, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
