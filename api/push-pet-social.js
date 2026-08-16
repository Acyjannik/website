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
    const actor=await who.json();
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const ownerId=String(body.ownerId||'').trim();
    const action=String(body.action||'').trim();
    const visitorName=String(body.visitorName||'Jemand').trim().slice(0,80);
    const petName=String(body.petName||'dein Pet').trim().slice(0,80);
    if(!ownerId||ownerId===actor.id)return res.status(400).json({error:'Ungültiger Pet-Besitzer.'});
    const labels={greet:'begrüßt',play:'spielt mit',pet:'streichelt'};
    if(!labels[action])return res.status(400).json({error:'Ungültige Pet-Aktion.'});


    const blockCheck=await fetch(`${url}/rest/v1/club_blocks?or=(and(blocker_id.eq.${actor.id},blocked_user_id.eq.${ownerId}),and(blocker_id.eq.${ownerId},blocked_user_id.eq.${actor.id}))&select=blocker_id&limit=1`,{headers});
    if(blockCheck.ok){
      const blockRows=await blockCheck.json();
      if(Array.isArray(blockRows)&&blockRows.length) return res.status(200).json({ok:true,sent:0,blocked:true});
    }

    const push=await sendPushToUser({
      supabaseUrl:url,
      serviceKey:key,
      userId:ownerId,
      title:`🐾 ${visitorName} war bei ${petName}`,
      body:`${visitorName} ${labels[action]} ${petName}.`,
      url:`/member.html?id=${encodeURIComponent(actor.id)}#pet-social`,
      tag:`acy-pet-${actor.id}-${ownerId}`
    });
    return res.status(200).json({ok:true,...push});
  }catch(error){
    console.error('push-pet-social',error);
    return res.status(500).json({error:error?.message||'Pet-Push konnte nicht gesendet werden.'});
  }
}
