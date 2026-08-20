export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});

  const url=process.env.SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteSecret=process.env.CLUB_EVENT_HUB_SECRET||"";
  const site=(process.env.PUBLIC_SITE_URL||"https://acyjannik.de").replace(/\/$/,"");
  if(!url||!serviceKey)return res.status(503).json({error:"Event Hub is not configured."});

  const auth=req.headers.authorization||"";
  try{
    const body=typeof req.body==="object"?(req.body||{}):JSON.parse(req.body||"{}");
    const eventType=String(body.eventType||"").trim();
    const title=String(body.title||"").trim().slice(0,180);
    const payload=body.payload&&typeof body.payload==="object"?body.payload:{};
    if(!eventType||!title)return res.status(400).json({error:"eventType und title sind erforderlich."});

    let authorized=false;
    if(auth.startsWith("Bearer ")){
      const token=auth.slice(7);
      const me=await fetch(`${url}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:`Bearer ${token}`}});
      if(me.ok){
        const user=await me.json();
        const admin=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}});
        authorized=admin.ok&&(await admin.json()).length>0;
      }
    }
    if(!authorized&&siteSecret&&body.internalSecret===siteSecret)authorized=true;
    if(!authorized)return res.status(403).json({error:"Admin oder interner Event-Hub-Zugriff erforderlich."});

    const logRes=await fetch(`${url}/rest/v1/club_event_hub_log`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({event_type:eventType,title,payload})});
    if(!logRes.ok){const txt=await logRes.text();throw new Error(`Event log: ${txt}`);}

    let twitchSent=false,discordSent=false;
    const message=String(payload.message||title).slice(0,500);
    const discordMessage=`${message}\n\n🌐 [ACY Website](${site})`;

    const discordWebhook=process.env.DISCORD_EVENT_WEBHOOK_URL||"";
    if(discordWebhook){
      try{
        const r=await fetch(discordWebhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:discordMessage,allowed_mentions:{parse:[]},username:"ACY Club",avatar_url:`${site}/icons/acy-192.png`})});
        discordSent=r.ok;
      }catch{}
    }

    const twitchToken=process.env.TWITCH_BOT_ACCESS_TOKEN||"";
    const broadcasterId=process.env.TWITCH_BROADCASTER_ID||"";
    const botUserId=process.env.TWITCH_BOT_USER_ID||"";
    const clientId=process.env.TWITCH_CLIENT_ID||"";
    if(twitchToken&&broadcasterId&&botUserId&&clientId){
      try{
        const r=await fetch("https://api.twitch.tv/helix/chat/messages",{method:"POST",headers:{Authorization:`Bearer ${twitchToken}`,"Client-Id":clientId,"Content-Type":"application/json"},body:JSON.stringify({broadcaster_id:broadcasterId,sender_id:botUserId,message})});
        if(r.ok){const out=await r.json().catch(()=>({}));twitchSent=Boolean(out?.data?.[0]?.is_sent);}
      }catch{}
    }

    await fetch(`${url}/rest/v1/club_event_hub_log?event_type=eq.${encodeURIComponent(eventType)}&order=created_at.desc&limit=1`,{method:"PATCH",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({twitch_sent:twitchSent,discord_sent:discordSent})}).catch(()=>{});
    return res.status(200).json({ok:true,eventType,twitchSent,discordSent});
  }catch(error){console.error("club-event-hub",error);return res.status(500).json({error:error?.message||"Event Hub failed."});}
}
