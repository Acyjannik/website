export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const t0=Date.now();
  if(!url||!key)return res.status(503).json({error:'Server-Konfiguration fehlt.'});
  try{
    const checks={};
    const db0=Date.now(); const db=await fetch(`${url}/rest/v1/profiles?select=id&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'}); checks.supabase={ok:db.ok,ms:Date.now()-db0};
    checks.database={ok:db.ok,ms:checks.supabase.ms};
    checks.push={ok:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT)};
    checks.smtp={ok:Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS&&process.env.EMAIL_FROM)};
    checks.discord={ok:Boolean(process.env.DISCORD_BOT_TOKEN||process.env.DISCORD_EVENT_WEBHOOK_URL)};
    checks.twitch={ok:Boolean(process.env.TWITCH_ACCESS_TOKEN||process.env.TWITCH_CLIENT_ID)};
    checks.storage={ok:db.ok};
    checks.realtime={ok:db.ok};
    const overall=Object.values(checks).every(x=>x.ok);
    return res.status(200).json({ok:true,overall,checkedAt:new Date().toISOString(),durationMs:Date.now()-t0,checks});
  }catch(error){return res.status(500).json({error:error?.message||'Health check failed.'});}
}
