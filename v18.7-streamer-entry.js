(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function token(){
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||''; if(!key.startsWith('sb-')||!key.endsWith('-auth-token')) continue;
        const raw=localStorage.getItem(key); if(!raw) continue;
        const parsed=JSON.parse(raw); if(parsed?.access_token) return parsed.access_token;
      }
    }catch{}
    return null;
  }

  async function load(){
    const access=token(); if(!access) return;
    try{
      const res=await fetch('/api/mod-auth',{headers:{Authorization:`Bearer ${access}`},cache:'no-store'});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.isStreamer) return;
      if($('acy-streamer-center-entry')) return;
      const home=$('acy-v18-home'); if(!home) return;
      const section=document.createElement('section');
      section.id='acy-streamer-center-entry';
      section.className='member-card member-span-2 streamer-entry-card';
      section.innerHTML=`<div><span class="eyebrow">CREATOR</span><h2>Streamer Center</h2><p>Live-Steuerung und Creator-Werkzeuge für ACYJANNIK.</p></div><a class="button button-primary" href="/streamer.html">Streamer Center öffnen ↗</a>`;
      home.insertAdjacentElement('afterend',section);
      const style=document.createElement('style');
      style.textContent=`#acy-streamer-center-entry{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:linear-gradient(145deg,rgba(30,19,45,.95),rgba(12,12,18,.99));border-color:rgba(180,108,255,.32)!important}#acy-streamer-center-entry h2{margin:4px 0}#acy-streamer-center-entry p{margin:0;color:#a1a1aa}@media(max-width:700px){#acy-streamer-center-entry{align-items:stretch;flex-direction:column;padding:16px}#acy-streamer-center-entry .button{width:100%}}`;
      document.head.appendChild(style);
    }catch(error){console.warn('[V18.7] Streamer entry skipped:',error);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,450),{once:true});else setTimeout(load,450);
})();
