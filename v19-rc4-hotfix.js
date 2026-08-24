(() => {
  'use strict';

  const isClub = /club-profile\.html$/i.test(location.pathname) || /club-profile/i.test(location.pathname);
  if (!isClub) return;

  const normalize = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const STAFF_URL = '/staff-center.html?acy=20.0.1';

  function cleanStaffEntries() {
    const grids = document.querySelectorAll('.mobile-more-grid-v181, .mobile-more-grid, [class*="more-grid"]');
    grids.forEach(grid => {
      const matches = [...grid.querySelectorAll('a,button')].filter(el => {
        const text = normalize(el.textContent);
        const href = normalize(el.getAttribute('href'));
        return text.includes('staff center') || href.includes('staff.html') || href.includes('staff-center.html');
      });
      if (!matches.length) return;
      matches.slice(1).forEach(el => el.remove());
      const first = matches[0];
      if (first) {
        first.setAttribute('href', STAFF_URL);
        first.dataset.v19Rc4StaffEntry = '1';
        const strong = first.querySelector('strong');
        const small = first.querySelector('small');
        if (strong) strong.textContent = 'Staff Center';
        if (small) small.textContent = 'Admin · Mod · Streamer';
      }
    });
  }

  function removeHeaderStaff() {
    document.querySelectorAll('.member-header-actions a,.member-header-actions button').forEach(el => {
      const text = normalize(el.textContent);
      const href = normalize(el.getAttribute('href'));
      if (text.includes('admin / mod') || text === 'admin/mod' || href.includes('admin.html') || href.includes('mod.html')) el.remove();
    });
  }

  function run() {
    removeHeaderStaff();
    cleanStaffEntries();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  [300, 900, 1800, 3500].forEach(ms => setTimeout(run, ms));
  new MutationObserver(() => run()).observe(document.body, { childList: true, subtree: true });
})();