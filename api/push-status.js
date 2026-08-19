export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const url=process.env.SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey=process.env.SUPABASE_ANON_KEY||serviceKey;
  if(!url||!serviceKey)return res.status(503).json({error:"Push service not configured."});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Nicht angemeldet."});

  try{
    // Validate the caller with the anon key; service-role is reserved for the
    // database read below.
    const who=await fetch(`${url}/auth/v1/user`,{
      headers:{apikey:anonKey,Authorization:auth}
    });
    if(!who.ok)return res.status(401).json({error:"Ungültige Sitzung."});
    const user=await who.json();
    if(!user?.id)return res.status(401).json({error:"Benutzer konnte nicht ermittelt werden."});

    const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
    const r=await fetch(`${url}/rest/v1/club_push_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=id,endpoint,created_at,updated_at,user_agent&order=updated_at.desc`,{headers});

    if(!r.ok){
      const detail=await r.text().catch(()=>"");
      // Status inspection must not turn a healthy admin page red just because
      // the diagnostic query is temporarily unavailable.
      return res.status(200).json({ok:false,count:0,warning:`Push-Status konnte nicht vollständig gelesen werden (HTTP ${r.status}).`,detail:detail.slice(0,300)});
    }

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
  }catch(error){
    return res.status(200).json({ok:false,count:0,warning:error?.message||"Push-Status fehlgeschlagen."});
  }
}
