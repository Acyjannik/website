
/* ACY V17.6: keep the active service worker stable so Push can work reliably. */

let deferredPwaInstallPrompt = null;
let PUSH_PUBLIC_KEY = '';

function isIosDevice(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function supportsPush(){
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function pwaInstallState(){
  return {
    standalone:isStandalone(),
    ios:isIosDevice(),
    canPrompt:!!deferredPwaInstallPrompt,
    supportsPush:supportsPush()
  };
}

function openPwaInstallHelp(){
  const modal=document.getElementById('acy-pwa-install-modal');
  if(!modal)return;
  modal.hidden=false;
  document.body.classList.add('pwa-modal-open');
}
function closePwaInstallHelp(){
  const modal=document.getElementById('acy-pwa-install-modal');
  if(!modal)return;
  modal.hidden=true;
  document.body.classList.remove('pwa-modal-open');
}

async function installAcyPwa(){
  if(deferredPwaInstallPrompt){
    deferredPwaInstallPrompt.prompt();
    try{ await deferredPwaInstallPrompt.userChoice; }catch{}
    deferredPwaInstallPrompt=null;
    updatePwaUi();
    return;
  }
  openPwaInstallHelp();
}

function base64ToUint8Array(base64){
  const padding='='.repeat((4-base64.length%4)%4);
  const normalized=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(normalized);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

let acyPushSupabaseClient = null;

async function getAcyAccessToken(){
  try{
    if(!acyPushSupabaseClient){
      acyPushSupabaseClient = window.__acySupabaseClient || null;
      if(!acyPushSupabaseClient){
        const cfg = await (await fetch('/api/config',{cache:'no-store'})).json();
        if(!cfg?.configured || !window.supabase?.createClient) return null;
        acyPushSupabaseClient = window.supabase.createClient(
          cfg.supabaseUrl,
          cfg.supabaseAnonKey,
          { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} }
        );
      }
    }
    const {data,error}=await acyPushSupabaseClient.auth.getSession();
    if(error) throw error;
    return data?.session?.access_token || null;
  }catch(error){
    console.warn('ACY Push: session unavailable',error);
    return null;
  }
}

async function loadPushConfig(){
  try{
    const response=await fetch('/api/push-config',{cache:'no-store'});
    const data=await response.json();
    PUSH_PUBLIC_KEY=data?.publicKey||'';
    return data;
  }catch{return {publicKey:''};}
}

async function subscribeAcyPush(){
  await loadPushConfig();
  if(!supportsPush()) throw new Error('Push-Benachrichtigungen werden auf diesem Gerät nicht unterstützt.');
  if(isIosDevice() && !isStandalone()){
    openPwaInstallHelp();
    throw new Error('Bitte ACY zuerst zum Home-Bildschirm hinzufügen.');
  }
  if(!PUSH_PUBLIC_KEY) throw new Error('Push-System ist noch nicht konfiguriert.');

  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.');

  const registration=await navigator.serviceWorker.register('/service-worker.js?v=17.6.0',{scope:'/'});
  const ready=await navigator.serviceWorker.ready;
  let subscription=await ready.pushManager.getSubscription();
  if(!subscription){
    subscription=await ready.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64ToUint8Array(PUSH_PUBLIC_KEY)
    });
  }

  const token=await getAcyAccessToken();
  if(!token)throw new Error('Deine ACY-Sitzung konnte für Push nicht gelesen werden. Bitte einmal ausloggen und erneut einloggen.');
  const response=await fetch('/api/push-subscribe',{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({subscription:subscription.toJSON(),userAgent:navigator.userAgent})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||'Push-Abo konnte nicht gespeichert werden.');

  updatePwaUi();
  return payload;
}

async function unsubscribeAcyPush(){
  const token=await getAcyAccessToken();
  if(!token)return;
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=registration ? await registration.pushManager.getSubscription() : null;
  if(subscription){
    await fetch('/api/push-subscribe',{
      method:'DELETE',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({endpoint:subscription.endpoint})
    }).catch(()=>{});
    await subscription.unsubscribe().catch(()=>{});
  }
  updatePwaUi();
}

async function updatePwaUi(){
  const installBtn=document.getElementById('acy-install-pwa');
  const pushBtn=document.getElementById('acy-enable-push');
  const status=document.getElementById('acy-pwa-status');
  const hint=document.getElementById('acy-pwa-hint');

  const state=pwaInstallState();
  const permission=('Notification' in window) ? Notification.permission : 'unsupported';
  const registration=await navigator.serviceWorker?.getRegistration?.('/');
  const pushSub=registration ? await registration.pushManager?.getSubscription?.() : null;

  if(installBtn){
    installBtn.textContent=state.standalone ? '✅ ACY ist installiert' : '📱 ACY installieren';
    installBtn.disabled=state.standalone;
    installBtn.hidden=state.standalone;
  }
  if(pushBtn){
    pushBtn.textContent=pushSub ? '🔔 Push ist aktiv' : '🔔 Push-Benachrichtigungen aktivieren';
    pushBtn.classList.toggle('is-enabled',!!pushSub);
  }
  if(status){
    status.textContent=pushSub
      ? 'Push-Benachrichtigungen sind auf diesem Gerät aktiv.'
      : permission==='denied'
        ? 'Benachrichtigungen sind im Browser blockiert.'
        : state.ios && !state.standalone
          ? 'Auf iPhone zuerst zum Home-Bildschirm hinzufügen.'
          : 'Noch nicht aktiviert.';
  }
  if(hint){
    hint.textContent=state.ios && !state.standalone
      ? 'iPhone: Teilen → Zum Home-Bildschirm → Hinzufügen.'
      : state.canPrompt
        ? 'Dein Browser kann ACY direkt als App installieren.'
        : 'Du kannst ACY wie eine App auf dem Startbildschirm installieren.';
  }
}

function hidePublicPrivilegedLinks(){
  const path=location.pathname;
  const isPublicHome=path==='/'||path==='/index.html'||path==='/index';
  if(!isPublicHome)return;
  const remove=()=>{
    document.querySelectorAll('a,button').forEach(el=>{
      const href=el.getAttribute('href')||'';
      const text=(el.textContent||'').trim();
      if(/\/admin\.html|\/mod\.html|\/staff\.html/i.test(href) || /^(admin(\s|\/|$)|mod center|admin center|admin \/ mod)/i.test(text)){
        el.remove();
      }
    });
  };
  remove();
  new MutationObserver(remove).observe(document.body,{childList:true,subtree:true});
}

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredPwaInstallPrompt=e;
  updatePwaUi();
});
window.addEventListener('appinstalled',()=>{deferredPwaInstallPrompt=null;updatePwaUi();});
document.addEventListener('DOMContentLoaded',()=>{
  hidePublicPrivilegedLinks();
  document.getElementById('acy-install-pwa')?.addEventListener('click',installAcyPwa);
  document.getElementById('acy-enable-push')?.addEventListener('click',async()=>{
    const btn=document.getElementById('acy-enable-push');
    try{
      if(btn)btn.disabled=true;
      await subscribeAcyPush();
    }catch(error){
      const status=document.getElementById('acy-pwa-status');
      if(status)status.textContent=error.message||'Push konnte nicht aktiviert werden.';
    }finally{
      if(btn)btn.disabled=false;
      updatePwaUi();
    }
  });
  document.getElementById('acy-pwa-install-close')?.addEventListener('click',closePwaInstallHelp);
  document.getElementById('acy-pwa-install-overlay')?.addEventListener('click',e=>{
    if(e.target.id==='acy-pwa-install-overlay')closePwaInstallHelp();
  });
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js?v=17.6.0',{scope:'/'}).catch(()=>{});
  // club-profile.js is deferred, so DOMContentLoaded runs after its function
  // declarations have been installed. Load the additive Pet refresh patch now.
  const petFix=document.createElement('script');
  petFix.src='/club-pet-refresh-fix.js?v=1.0.1';
  petFix.async=false;
  document.head.appendChild(petFix);
  setTimeout(updatePwaUi,250);
});
