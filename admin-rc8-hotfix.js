/* ACY CLUB Admin V19 RC8 — mobile content and notification UX fixes. */
(() => {
  'use strict';

  function injectStyles() {
    if (document.getElementById('acy-admin-rc8-style')) return;
    const style = document.createElement('style');
    style.id = 'acy-admin-rc8-style';
    style.textContent = `
      #news-admin-list .content-admin-row{
        display:grid!important;
        grid-template-columns:minmax(150px,1fr) minmax(260px,2.2fr) auto minmax(180px,auto)!important;
        gap:12px!important;
        align-items:start!important;
        min-width:0!important;
      }
      #news-admin-list .content-admin-row>div:first-child{
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        gap:5px!important;
      }
      #news-admin-list .content-inline-title,
      #news-admin-list .content-inline-body{
        width:100%!important;
        min-width:0!important;
        box-sizing:border-box!important;
      }
      #news-admin-list .content-inline-body{
        min-height:132px!important;
        resize:vertical!important;
        line-height:1.45!important;
        white-space:pre-wrap!important;
        overflow:auto!important;
      }
      #news-admin-list .content-inline-enabled{
        align-self:start!important;
        margin-top:8px!important;
      }
      #news-admin-list .admin-row-actions{
        display:flex!important;
        flex-wrap:wrap!important;
        gap:7px!important;
        align-items:center!important;
      }
      #news-admin-list .content-save-news,
      #news-admin-list .content-delete-news{
        white-space:nowrap!important;
      }
      @media(max-width:900px){
        #news-admin-list .content-admin-row{
          grid-template-columns:1fr!important;
          gap:9px!important;
        }
        #news-admin-list .admin-row-actions{
          width:100%!important;
        }
        #news-admin-list .content-inline-enabled{
          margin-top:0!important;
        }
      }
      #push-test-message.error{color:#fca5a5!important}
      #push-test-message.success{color:#86efac!important}
    `;
    document.head.appendChild(style);
  }

  function upgradeNewsFields() {
    const list = document.getElementById('news-admin-list');
    if (!list) return;

    list.querySelectorAll('input.content-inline-body').forEach(input => {
      const textarea = document.createElement('textarea');
      textarea.className = input.className;
      textarea.rows = 7;
      textarea.value = input.value || '';
      textarea.setAttribute('aria-label', 'News-Text');
      textarea.dataset.rc8BodyField = '1';
      input.replaceWith(textarea);
    });
  }

  function improvePushStatus() {
    const status = document.getElementById('push-test-message');
    if (!status || status.dataset.rc8Bound === '1') return;
    status.dataset.rc8Bound = '1';
  }

  function installNewsDeleteFallback() {
    const list = document.getElementById('news-admin-list');
    if (!list || list.dataset.rc8DeleteBound === '1') return;
    list.dataset.rc8DeleteBound = '1';

    list.addEventListener('click', async (event) => {
      const button = event.target.closest('.content-delete-news');
      if (!button) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const row = button.closest('.content-admin-row');
      const id = row?.dataset.id;
      const title = row?.querySelector('.content-inline-title')?.value?.trim() || row?.querySelector('strong')?.textContent || 'diese News';
      if (!id || !window.confirm(`„${title}“ wirklich löschen?`)) return;

      button.disabled = true;
      const previous = button.textContent;
      button.textContent = 'Löschen…';

      try {
        const session = window.supabase?.auth?.getSession
          ? await window.supabase.auth.getSession()
          : null;
        const token = session?.data?.session?.access_token || '';
        if (!token) throw new Error('Admin-Sitzung abgelaufen. Bitte neu anmelden.');

        const response = await fetch(`/api/admin-news?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

        row.remove();
        const message = document.getElementById('news-message');
        if (message) {
          message.textContent = 'News gelöscht.';
          message.classList.add('success');
          message.classList.remove('error');
        }
        const stamp = document.getElementById('last-saved-message');
        if (stamp) stamp.textContent = `Gespeichert · ${new Date().toLocaleString('de-DE')}`;
      } catch (error) {
        button.disabled = false;
        button.textContent = previous;
        const message = document.getElementById('news-message');
        if (message) {
          message.textContent = `News konnte nicht gelöscht werden: ${error?.message || 'Unbekannter Fehler'}`;
          message.classList.add('error');
          message.classList.remove('success');
        }
      }
    }, true);
  }

  function init() {
    injectStyles();
    upgradeNewsFields();
    improvePushStatus();
    installNewsDeleteFallback();

    const observer = new MutationObserver(() => {
      upgradeNewsFields();
      improvePushStatus();
      installNewsDeleteFallback();
    });
    const news = document.getElementById('news-admin-list');
    const dashboard = document.getElementById('dashboard');
    if (news) observer.observe(news, { childList:true, subtree:true });
    if (dashboard) observer.observe(dashboard, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
