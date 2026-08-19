export async function sendPushToUser({supabaseUrl,serviceKey,userId,title,body,url='/club-profile.html',tag='acy-club'}){
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
  const result={sent:0,removed:0,failed:0};
  try{
    const prefResponse=await fetch(`${supabaseUrl}/rest/v1/club_notification_preferences?user_id=eq.${encodeURIComponent(userId)}&select=push_enabled&limit=1`,{headers});
    if(prefResponse.ok){
      const prefRows=await prefResponse.json();
      if(prefRows?.[0] && prefRows[0].push_enabled !== true) return result;
    }

    const response=await fetch(`${supabaseUrl}/rest/v1/club_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,endpoint,p256dh,auth`,{headers});
    if(!response.ok){result.failed=1;return result;}
    const subs=await response.json();
    if(!Array.isArray(subs)||!subs.length)return result;

    let webpush;
    try{webpush=(await import('web-push')).default;}catch{result.failed=subs.length;return result;}
    const subject=process.env.VAPID_SUBJECT, pub=process.env.VAPID_PUBLIC_KEY, priv=process.env.VAPID_PRIVATE_KEY;
    if(!subject||!pub||!priv){result.failed=subs.length;return result;}
    webpush.setVapidDetails(subject,pub,priv);

    for(const sub of subs){
      try{
        if(!sub.endpoint||!sub.p256dh||!sub.auth){result.failed++;continue;}
        await webpush.sendNotification(
          {endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},
          JSON.stringify({
            title:String(title||'ACY Club').slice(0,120),
            body:String(body||'').slice(0,300),
            url:String(url||'/club-profile.html').slice(0,500),
            icon:'/icons/acy-192.png',
            badge:'/icons/acy-192.png',
            tag:String(tag||'acy-club').slice(0,80)
          })
        );
        result.sent++;
      }catch(error){
        if(error?.statusCode===404||error?.statusCode===410){
          await fetch(`${supabaseUrl}/rest/v1/club_push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,{method:'DELETE',headers}).catch(()=>{});
          result.removed++;
        }else result.failed++;
      }
    }
  }catch(error){
    // Push is a best-effort channel. Never let one network/subscription failure
    // turn the entire admin greeting endpoint into HTTP 500.
    result.failed=Math.max(result.failed,1);
    console.error('[ACY Push] delivery failed:',error?.message||error);
  }
  return result;
}
