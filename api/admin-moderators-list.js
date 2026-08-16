export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:"Service not configured."});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Nicht angemeldet."});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return res.status(401).json({error:"Ungültige Sitzung."});
    const user=await who.json();
    const check=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers});
    if(!check.ok || !(await check.json()).length)return res.status(403).json({error:"Nur Admins."});
    const r=await fetch(`${url}/rest/v1/club_moderators?select=user_id,granted_by,created_at&order=created_at.asc`,{headers});
    if(!r.ok)return res.status(500).json({error:await r.text()});
    return res.status(200).json({moderators:await r.json()});
  }catch(error){return res.status(500).json({error:error?.message||"Moderatoren konnten nicht geladen werden."});}
}
