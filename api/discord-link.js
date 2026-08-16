function json(res,status,payload){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(payload));
}
async function sb(path,options={}){
  const url=process.env.SUPABASE_URL||"";
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
  return fetch(`${url}${path}`,{
    ...options,
    headers:{
      apikey:key,
      Authorization:`Bearer ${key}`,
      "Content-Type":"application/json",
      ...(options.headers||{})
    }
  });
}
function identityDiscordId(identity){
  const d=identity?.identity_data||{};
  return String(
    d.sub ??
    d.provider_id ??
    d.id ??
    identity?.identity_id ??
    ""
  ).trim();
}
export default async function handler(req,res){
  if(!["POST","DELETE"].includes(req.method))return json(res,405,{error:"POST or DELETE only"});
  try{
    const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    if(!token)return json(res,401,{error:"Nicht angemeldet."});

    const meRes=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{
      headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${token}`}
    });
    if(!meRes.ok)return json(res,401,{error:"Ungültige Sitzung."});
    const user=await meRes.json();
    if(!user?.id)return json(res,401,{error:"Ungültige Sitzung."});

    if(req.method==="DELETE"){
      const del=await sb(`/rest/v1/discord_presence_links?user_id=eq.${encodeURIComponent(user.id)}`,{
        method:"DELETE",
        headers:{Prefer:"return=minimal"}
      });
      if(!del.ok)throw new Error(`Discord link delete ${del.status}: ${await del.text()}`);
      return json(res,200,{ok:true,connected:false,linked:false});
    }

    const adminRes=await sb(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`);
    if(!adminRes.ok)throw new Error(`Auth user lookup ${adminRes.status}`);
    const adminUser=await adminRes.json();

    const identity=(adminUser.identities||[]).find(item=>item.provider==="discord");
    const discordUserId=identityDiscordId(identity);
    if(!discordUserId){
      return json(res,200,{ok:true,connected:false,linked:false,reason:"discord_identity_not_found"});
    }

    const upsert=await sb("/rest/v1/discord_presence_links",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({
        discord_user_id:discordUserId,
        user_id:user.id,
        updated_at:new Date().toISOString()
      })
    });
    if(!upsert.ok)throw new Error(`Discord link ${upsert.status}: ${await upsert.text()}`);

    return json(res,200,{
      ok:true,
      connected:true,
      linked:true,
      discordUserId:discordUserId
    });
  }catch(error){
    console.error("discord-link",error);
    return json(res,500,{error:error?.message||"Discord-Verknüpfung konnte nicht synchronisiert werden."});
  }
}
