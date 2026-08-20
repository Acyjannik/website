export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site=(process.env.PUBLIC_SITE_URL||"https://acyjannik.de").replace(/\/$/,"");
  if(!url||!key)return res.status(503).json({error:"Service not configured."});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Nicht angemeldet."});
  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return res.status(401).json({error:"Ungültige Sitzung."});
    const user=await who.json();
    const adminRes=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers});
    const modRes=await fetch(`${url}/rest/v1/club_moderators?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers});
    const admin=adminRes.ok&&(await adminRes.json()).length>0;
    const mod=modRes.ok&&(await modRes.json()).length>0;
    if(!admin&&!mod)return res.status(403).json({error:"Nur Moderatoren dürfen Ankündigungen senden."});

    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const title=String(body.title||"").trim().slice(0,160);
    const text=String(body.body||"").trim().slice(0,1000);
    if(!title||!text)return res.status(400).json({error:"Titel und Nachricht erforderlich."});

    const log=await fetch(`${url}/rest/v1/club_event_hub_log`,{method:"POST",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({event_type:"mod_announcement",title,payload:{message:`🛡️ ${title}\n${text}`,moderatorId:user.id}})});
    if(!log.ok)return res.status(500).json({error:await log.text()});

    const webhook=process.env.DISCORD_EVENT_WEBHOOK_URL||"";
    let discordSent=false;
    if(webhook){
      const discordText=`🛡️ **${title}**\n${text}\n\n🌐 [ACY Website](${site})`;
      const r=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:discordText,allowed_mentions:{parse:[]},username:"ACY Club",avatar_url:`${site}/icons/acy-192.png`})});
      discordSent=r.ok;
    }
    return res.status(200).json({ok:true,discordSent});
  }catch(error){return res.status(500).json({error:error?.message||"Ankündigung fehlgeschlagen."});}
}
