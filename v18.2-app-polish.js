(() => {
  const loadStyles = () => {
    if (document.getElementById('acy-v182-app-polish')) return;
    const link = document.createElement('link');
    link.id = 'acy-v182-app-polish';
    link.rel = 'stylesheet';
    link.href = '/v18.2-app-polish.css?v=1821';
    document.head.appendChild(link);
  };

  const interactiveSelector = 'button, .button, [role="button"]';
  const ignoreSelector = '#mobile-dock-more-v18, .notification-filter, .quest-tab, .member-filter, summary';

  function initPressFeedback() {
    document.addEventListener('pointerdown', (event) => {
      const el = event.target.closest(interactiveSelector);
      if (!el || el.matches(ignoreSelector) || el.disabled) return;
      el.dataset.acyPressing = 'true';
    }, { capture: true, passive: true });

    const clear = (event) => {
      const el = event.target?.closest?.(interactiveSelector);
      if (el) delete el.dataset.acyPressing;
    };
    document.addEventListener('pointerup', clear, true);
    document.addEventListener('pointercancel', clear, true);
    document.addEventListener('pointerleave', clear, true);

    document.addEventListener('click', (event) => {
      const el = event.target.closest(interactiveSelector);
      if (!el || el.matches(ignoreSelector) || el.disabled || el.dataset.acyNoBusy !== undefined) return;
      delete el.dataset.acyPressing;
      if (el.type === 'submit' || el.matches('.button-primary,.button-secondary,.event-attend-btn,.club-chat-send')) {
        el.dataset.acyBusy = 'true';
        setTimeout(() => delete el.dataset.acyBusy, 700);
      }
    }, true);
  }

  function initAppDensity() {
    document.body.classList.add('acy-v182-app-mode');
  }

  function init() {
    loadStyles();
    initAppDensity();
    initPressFeedback();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
