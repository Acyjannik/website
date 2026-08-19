(() => {
  'use strict';
  // V19 RC compatibility shim. The real mobile behavior now lives in
  // v19-mobile-ux.js so legacy RC logic cannot fight the final layout.
  const load = () => {
    if (document.getElementById('acy-v19-mobile-ux-script')) return;
    const s = document.createElement('script');
    s.id = 'acy-v19-mobile-ux-script';
    s.src = '/v19-mobile-ux.js?v=19002';
    s.defer = true;
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
