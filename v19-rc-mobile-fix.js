(() => {
  'use strict';
  // V19 RC compatibility shim. Load the final mobile UX and the RC4 cleanup
  // after it so legacy and dynamically injected entries cannot duplicate UI.
  const load = () => {
    if (!document.getElementById('acy-v19-mobile-ux-script')) {
      const s = document.createElement('script');
      s.id = 'acy-v19-mobile-ux-script';
      s.src = '/v19-mobile-ux.js?v=19004';
      s.defer = true;
      document.head.appendChild(s);
    }
    if (!document.getElementById('acy-v19-rc4-hotfix-script')) {
      const h = document.createElement('script');
      h.id = 'acy-v19-rc4-hotfix-script';
      h.src = '/v19-rc4-hotfix.js?v=19004';
      h.defer = true;
      document.head.appendChild(h);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
