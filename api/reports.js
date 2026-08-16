export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:'Report-System nicht konfiguriert.'});
  const auth=req.headers.authorization||''; if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Nicht angemeldet.'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}}); if(!who.ok)return res.status(401).json({error:'Ungültige Sitzung.'});
    const user=await who.json();
    if(req.method!=='POST')return res.status(405).json({error:'POST only'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const targetUserId=String(body.targetUserId||'').trim(); const reason=String(body.reason||'').trim().slice(0,180); const details=String(body.details||'').trim().slice(0,1000);
    if(!targetUserId||!reason)return res.status(400).json({error:'Ziel und Grund sind erforderlich.'});
    if(targetUserId===user.id)return res.status(400).json({error:'Du kannst dich nicht selbst melden.'});
    const r=await fetch(`${url}/rest/v1/club_reports`,{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({reporter_id:user.id,target_user_id:targetUserId,target_type:'member',reason,details})});
    if(!r.ok)return res.status(500).json({error:await r.text()});
    return res.status(200).json({ok:true});
  }catch(error){return res.status(500).json({error:error?.message||'Meldung fehlgeschlagen.'});}
}
