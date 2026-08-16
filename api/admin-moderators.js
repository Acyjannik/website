export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:"Service not configured."});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Nicht angemeldet."});
  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return res.status(401).json({error:"Ungültige Sitzung."});
    const admin=await who.json();
    const check=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(admin.id)}&select=user_id&limit=1`,{headers});
    if(!check.ok || !(await check.json()).length)return res.status(403).json({error:"Nur Admins dürfen Moderatoren verwalten."});

    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const userId=String(body.userId||"").trim();
    const action=body.action==="remove"?"remove":"grant";
    if(!userId)return res.status(400).json({error:"userId fehlt."});

    if(userId===admin.id && action==="remove")return res.status(400).json({error:"Deinen eigenen Admin-Zugriff kannst du hier nicht entfernen."});

    if(action==="grant"){
      const r=await fetch(`${url}/rest/v1/club_moderators`,{
        method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates"},
        body:JSON.stringify({user_id:userId,granted_by:admin.id})
      });
      if(!r.ok)return res.status(500).json({error:await r.text()});
      // add Mod badge
      const p=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=badges&limit=1`,{headers});
      const rows=p.ok?await p.json():[];
      const badges=Array.isArray(rows?.[0]?.badges)?rows[0].badges:[];
      const next=Array.from(new Set([...badges,"Mod"]));
      await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
        method:"PATCH",headers:{...headers,Prefer:"return=minimal"},
        body:JSON.stringify({badges:next,updated_at:new Date().toISOString()})
      });
    }else{
      const r=await fetch(`${url}/rest/v1/club_moderators?user_id=eq.${encodeURIComponent(userId)}`,{method:"DELETE",headers});
      if(!r.ok)return res.status(500).json({error:await r.text()});
      const p=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=badges&limit=1`,{headers});
      const rows=p.ok?await p.json():[];
      const badges=Array.isArray(rows?.[0]?.badges)?rows[0].badges:[];
      const next=badges.filter(b=>b!=="Mod");
      await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
        method:"PATCH",headers:{...headers,Prefer:"return=minimal"},
        body:JSON.stringify({badges:next,updated_at:new Date().toISOString()})
      });
    }
    return res.status(200).json({ok:true,action,userId});
  }catch(error){return res.status(500).json({error:error?.message||"Moderator konnte nicht geändert werden."});}
}
