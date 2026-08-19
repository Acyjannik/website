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

  function init() {
    injectStyles();
    upgradeNewsFields();
    improvePushStatus();

    const observer = new MutationObserver(() => {
      upgradeNewsFields();
      improvePushStatus();
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
