/* ACY Pet refresh compatibility fix.
 * Loaded after club-profile.js so successful Pet Life actions always re-read
 * the canonical hub state and refresh quest progress in the visible UI.
 *
 * V19 RELEASE LOCK: one visible version marker, without a DOM observer loop.
 */
(() => {
  const VERSION = 'V19.0.0 · RC11';

  const lockVersionBadge = () => {
    const selectors = [
      '#acy-build-marker', '#acy-v19-rc6-badge', '#acy-dev-version-badge',
      '#acy-v189-version-badge', '#acy-v19-rc-badge', '#acy-v19-rc-badge-v2',
      '#acy-v19-rc-safe-badge', '#acy-v19-rc3-badge', '#acy-v19-rc5-badge',
      '#acy-canonical-version-badge', '#acy-v19-canonical-version',
      '.streamer-version', '[data-acy-version-badge]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());

    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^V(?:18|19)\.[0-9.]+\s*[·•]\s*(?:DEV|RC\d+|RELEASE)$/i.test(text)) el.remove();
    });

    let badge = document.getElementById('acy-v19-release-version');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'acy-v19-release-version';
      badge.setAttribute('aria-hidden', 'true');
      document.body.appendChild(badge);
    }
    badge.textContent = VERSION;
    badge.style.cssText = [
      'position:fixed','top:max(8px,env(safe-area-inset-top))','right:10px','z-index:13050',
      'padding:7px 11px','border:1px solid rgba(180,108,255,.42)','border-radius:999px',
      'background:rgba(10,9,15,.95)','backdrop-filter:blur(14px)','color:#f7f3ff',
      'font:800 11px/1.1 system-ui,sans-serif','letter-spacing:.04em','pointer-events:none',
      'white-space:nowrap','box-shadow:0 8px 30px rgba(0,0,0,.28)'
    ].join(';');
  };

  const installStaffCenterNav = () => {
    const clubPath = /\/club-profile\.html$/i.test(location.pathname);
    if (!clubPath) return;

    const nav = document.querySelector('.member-section-nav');
    if (!nav) return;

    const legacy = [...nav.querySelectorAll('a,button')].find(el => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const href = (el.getAttribute('href') || '').toLowerCase();
      return /admin\s*\/\s*mod|admin\s*center|mod\s*center/i.test(text)
        || href.endsWith('/admin.html')
        || href.endsWith('/mod.html');
    });

    if (legacy) {
      legacy.textContent = '🛠️ Staff Center';
      legacy.setAttribute('href', '/staff-center.html');
      legacy.hidden = false;
      legacy.removeAttribute('id');
      legacy.classList.add('staff-center-nav-link');
      legacy.dataset.acyStaffCenter = '1';
      return;
    }

    if (!nav.querySelector('[data-acy-staff-center]')) {
      const link = document.createElement('a');
      link.href = '/staff-center.html';
      link.textContent = '🛠️ Staff Center';
      link.className = 'staff-center-nav-link';
      link.dataset.acyStaffCenter = '1';
      nav.appendChild(link);
    }
  };

  const syncFeedAvailability = async () => {
    const buttons = [...document.querySelectorAll('.pet-action-btn[data-pet-action="feed"]')];
    const client = window.__acySupabaseClient;
    if (!buttons.length || !client?.rpc) return;
    try {
      const { data, error } = await client.rpc('get_club_pet');
      if (error || !data) return;
      const full = Number(data.hunger) >= 100;
      buttons.forEach(button => {
        button.disabled = full;
        button.setAttribute('aria-disabled', String(full));
        button.title = full ? 'Dein Tier ist bereits satt.' : 'Futter auswählen';
        const label = button.querySelector('strong') || button;
        if (!button.dataset.acyOriginalFeedLabel) button.dataset.acyOriginalFeedLabel = label.textContent || '🍖 Füttern';
        label.textContent = full ? '🍖 Satt' : button.dataset.acyOriginalFeedLabel;
      });
      if (full) {
        const status = document.getElementById('pet-life-status') || document.getElementById('pet-status');
        if (status) {
          status.textContent = '🐾 Dein Tier ist bereits satt. Es braucht gerade kein Futter.';
          status.className = 'club-auth-status';
        }
      }
    } catch {}
  };

  const loadPetInteractionFix = () => {
    if (!/\/(pet\.html|club-profile\.html)$/i.test(location.pathname)) return;
    if (document.getElementById('acy-v19-pet-interaction-script')) return;
    const script = document.createElement('script');
    script.id = 'acy-v19-pet-interaction-script';
    script.src = '/v19-pet-interaction-fix.js?v=19122';
    script.async = false;
    document.head.appendChild(script);
  };

  const installWheelFix = () => {
    if (!/\/club-profile\.html$/i.test(location.pathname)) return;
    if (window.__acyWheelFixInstalled) return;

    const button = document.getElementById('club-wheel-spin');
    const wheel = document.getElementById('club-wheel');
    const message = document.getElementById('wheel-message');
    const client = window.__acySupabaseClient;
    if (!button || !wheel || !message || !client?.rpc) return;

    window.__acyWheelFixInstalled = true;

    // Replace the old listener by replacing the button node. The old handler
    // used a CSS animation with a fixed endpoint and then waited on several
    // unrelated refresh requests. That is why later spins could visibly jump.
    const freshButton = button.cloneNode(true);
    button.replaceWith(freshButton);

    wheel.classList.remove('is-spinning');
    wheel.style.setProperty('animation', 'none', 'important');
    wheel.style.setProperty('transition', 'none', 'important');
    wheel.__acyRotation = Number(wheel.dataset.acyRotation || 0) || 0;

    const getSegment = key => {
      const segments = Array.isArray(window.WHEEL_SEGMENTS) ? window.WHEEL_SEGMENTS : [
        {key:'xp_25',angle:0},{key:'xp_50',angle:30},{key:'xp_100',angle:60},
        {key:'xp_250',angle:90},{key:'xp_500',angle:120},{key:'xp_1000',angle:150},
        {key:'pet_care',angle:180},{key:'pet_perk',angle:210},
        {key:'extra_spin',angle:240},{key:'extra_spin_2',angle:270},
        {key:'twitch_reward',angle:300},{key:'xp_jackpot',angle:330}
      ];
      return segments.find(s => s.key === key) || segments[0];
    };

    const animateWheel = async rewardKey => {
      const seg = getSegment(rewardKey);
      const current = Number(wheel.__acyRotation || 0);
      const targetOffset = (360 - Number(seg.angle || 0)) % 360;
      const delta = 1800 + targetOffset;
      const next = current + delta;

      wheel.getAnimations().forEach(animation => animation.cancel());
      wheel.style.setProperty('animation', 'none', 'important');
      wheel.style.setProperty('transition', 'none', 'important');
      wheel.style.transform = `rotate(${current}deg)`;
      wheel.offsetWidth;

      if (typeof wheel.animate !== 'function') {
        wheel.style.transform = `rotate(${next}deg)`;
        wheel.__acyRotation = next;
        wheel.dataset.acyRotation = String(next);
        return;
      }

      const animation = wheel.animate(
        [
          { transform: `rotate(${current}deg)` },
          { transform: `rotate(${next}deg)` }
        ],
        {
          duration: 2400,
          easing: 'cubic-bezier(.12,.72,.16,1)',
          fill: 'forwards'
        }
      );

      try { await animation.finished; } catch {}
      animation.cancel();
      wheel.style.transform = `rotate(${next}deg)`;
      wheel.__acyRotation = next;
      wheel.dataset.acyRotation = String(next);
    };

    const spin = async () => {
      if (freshButton.disabled || freshButton.dataset.acySpinning === '1') return;
      freshButton.dataset.acySpinning = '1';
      freshButton.disabled = true;
      message.textContent = 'Das Rad dreht…';
      message.className = 'club-auth-status';

      try {
        const { data, error } = await client.rpc('spin_club_wheel');
        if (error) throw error;

        if (data?.cooldown) {
          message.textContent = `Dein nächster Dreh ist um ${typeof window.formatWheelDate === 'function' ? window.formatWheelDate(data.next_free_at) : new Date(data.next_free_at).toLocaleString('de-DE')} verfügbar.`;
          message.className = 'club-auth-status error';
          if (typeof window.setWheelCooldown === 'function') window.setWheelCooldown(data.next_free_at, data.spin_tokens);
          return;
        }

        // Start the visual spin immediately after the RPC. The slow dashboard
        // refreshes run in the background and no longer hold up the result.
        const background = [
          typeof window.loadWheelHistory === 'function' ? window.loadWheelHistory() : Promise.resolve(),
          typeof window.loadMyRewards === 'function' ? window.loadMyRewards() : Promise.resolve(),
          data.reward_class === 'pet' && typeof window.loadPet === 'function' ? window.loadPet() : Promise.resolve(),
          typeof window.progressQuestsForAction === 'function' ? window.progressQuestsForAction('wheel_spin') : Promise.resolve()
        ];
        Promise.allSettled(background).catch(() => {});

        await animateWheel(data.reward_key);

        message.textContent = `🎉 ${data.reward_label}${data.test_mode ? ' · 🧪 Testmodus' : ''}${data.reward_class === 'spin' ? ' · Du kannst sofort noch einmal drehen.' : Number.isFinite(data.total_xp) ? ` · Jetzt ${Number(data.total_xp).toLocaleString('de-DE')} XP.` : ''}`;
        message.className = 'club-auth-status success';

        if (typeof window.triggerClubEffect === 'function') {
          window.triggerClubEffect(data.reward_class === 'xp' ? 'reward' : 'level', `🎉 ${data.reward_label}`);
        }
        if (Number.isFinite(data.total_xp)) {
          if (typeof window.renderProgress === 'function') window.renderProgress(data.total_xp);
          if (typeof window.setText === 'function') window.setText('member-xp', `${data.total_xp} XP`);
        }
        if (typeof window.setWheelCooldown === 'function') {
          window.setWheelCooldown(data.test_mode ? null : data.next_free_at, data.spin_tokens);
        }
      } catch (error) {
        console.error('Wheel animation fix error:', error);
        message.textContent = error?.message || 'Das Glücksrad konnte nicht gedreht werden.';
        message.className = 'club-auth-status error';
      } finally {
        freshButton.dataset.acySpinning = '0';
        if (typeof window.loadWheelState === 'function') {
          void window.loadWheelState();
        } else {
          freshButton.disabled = false;
        }
      }
    };

    freshButton.addEventListener('click', spin, { passive: false });
  };

  const install = () => {
    lockVersionBadge();
    installStaffCenterNav();
    loadPetInteractionFix();
    void syncFeedAvailability();
    installWheelFix();
    setTimeout(() => {
      lockVersionBadge();
      installStaffCenterNav();
      loadPetInteractionFix();
      void syncFeedAvailability();
      installWheelFix();
    }, 1200);

    if (typeof window.petLifeRpc === 'function' && !window.__acyPetLifeRpcRefreshPatched) {
      const originalPetLifeRpc = window.petLifeRpc;
      window.petLifeRpc = async function patchedPetLifeRpc(fn, args = {}, success = 'Erledigt. 🐾') {
        const result = await originalPetLifeRpc(fn, args, success);
        await Promise.allSettled([
          typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve(),
          typeof window.loadQuests === 'function' ? window.loadQuests() : Promise.resolve()
        ]);
        void syncFeedAvailability();
        return result;
      };
      window.__acyPetLifeRpcRefreshPatched = true;
    }

    if (typeof window.performPetAction === 'function' && !window.__acyPerformPetActionRefreshPatched) {
      const originalPerformPetAction = window.performPetAction;
      window.performPetAction = async function patchedPerformPetAction(action, button) {
        const result = await originalPerformPetAction(action, button);
        await Promise.allSettled([
          typeof window.loadPetLife === 'function' ? window.loadPetLife() : Promise.resolve(),
          typeof window.loadQuests === 'function' ? window.loadQuests() : Promise.resolve()
        ]);
        void syncFeedAvailability();
        return result;
      };
      window.__acyPerformPetActionRefreshPatched = true;
    }
  };

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    setTimeout(install, 0);
  }
})();
