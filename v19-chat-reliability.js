(() => {
  'use strict';

  const BOOT_KEY = '__acyV19ChatReliabilityBooted';
  if (window[BOOT_KEY]) return;
  window[BOOT_KEY] = true;

  const $ = (id) => document.getElementById(id);
  let fallbackTimer = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let lastKnownMessageId = null;
  let lastWasNearBottom = true;

  function chatStatus(text, type = '') {
    const el = $('club-chat-status');
    if (!el) return;
    el.textContent = text;
    el.className = `club-chat-status ${type}`.trim();
  }

  function getChannelState() {
    try {
      return window.clubChatChannel?.state || 'closed';
    } catch {
      return 'closed';
    }
  }

  function isConnected() {
    const state = getChannelState();
    return state === 'joined' || state === 'joining';
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

  function updateScrollState() {
    const list = $('club-chat-messages');
    if (!list) return;
    lastWasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  }

  function mergeMessages(next) {
    if (!Array.isArray(next)) return false;
    const current = Array.isArray(window.clubChatMessages) ? window.clubChatMessages : [];
    const byId = new Map(current.map(item => [String(item.id), item]));
    next.forEach(item => byId.set(String(item.id), item));
    const merged = [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const changed = merged.length !== current.length || merged.some((m, i) => String(m.id) !== String(current[i]?.id));
    window.clubChatMessages = merged.slice(-100);
    return changed;
  }

  async function fallbackRefresh() {
    if (!window.supabaseClient || !window.currentUser || typeof window.fetchChatMessages !== 'function') return;
    try {
      const messages = await window.fetchChatMessages(100);
      const changed = mergeMessages(messages);
      if (changed && typeof window.renderChat === 'function') {
        window.renderChat();
        const list = $('club-chat-messages');
        if (list && lastWasNearBottom) list.scrollTop = list.scrollHeight;
      }
      if (messages?.length) lastKnownMessageId = messages[messages.length - 1]?.id ?? lastKnownMessageId;
    } catch (error) {
      console.warn('[V19 Chat] fallback refresh failed:', error);
    }
  }

  function stopFallback() {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function startFallback() {
    if (fallbackTimer) return;
    fallbackRefresh();
    fallbackTimer = setInterval(() => {
      if (isConnected()) {
        stopFallback();
        return;
      }
      fallbackRefresh();
    }, 7000);
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts += 1;
    const delay = Math.min(30000, 1200 * Math.pow(1.7, Math.min(reconnectAttempts - 1, 8)));
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try {
        if (typeof window.loadClubChat === 'function') await window.loadClubChat();
        if (isConnected()) {
          reconnectAttempts = 0;
          stopFallback();
          setLiveState('is-live', 'Live verbunden');
          chatStatus('Live verbunden', 'success');
          setTimeout(() => chatStatus(''), 2200);
        } else {
          startFallback();
          scheduleReconnect();
        }
      } catch (error) {
        console.warn('[V19 Chat] reconnect failed:', error);
        startFallback();
        scheduleReconnect();
      }
    }, delay);
  }

  function watchChannel() {
    const state = getChannelState();
    if (state === 'joined') {
      reconnectAttempts = 0;
      stopFallback();
      setLiveState('is-live', 'Live verbunden');
      return;
    }
    if (state === 'joining') {
      setLiveState('is-connecting', 'Verbindung wird hergestellt…');
      return;
    }
    setLiveState('is-offline', 'Live getrennt · Wiederherstellung…');
    chatStatus('Live-Verbindung wird wiederhergestellt…', 'warning');
    startFallback();
    scheduleReconnect();
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
    const list = $('club-chat-messages');
    list?.addEventListener('scroll', updateScrollState, { passive: true });

    // The existing chat implementation owns message rendering and the Realtime
    // channel. This layer only adds watchdog/reconnect/fallback behavior, so it
    // does not duplicate subscriptions or submit handlers.
    let ticks = 0;
    const timer = setInterval(() => {
      if (!$('club-chat')) return;
      ensureChatStatusUI();
      installCSS();
      watchChannel();
      ticks += 1;
      if (ticks > 3 && isConnected()) clearInterval(timer);
    }, 2500);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (!isConnected()) {
        startFallback();
        scheduleReconnect();
      } else {
        fallbackRefresh();
      }
    });

    window.addEventListener('online', () => {
      reconnectAttempts = 0;
      startFallback();
      scheduleReconnect();
    });

    window.addEventListener('offline', () => {
      setLiveState('is-offline', 'Offline · Nachrichten bleiben verfügbar');
      chatStatus('Keine Internetverbindung. Nachrichten bleiben zwischengespeichert.', 'warning');
      startFallback();
    });

    // Give the original loader a moment to create its Realtime channel.
    setTimeout(watchChannel, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
