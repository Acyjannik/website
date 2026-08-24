(() => {
  'use strict';
  if (!/\/pet\.html$/i.test(location.pathname)) return;
  if (document.getElementById('acy-v20-pet-tabs-style')) return;

  const style = document.createElement('style');
  style.id = 'acy-v20-pet-tabs-style';
  style.textContent = `
    .pet-mobile-hub-v183{
      display:grid!important;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      gap:10px!important;
      width:100%!important;
      overflow:visible!important;
    }
    .pet-mobile-hub-v183 .pet-hub-card-v182{
      width:100%!important;
      min-width:0!important;
      max-width:none!important;
      box-sizing:border-box!important;
      overflow:hidden!important;
      padding:16px 12px!important;
    }
    .pet-mobile-hub-v183 .pet-hub-card-v182 strong{
      display:block!important;
      font-size:16px!important;
      line-height:1.15!important;
      white-space:normal!important;
      overflow-wrap:anywhere!important;
      word-break:normal!important;
    }
    .pet-mobile-hub-v183 .pet-hub-card-v182 small{
      display:block!important;
      font-size:12px!important;
      line-height:1.28!important;
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }
    .pet-mobile-hub-v183 .pet-hub-card-v182>b{display:none!important}
    @media(max-width:700px){
      .pet-mobile-hub-v183{gap:8px!important}
      .pet-mobile-hub-v183 .pet-hub-card-v182{padding:13px 8px!important}
      .pet-mobile-hub-v183 .pet-hub-card-v182 strong{font-size:14px!important}
      .pet-mobile-hub-v183 .pet-hub-card-v182 small{font-size:10px!important}
    }
  `;
  document.head.appendChild(style);
})();
