(() => {
  'use strict';

  const VERSION = '20.2.0';
  const root = document.documentElement;
  if (root.dataset.acyRequestManager === VERSION) return;
  root.dataset.acyRequestManager = VERSION;

  const inFlight = new Map();
  const DEFAULT_TIMEOUT = 10000;

  const LOADERS = [
    'loadProfile', 'loadMemberHub', 'loadTwitch', 'loadTwitchAccountV11',
    'checkAchievements', 'loadProgressionCatalog', 'loadClubContent',
    'loadWheelState', 'loadWheelHistory', 'loadDailyStreak', 'loadQuests',
    'loadMyRewards', 'loadNotifications', 'loadNotificationPreferences',
    'loadDirectMessages', 'loadDmUnreadCount', 'loadClubChat',
    'loadSocialConnections', 'loadMemberDirectory', 'loadClubClips',
    'loadLeaderboard', 'loadMemberStats', 'loadDiscordLink', 'loadPet',
    'loadPetLife', 'loadCurrentGamePresence', 'loadSpotlight',
    'loadCommunityGameHighlights', 'loadCommunityPoll'
  ];

  function withTimeout(promise, ms, label) {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label} Timeout`)), ms);
      })
    ]).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

  function argsKey(args) {
    try { return JSON.stringify(args ?? []); }
    catch { return String(args?.length || 0); }
  }

  function wrap(name) {
    const current = window[name];
    if (typeof current !== 'function' || current.__acyRequestManaged) return;

    const managed = function managedRequest(...args) {
      const key = `${name}:${argsKey(args)}`;
      const active = inFlight.get(key);
      if (active) return active;

      const promise = withTimeout(
        Promise.resolve().then(() => current.apply(this, args)),
        DEFAULT_TIMEOUT,
        name
      ).finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      });
      inFlight.set(key, promise);
      return promise;
    };

    managed.__acyRequestManaged = true;
    managed.__acyOriginal = current;
    window[name] = managed;
  }

  function install() {
    LOADERS.forEach(wrap);

    window.ACY_REQUESTS = window.ACY_REQUESTS || {};
    window.ACY_REQUESTS.run = function run(key, fn, { timeout = DEFAULT_TIMEOUT } = {}) {
      if (typeof fn !== 'function') return Promise.resolve(null);
      const active = inFlight.get(key);
      if (active) return active;
      const promise = withTimeout(Promise.resolve().then(fn), timeout, key)
        .finally(() => {
          if (inFlight.get(key) === promise) inFlight.delete(key);
        });
      inFlight.set(key, promise);
      return promise;
    };
    window.ACY_REQUESTS.clear = function clear() { inFlight.clear(); };
  }

  function boot() {
    install();
    [250, 1000, 2000].forEach(delay => window.setTimeout(install, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
