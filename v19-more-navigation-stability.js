(() => {
  'use strict';

  // IMPORTANT:
  // The Club and Pet pages already contain their canonical More sheet and
  // their legacy navigation handlers. This file must NOT create another sheet
  // or compete for the toggle click. Doing so caused the menu to flash and,
  // depending on timing, appear duplicated.
  const SHEET_ID = 'mobile-more-sheet-v181';

  const ensureStaffEntry = () => {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    // The canonical More grid used by Club/Pet.
    const grid = sheet.querySelector('.mobile-more-grid-v181, .acy-more-grid-v186');
    if (!grid || grid.querySelector('[data-more-staff-entry]')) return;

    const link = document.createElement('a');
    link.href = '/staff-center.html';
    link.setAttribute('data-more-staff-entry', '1');
    link.innerHTML = '<span>🛡️</span><strong>Staff Center</strong><small>Interne Verwaltung</small>';
    grid.appendChild(link);
  };

  const init = () => {
    ensureStaffEntry();

    // Some legacy code can finish rendering the sheet after DOMContentLoaded.
    // Observe only the sheet itself. No click interception, no new sheet,
    // no competing open/close state.
    const observer = new MutationObserver(() => ensureStaffEntry());
    const root = document.body;
    if (root) observer.observe(root, { childList: true, subtree: true });

    window.setTimeout(() => ensureStaffEntry(), 250);
    window.setTimeout(() => ensureStaffEntry(), 750);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
