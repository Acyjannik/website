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
    const [adminRes,modRes]=await Promise.all([
      fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers}),
      fetch(`${url}/rest/v1/club_moderators?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers})
    ]);
    const admin=adminRes.ok&&(await adminRes.json()).length>0;
    const mod=modRes.ok&&(await modRes.json()).length>0;
    if(!admin&&!mod)return res.status(403).json({error:"Nur Moderatoren dürfen Votes veröffentlichen."});

    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const question=String(body.question||"").trim().slice(0,180);
    const description=String(body.description||"").trim().slice(0,500);
    const options=Array.isArray(body.options)?body.options.map(v=>String(v||"").trim()).filter(Boolean).slice(0,8):[];
    const closesAt=body.closesAt?new Date(body.closesAt):null;
    if(!question||options.length<2)return res.status(400).json({error:"Vote-Daten sind unvollständig."});

    const webhook=process.env.DISCORD_EVENT_WEBHOOK_URL||"";
    if(!webhook)return res.status(503).json({error:"DISCORD_EVENT_WEBHOOK_URL ist in Vercel nicht konfiguriert."});
    const when=closesAt&&!Number.isNaN(closesAt.getTime())?`\n🕒 **Ende:** <t:${Math.floor(closesAt.getTime()/1000)}:R>`:"";
    const optionText=options.map((value,index)=>`${index+1}. ${value}`).join("\n");
    const content=["🗳️ **NEUER COMMUNITY VOTE**","",`**${question}**`,description?`\n${description}`:"","","**Antworten:**",optionText,when,"","🛡️ Veröffentlicht über den ACY Moderatorbereich.",`🌐 [ACY Website](${site})`].filter(Boolean).join("\n");

    const discordRes=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content,allowed_mentions:{parse:[]},username:"ACY Club",avatar_url:`${site}/icons/acy-192.png`})});
    if(!discordRes.ok)return res.status(502).json({error:`Discord Webhook ${discordRes.status}: ${await discordRes.text()}`});

    await fetch(`${url}/rest/v1/club_event_hub_log`,{method:"POST",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({event_type:"mod_poll",title:`🗳️ ${question}`,payload:{message:content,moderatorId:user.id,options}})}).catch(()=>{});
    return res.status(200).json({ok:true,discordSent:true});
  }catch(error){console.error("mod-poll-discord",error);return res.status(500).json({error:error?.message||"Discord-Vote-Benachrichtigung fehlgeschlagen."});}
}
