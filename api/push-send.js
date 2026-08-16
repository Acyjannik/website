import webpush from "web-push";

function json(res,status,p){res.status(status).json(p);}
async function sb(url,key,path,opts={}){
  return fetch(`${url}${path}`,{...opts,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(opts.headers||{})}});
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return json(res,405,{error:"POST only"});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidSubject=process.env.VAPID_SUBJECT,vapidPublic=process.env.VAPID_PUBLIC_KEY,vapidPrivate=process.env.VAPID_PRIVATE_KEY;
  if(!url||!key||!vapidSubject||!vapidPublic||!vapidPrivate)return json(res,503,{error:"Push-System ist noch nicht vollständig konfiguriert."});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return json(res,401,{error:"Nicht angemeldet."});
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return json(res,401,{error:"Ungültige Sitzung."});
    const caller=await who.json();
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});

    const adminRes=await sb(url,key,`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(caller.id)}&select=user_id&limit=1`);
    const isAdmin=adminRes.ok&&(await adminRes.json()).length>0;

    let targetUserIds=[];
    if(body.adminBroadcast===true){
      if(!isAdmin)return json(res,403,{error:"Nur Admins dürfen Push-Broadcasts senden."});
      const profilesRes=await sb(url,key,"/rest/v1/profiles?select=id");
      if(!profilesRes.ok)return json(res,500,{error:"Mitglieder konnten nicht geladen werden."});
      const profiles=await profilesRes.json();
      targetUserIds=(profiles||[]).map(p=>p.id);
      if(!targetUserIds.length)return json(res,200,{ok:true,sent:0,failed:0,removed:0,note:"Keine Mitglieder vorhanden."});
    }else{
      targetUserIds=[String(body.userId||caller.id)];
      if(targetUserIds[0]!==caller.id&&!isAdmin)return json(res,403,{error:"Keine Berechtigung für diesen Empfänger."});
    }

    webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate);

    const title=String(body.title||"ACY Club").slice(0,120);
    const message=String(body.body||"Neue Nachricht im ACY Club.").slice(0,300);
    const targetUrl=String(body.url||"/club-profile.html").slice(0,500);

    let sent=0,failed=0,removed=0;
    for(const userId of targetUserIds){
      const subRes=await sb(url,key,`/rest/v1/club_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,endpoint,p256dh,auth`);
      if(!subRes.ok){failed++;continue;}
      const subs=await subRes.json();
      for(const sub of subs||[]){
        try{
          await webpush.sendNotification({
            endpoint:sub.endpoint,
            keys:{p256dh:sub.p256dh,auth:sub.auth}
          },JSON.stringify({
            title,
            body:message,
            url:targetUrl,
            icon:"/icons/acy-192.png",
            badge:"/icons/acy-192.png",
            tag:body.tag||"acy-club"
          }));
          sent++;
        }catch(error){
          const code=error?.statusCode;
          if(code===404||code===410){
            await sb(url,key,`/rest/v1/club_push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,{method:"DELETE"});
            removed++;
          }else failed++;
        }
      }
    }
    return json(res,200,{ok:true,sent,failed,removed});
  }catch(error){console.error("push-send",error);return json(res,500,{error:error?.message||"Push konnte nicht gesendet werden."});}
}
