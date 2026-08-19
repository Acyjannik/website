
/* ACY V14.4 — lightweight global pointer / liquid-glass interaction. */
(() => {
  const loadAdminRc8 = () => {
    if (!document.body?.classList.contains('admin-page')) return;
    if (document.getElementById('acy-admin-rc8-script')) return;
    const script = document.createElement('script');
    script.id = 'acy-admin-rc8-script';
    script.src = '/admin-rc8-hotfix.js?v=19008';
    document.head.appendChild(script);
  };

  const bootAdmin = () => loadAdminRc8();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAdmin, { once:true });
  else bootAdmin();

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

  document.addEventListener('pointerover', event => {
    const el = event.target.closest?.('button, a, .member-card, .club-content-item, .member-badge, .catalog-level, .hub-roadmap-step');
    if (el) el.classList.add('acy-pointer-active');
  }, {passive:true});
  document.addEventListener('pointerout', event => {
    const el = event.target.closest?.('button, a, .member-card, .club-content-item, .member-badge, .catalog-level, .hub-roadmap-step');
    if (el && !el.contains(event.relatedTarget)) el.classList.remove('acy-pointer-active');
  }, {passive:true});

  const loadAudit = () => {
    if (document.getElementById('acy-v186-global-audit-script')) return;
    const script = document.createElement('script');
    script.id = 'acy-v186-global-audit-script';
    script.src = '/v18.6-global-audit.js?v=1864';
    script.defer = true;
    document.head.appendChild(script);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAudit, {once:true});
  else loadAudit();
})();