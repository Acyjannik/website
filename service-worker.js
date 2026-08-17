/* ACY SERVICE WORKER V17.1 */

self.addEventListener('install',event=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
  let payload={title:'ACY Club',body:'Neue Nachricht im ACY Club.',url:'/club-profile.html'};
  try{if(event.data)payload={...payload,...event.data.json()};}catch{}
  const title=payload.title||'ACY Club';
  const options={
    body:payload.body||'',
    icon:payload.icon||'/icons/acy-192.png',
    badge:payload.badge||'/icons/acy-192.png',
    tag:payload.tag||'acy-club',
    renotify:false,
    data:{url:payload.url||'/club-profile.html'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/club-profile.html';
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      if('focus' in client && new URL(client.url).origin === self.location.origin){
        await client.focus();
        try{await client.navigate(target);}catch{}
        return;
      }
    }
    if(clients.openWindow)await clients.openWindow(target);
  })());
});
