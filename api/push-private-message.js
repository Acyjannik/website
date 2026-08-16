import { sendPushToUser } from './_push-utils.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:'Push service is not configured.'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Nicht angemeldet.'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};

  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return res.status(401).json({error:'Ungültige Sitzung.'});
    const sender=await who.json();
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const recipientId=String(body.recipientId||'').trim();
    const message=String(body.message||'').trim().slice(0,300);
    const senderName=String(body.senderName||'Jemand').trim().slice(0,80);
    if(!recipientId||recipientId===sender.id)return res.status(400).json({error:'Ungültiger Empfänger.'});
    if(!message)return res.status(400).json({error:'Nachricht fehlt.'});

    // Prevent spoofing: the caller's user id is the sender of the push.
    const push=await sendPushToUser({
      supabaseUrl:url,
      serviceKey:key,
      userId:recipientId,
      title:`💬 Neue Nachricht von ${senderName}`,
      body:message,
      url:`/club-profile.html?dm=${encodeURIComponent(sender.id)}`,
      tag:`acy-dm-${sender.id}`
    });
    return res.status(200).json({ok:true,...push});
  }catch(error){
    console.error('push-private-message',error);
    return res.status(500).json({error:error?.message||'Push konnte nicht gesendet werden.'});
  }
}
