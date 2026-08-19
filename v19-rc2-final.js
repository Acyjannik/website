(() => {
  const apply = () => {
    document.querySelectorAll('#acy-v19-rc-badge-v2').forEach(el => el.textContent = 'V19.0.0 · RC2');
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').trim();
      if (/^V19\.0\.0\s*·\s*RC1$/.test(text)) el.textContent = 'V19.0.0 · RC2';
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  else apply();
})();
