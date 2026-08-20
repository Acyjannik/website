
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
  if(isIosDevice() && !isStandalone()){
    openPwaInstallHelp();
    return;
  }
  if(deferredPwaInstallPrompt){
    try{
      deferredPwaInstallPrompt.prompt();
      const choice=await deferredPwaInstallPrompt.userChoice;
      deferredPwaInstallPrompt=null;
      if(choice?.outcome!=='accepted') openPwaInstallHelp();
    }catch(error){
      deferredPwaInstallPrompt=null;
      openPwaInstallHelp();
    }
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

async function syncAcyPushSubscription(subscription){
  try{
    if(!subscription)return false;
    const token=await getAcyAccessToken();
    if(!token)return false;
    const response=await fetch('/api/push-subscribe',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({subscription:subscription.toJSON(),userAgent:navigator.userAgent})
    });
    return response.ok;
  }catch(error){
    console.warn('ACY Push: subscription sync failed',error);
    return false;
  }
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

  const synced=await syncAcyPushSubscription(subscription);
  if(!synced)throw new Error('Push-Abo konnte nicht gespeichert werden.');

  updatePwaUi();
  return {ok:true,saved:true};
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

function movePushCardIntoClub(){
  const card=document.getElementById('acy-mobile-app-card');
  const dashboard=document.querySelector('.member-dashboard');
  if(!card || !dashboard || card.dataset.acyMoved==='1')return;
  card.dataset.acyMoved='1';
  card.classList.add('acy-push-setup-visible');
  dashboard.insertBefore(card,dashboard.firstElementChild || null);
}

function updatePushCardCopy(state,pushSub,permission){
  const card=document.getElementById('acy-mobile-app-card');
  if(!card)return;
  const title=card.querySelector('h3');
  const text=card.querySelector('.push-pwa-copy p');
  const installBtn=document.getElementById('acy-install-pwa');
  const pushBtn=document.getElementById('acy-enable-push');
  const status=document.getElementById('acy-pwa-status');
  const hint=document.getElementById('acy-pwa-hint');
  const eyebrow=card.querySelector('.eyebrow');

  card.hidden=false;
  card.removeAttribute('aria-hidden');

  if(pushSub){
    if(eyebrow)eyebrow.textContent='ACY MOBILE · AKTIV';
    if(title)title.textContent='🔔 Push ist aktiv';
    if(text)text.textContent='Du bekommst wichtige ACY-Club-Benachrichtigungen direkt auf dieses Gerät.';
    if(status)status.textContent='✅ Benachrichtigungen sind aktiviert.';
    if(hint)hint.textContent='Du kannst diese Einstellung jederzeit im Bereich Benachrichtigungen ändern.';
    if(installBtn)installBtn.hidden=true;
    if(pushBtn){pushBtn.textContent='✅ Push ist aktiv';pushBtn.disabled=true;}
    card.classList.add('acy-push-setup-complete');
    return;
  }

  card.classList.remove('acy-push-setup-complete');
  if(eyebrow)eyebrow.textContent='ACY MOBILE · WICHTIG';
  if(title)title.textContent=state.ios && !state.standalone ? '📱 ACY als App installieren' : '🔔 Push-Benachrichtigungen aktivieren';
  if(text)text.textContent=state.ios && !state.standalone
    ? 'Installiere ACY zuerst auf deinem Home-Bildschirm. Danach kannst du Push-Benachrichtigungen aktivieren.'
    : 'Verpasse keine Live-Alerts, Events, Daily-Serien und wichtigen Club-Nachrichten.';

  if(installBtn){
    installBtn.hidden=state.standalone;
    installBtn.disabled=false;
    installBtn.textContent=state.ios && !state.standalone ? '📱 Installationshilfe öffnen' : (state.canPrompt ? '📱 ACY installieren' : '📱 Installationshilfe');
  }
  if(pushBtn){
    pushBtn.hidden=false;
    pushBtn.disabled=false;
    pushBtn.textContent=state.ios && !state.standalone ? '🔔 Danach Push aktivieren' : '🔔 Push aktivieren';
  }
  if(status){
    status.textContent=permission==='denied'
      ? '⚠️ Benachrichtigungen sind im Browser blockiert. Bitte in den Geräteeinstellungen erlauben.'
      : state.ios && !state.standalone
        ? '1. App installieren  →  2. Push aktivieren'
        : 'Noch nicht aktiviert.';
  }
  if(hint){
    hint.textContent=state.ios && !state.standalone
      ? 'iPhone: Teilen → Zum Home-Bildschirm → Hinzufügen. Anschließend diese Seite in der ACY-App öffnen.'
      : state.canPrompt
        ? 'Dein Browser kann ACY direkt als App installieren.'
        : 'Du kannst ACY wie eine App auf den Startbildschirm installieren.';
  }
}

async function updatePwaUi(){
  movePushCardIntoClub();
  const installBtn=document.getElementById('acy-install-pwa');
  const pushBtn=document.getElementById('acy-enable-push');
  const status=document.getElementById('acy-pwa-status');
  const hint=document.getElementById('acy-pwa-hint');

  const state=pwaInstallState();
  const permission=('Notification' in window) ? Notification.permission : 'unsupported';
  const registration=await navigator.serviceWorker?.getRegistration?.('/');
  const pushSub=registration ? await registration.pushManager?.getSubscription?.() : null;

  updatePushCardCopy(state,pushSub,permission);

  if(installBtn && !pushSub){
    installBtn.textContent=state.standalone ? '✅ ACY ist installiert' : (state.ios && !state.standalone ? '📱 Installationshilfe öffnen' : (state.canPrompt ? '📱 ACY installieren' : '📱 Installationshilfe'));
    installBtn.disabled=state.standalone;
  }
  if(pushBtn && pushSub){
    pushBtn.textContent='🔔 Push ist aktiv';
    pushBtn.classList.add('is-enabled');
  }
  if(status && !pushSub){
    status.textContent=permission==='denied'
      ? '⚠️ Benachrichtigungen sind im Browser blockiert. Bitte in den Geräteeinstellungen erlauben.'
      : state.ios && !state.standalone
        ? '1. App installieren  →  2. Push aktivieren'
        : 'Noch nicht aktiviert.';
  }
  if(hint && !pushSub){
    hint.textContent=state.ios && !state.standalone
      ? 'iPhone: Teilen → Zum Home-Bildschirm → Hinzufügen. Anschließend diese Seite in der ACY-App öffnen.'
      : state.canPrompt
        ? 'Dein Browser kann ACY direkt als App installieren.'
        : 'Du kannst ACY wie eine App auf den Startbildschirm installieren.';
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
  document.getElementById('acy-install-pwa')?.addEventListener('click',async()=>{
    try{
      await installAcyPwa();
    }catch(error){
      const status=document.getElementById('acy-pwa-status');
      if(status)status.textContent=error.message||'Installation konnte nicht gestartet werden.';
    }
  });
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
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js?v=17.6.0',{scope:'/'}).then(async registration=>{
    const ready=await navigator.serviceWorker.ready;
    const existing=ready.pushManager.getSubscription ? await ready.pushManager.getSubscription() : null;
    if(existing && Notification.permission==='granted'){
      await syncAcyPushSubscription(existing);
    }
    updatePwaUi();
  }).catch(()=>{});
  const petFix=document.createElement('script');
  petFix.src='/club-pet-refresh-fix.js?v=1.0.1';
  petFix.async=false;
  document.head.appendChild(petFix);
  setTimeout(updatePwaUi,250);
});