/* ACY V19 Pet Social UX: stable buttons + clearer friendship progression. */
(() => {
  'use strict';

  const LEVELS = [
    { xp: 0, title: 'Besucher', icon: '🐾' },
    { xp: 25, title: 'Bekannt', icon: '👋' },
    { xp: 75, title: 'Freunde', icon: '💜' },
    { xp: 150, title: 'Gute Freunde', icon: '✨' },
    { xp: 300, title: 'Beste Freunde', icon: '👑' },
    { xp: 600, title: 'Pet-Buddys', icon: '🐾' },
    { xp: 1000, title: 'Seelenfreunde', icon: '💜' }
  ];

  const ACTIONS = {
    greet: { label: 'Begrüßen', emoji: '👋', xp: 3 },
    play: { label: 'Zusammen spielen', emoji: '🎾', xp: 8 },
    pet: { label: 'Streicheln', emoji: '💜', xp: 5 }
  };

  function levelForXp(xp) {
    let current = LEVELS[0];
    for (const level of LEVELS) if (xp >= level.xp) current = level;
    return current;
  }

  function ensureStyle() {
    if (document.getElementById('v19-pet-social-ux-style')) return;
    const style = document.createElement('style');
    style.id = 'v19-pet-social-ux-style';
    style.textContent = `
      #public-pet-actions .v19-pet-action{position:relative;transition:opacity .18s ease,transform .18s ease,border-color .18s ease,background .18s ease}
      #public-pet-actions .v19-pet-action[aria-busy="true"]{opacity:.72;cursor:wait;transform:none}
      #public-pet-actions .v19-pet-action[aria-busy="true"]::after{content:'…';display:inline-block;margin-left:6px;animation:v19PetPulse 1s infinite}
      #public-pet-actions .v19-pet-action.v19-success{border-color:rgba(180,120,255,.65);opacity:1}
      @keyframes v19PetPulse{0%,100%{opacity:.25}50%{opacity:1}}
    `;
    document.head.appendChild(style);
  }

  async function handleAction(button, buttons) {
    if (button.dataset.busy === '1') return;
    if (!window.supabase || typeof supabaseClient === 'undefined' || !supabaseClient) return;

    const action = button.dataset.petAction;
    const meta = ACTIONS[action];
    if (!meta) return;
    const targetId = new URLSearchParams(location.search).get('id');
    if (!targetId) return;

    const status = document.getElementById('public-pet-status');
    const original = button.innerHTML;
    button.dataset.busy = '1';
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.innerHTML = `${meta.emoji} ${meta.label} <small>läuft…</small>`;
    // Do not disable or rerender the other buttons. This was the source of the
    // visible flicker when the whole action row was refreshed.

    if (status) {
      status.textContent = `${meta.emoji} ${meta.label} wird ausgeführt…`;
      status.className = 'club-auth-status';
    }

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sitzung abgelaufen.');

      const response = await fetch('/api/club-pet-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: targetId, action })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Pet-Interaktion fehlgeschlagen.');

      const xp = Number(payload.target_pet?.social_xp || 0);
      const level = levelForXp(xp);
      const xpChip = document.getElementById('public-pet-social-xp');
      const levelChip = document.getElementById('public-pet-social-level');
      if (xpChip) xpChip.textContent = `${xp} Social XP`;
      if (levelChip) levelChip.textContent = `Level ${level.xp === 0 ? 1 : LEVELS.indexOf(level) + 1} · ${level.title}`;

      const count = Number(payload.interaction_count || 1);
      button.dataset.busy = '0';
      button.removeAttribute('aria-busy');
      button.classList.add('v19-success');
      button.innerHTML = `✓ ${meta.label} <small>+${payload.social_xp_awarded ?? meta.xp} XP</small>`;
      if (status) {
        status.textContent = `${meta.emoji} ${payload.target_pet?.name || 'Das Pet'} hat sich gefreut. ${level.icon} ${level.title} · ${count} Begegnungen.`;
        status.className = 'club-auth-status success';
      }

      window.setTimeout(() => {
        button.classList.remove('v19-success');
        button.innerHTML = original;
        button.disabled = false;
      }, 1300);
    } catch (error) {
      button.dataset.busy = '0';
      button.removeAttribute('aria-busy');
      button.disabled = false;
      button.innerHTML = original;
      if (status) {
        status.textContent = error?.message || 'Pet-Interaktion fehlgeschlagen.';
        status.className = 'club-auth-status error';
      }
    }
  }

  function bind() {
    const actions = document.getElementById('public-pet-actions');
    if (!actions || actions.dataset.v19Bound === '1') return;
    ensureStyle();
    actions.dataset.v19Bound = '1';
    const buttons = [...actions.querySelectorAll('[data-pet-action]')];
    buttons.forEach(button => {
      const action = button.dataset.petAction;
      const meta = ACTIONS[action];
      if (meta && !button.dataset.v19Labelled) {
        button.innerHTML = `${meta.emoji} ${meta.label} <small>+${meta.xp} XP</small>`;
        button.dataset.v19Labelled = '1';
      }
      button.onclick = () => void handleAction(button, buttons);
    });
  }

  function start() {
    bind();
    const observer = new MutationObserver(() => bind());
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(bind, 500);
    window.setTimeout(bind, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
