export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:"Push service not configured."});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Nicht angemeldet."});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return res.status(401).json({error:"Ungültige Sitzung."});
    const user=await who.json();
    const r=await fetch(`${url}/rest/v1/club_push_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=id,endpoint,created_at,updated_at,user_agent&order=updated_at.desc`,{headers});
    if(!r.ok)return res.status(500).json({error:await r.text()});
    const rows=await r.json();
    return res.status(200).json({
      ok:true,
      count:Array.isArray(rows)?rows.length:0,
      subscriptions:(rows||[]).map(x=>({
        id:x.id,
        endpoint:String(x.endpoint||'').slice(0,90),
        created_at:x.created_at,
        updated_at:x.updated_at,
        user_agent:String(x.user_agent||'').slice(0,180)
      }))
    });
  }catch(error){return res.status(500).json({error:error?.message||"Push-Status fehlgeschlagen."});}
}
