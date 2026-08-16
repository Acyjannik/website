export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});

  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return res.status(503).json({error:"Admin service is not configured."});

  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer ")) return res.status(401).json({error:"Nicht angemeldet."});

  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok) return res.status(401).json({error:"Ungültige Sitzung."});
    const admin=await who.json();

    const adminCheck=await fetch(
      `${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(admin.id)}&select=user_id&limit=1`,
      {headers}
    );
    if(!adminCheck.ok) return res.status(500).json({error:"Admin-Rechte konnten nicht geprüft werden."});
    const admins=await adminCheck.json();
    if(!admins.length) return res.status(403).json({error:"Nur Admins dürfen das Mod-Badge vergeben."});

    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const userId=String(body.userId||"").trim();
    const action=body.action==="remove"?"remove":"grant";
    if(!userId) return res.status(400).json({error:"userId fehlt."});

    const profileRes=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,badges,username,display_name&limit=1`,{headers});
    if(!profileRes.ok) return res.status(500).json({error:"Mitglied konnte nicht geladen werden."});
    const rows=await profileRes.json();
    const profile=rows?.[0];
    if(!profile) return res.status(404).json({error:"Mitglied nicht gefunden."});

    const badges=Array.isArray(profile.badges)?profile.badges:[];
    const has=badges.includes("Mod");
    const next=action==="grant"
      ? Array.from(new Set([...badges,"Mod"]))
      : badges.filter(b=>b!=="Mod");

    if((action==="grant"&&has)||(action==="remove"&&!has)){
      return res.status(200).json({ok:true,action,changed:false,hasMod:has,username:profile.username||profile.display_name||""});
    }

    const update=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
      method:"PATCH",
      headers:{...headers,Prefer:"return=minimal"},
      body:JSON.stringify({badges:next,updated_at:new Date().toISOString()})
    });
    if(!update.ok) return res.status(500).json({error:await update.text()});

    return res.status(200).json({
      ok:true,
      action,
      changed:true,
      hasMod:action==="grant",
      username:profile.username||profile.display_name||""
    });
  }catch(error){
    console.error("admin-mod-badge",error);
    return res.status(500).json({error:error?.message||"Mod-Badge konnte nicht geändert werden."});
  }
}
