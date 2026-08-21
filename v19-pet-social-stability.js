/* ACY V19 Pet Social Stability: pointer-safe interactions, no row flicker. */
(() => {
  'use strict';

  const ACTIONS = {
    greet: { label: 'Begrüßen', emoji: '👋' },
    play: { label: 'Zusammen spielen', emoji: '🎾' },
    pet: { label: 'Streicheln', emoji: '💜' }
  };

  function bind() {
    const actions = document.getElementById('public-pet-actions');
    if (!actions || actions.dataset.v19Stable === '1') return;
    const buttons = [...actions.querySelectorAll('[data-pet-action]')];
    if (!buttons.length || typeof supabaseClient === 'undefined' || !supabaseClient) return;

    actions.dataset.v19Stable = '1';

    buttons.forEach(button => {
      const action = button.dataset.petAction;
      const meta = ACTIONS[action];
      if (!meta) return;

      let downX = 0, downY = 0, moved = false;
      const original = button.innerHTML;

      button.addEventListener('touchstart', event => {
        const t = event.touches?.[0];
        if (!t) return;
        downX = t.clientX; downY = t.clientY; moved = false;
      }, { passive: true });

      button.addEventListener('touchmove', event => {
        const t = event.touches?.[0];
        if (!t) return;
        if (Math.hypot(t.clientX - downX, t.clientY - downY) > 10) moved = true;
      }, { passive: true });

      button.addEventListener('touchend', () => {
        if (moved) {
          button.dataset.v19IgnoreClick = '1';
          window.setTimeout(() => { delete button.dataset.v19IgnoreClick; }, 350);
        }
      }, { passive: true });

      button.addEventListener('click', async event => {
        if (button.dataset.v19IgnoreClick === '1' || button.dataset.v19Busy === '1') {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        const targetId = new URLSearchParams(location.search).get('id');
        if (!targetId) return;

        button.dataset.v19Busy = '1';
        button.disabled = true;
        button.classList.add('v19-social-loading');
        button.innerHTML = `${meta.emoji} ${meta.label} <small>läuft…</small>`;

        const status = document.getElementById('public-pet-status');
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
          const xpChip = document.getElementById('public-pet-social-xp');
          if (xpChip) xpChip.textContent = `${xp} Social XP`;

          if (status) {
            status.textContent = `${meta.emoji} ${payload.target_pet?.name || 'Das Pet'} hat sich gefreut. +${payload.social_xp_awarded || 0} Social XP.`;
            status.className = 'club-auth-status success';
          }

          button.classList.remove('v19-social-loading');
          button.classList.add('v19-social-success');
          button.innerHTML = `✓ ${meta.label}`;
          window.setTimeout(() => {
            button.classList.remove('v19-social-success');
            button.innerHTML = original;
            button.disabled = false;
            button.dataset.v19Busy = '0';
          }, 900);
        } catch (error) {
          button.classList.remove('v19-social-loading');
          button.innerHTML = original;
          button.disabled = false;
          button.dataset.v19Busy = '0';
          if (status) {
            status.textContent = error?.message || 'Pet-Interaktion fehlgeschlagen.';
            status.className = 'club-auth-status error';
          }
        }
      }, true);
    });

    const style = document.createElement('style');
    style.textContent = `
      #public-pet-actions button.v19-social-loading{opacity:.72;cursor:wait;transform:none!important}
      #public-pet-actions button.v19-social-success{opacity:1;border-color:rgba(180,108,255,.7)}
    `;
    document.head.appendChild(style);
  }

  const start = () => { bind(); window.setTimeout(bind, 400); window.setTimeout(bind, 1200); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
