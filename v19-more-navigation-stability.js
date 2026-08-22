(() => {
  'use strict';

  // The Club/Pet pages own the More sheet. This helper only guarantees one
  // Staff Center entry and never handles the More toggle itself.
  const SHEET_ID = 'mobile-more-sheet-v181';

  const ensureStaffEntry = () => {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    const grid = sheet.querySelector('.mobile-more-grid-v181, .acy-more-grid-v186');
    if (!grid) return;

    // Keep one canonical entry. Older Club markup may already contain a
    // Staff Center item without our data attribute, which was the source of
    // the second entry and the visible add/remove flicker.
    let canonical = grid.querySelector('[data-more-staff-entry]');
    if (!canonical) {
      canonical = [...grid.children].find((el) => /Staff\s*Center/i.test((el.textContent || '').trim()));
      if (canonical) canonical.setAttribute('data-more-staff-entry', '1');
    }

    if (!canonical) {
      canonical = document.createElement('a');
      canonical.href = '/staff-center.html';
      canonical.setAttribute('data-more-staff-entry', '1');
      canonical.innerHTML = '<span>🛡️</span><strong>Staff Center</strong><small>Interne Verwaltung</small>';
      grid.appendChild(canonical);
    }

    // Remove every additional Staff Center item, regardless of which legacy
    // script inserted it. Do not remove the canonical one.
    [...grid.children].forEach((el) => {
      if (el !== canonical && /Staff\s*Center/i.test((el.textContent || '').trim())) el.remove();
    });

    canonical.href = '/staff-center.html';
    canonical.setAttribute('data-more-staff-entry', '1');
  };

  const init = () => {
    ensureStaffEntry();

    // Legacy code can rebuild the sheet after load. Watch the DOM so a newly
    // inserted duplicate is removed, but never touch the open/close state.
    const observer = new MutationObserver(() => ensureStaffEntry());
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });

    window.setTimeout(ensureStaffEntry, 250);
    window.setTimeout(ensureStaffEntry, 750);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
