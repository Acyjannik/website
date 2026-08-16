
/* ACY V14 — lightweight global pointer / liquid-glass interaction.
   No animation loop unless the pointer actually moves. */
(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  let raf = 0;
  let x = window.innerWidth * .5;
  let y = window.innerHeight * .35;

  const paint = () => {
    raf = 0;
    root.style.setProperty('--acy-mx', `${x}px`);
    root.style.setProperty('--acy-my', `${y}px`);
  };

  window.addEventListener('pointermove', (event) => {
    x = event.clientX;
    y = event.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  }, {passive:true});

  document.querySelectorAll('button, a, .member-card, .club-content-item, .member-badge, .catalog-level, .hub-roadmap-step').forEach(el => {
    el.addEventListener('pointerenter', () => el.classList.add('acy-pointer-active'), {passive:true});
    el.addEventListener('pointerleave', () => el.classList.remove('acy-pointer-active'), {passive:true});
  });
})();
