function json(res,status,payload){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(payload));
}

function isValidSecret(req){
  const expected=String(process.env.ACY_GAME_DISCOVERY_SECRET||"");
  const supplied=String(req.headers["x-acy-game-secret"]||"");
  return Boolean(expected && supplied && supplied===expected);
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

export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"POST only"});
  if(!isValidSecret(req))return json(res,403,{error:"Invalid game discovery secret."});

  try{
    const body=typeof req.body==="object"?(req.body||{}):JSON.parse(req.body||"{}");
    const discordUserId=String(body.discordUserId||"").trim();
    const acyUserId=String(body.acyUserId||"").trim();
    const gameName=String(body.gameName||"").trim().slice(0,180);
    const online=body.online!==false;

    if(!discordUserId||!gameName)return json(res,400,{error:"discordUserId und gameName sind erforderlich."});

    // Resolve/create the game first.
    const site=String(process.env.PUBLIC_SITE_URL||"").replace(/\/$/,"");
    if(!site)return json(res,503,{error:"PUBLIC_SITE_URL ist nicht konfiguriert."});

    const resolveRes=await fetch(`${site}/api/twitch-game`,{
      method:"POST",
      headers:{"Content-Type":"application/json","X-ACY-GAME-SECRET":String(process.env.ACY_GAME_DISCOVERY_SECRET||"")},
      body:JSON.stringify({gameName})
    });
    const resolved=await resolveRes.json().catch(()=>({}));
    if(!resolveRes.ok||!resolved?.game?.id){
      return json(res,200,{ok:true,resolved:false,reason:resolved?.reason||resolved?.error||"game_not_found"});
    }

    let targetUserId=acyUserId||null;
    if(!targetUserId){
      // Optional mapping table, populated by Discord OAuth linking.
      const linkRes=await sb(`/rest/v1/discord_presence_links?discord_user_id=eq.${encodeURIComponent(discordUserId)}&select=user_id&limit=1`);
      if(linkRes.ok)targetUserId=(await linkRes.json())[0]?.user_id||null;
    }

    if(!targetUserId){
      return json(res,200,{ok:true,resolved:true,updated:false,reason:"discord_user_not_linked",game:resolved.game});
    }

    // Only update the game presence if online. Offline removes the current game.
    if(!online){
      const del=await sb(`/rest/v1/club_game_presence?user_id=eq.${encodeURIComponent(targetUserId)}`,{
        method:"DELETE",
        headers:{Prefer:"return=minimal"}
      });
      if(!del.ok)throw new Error(`Presence delete ${del.status}: ${await del.text()}`);
      return json(res,200,{ok:true,updated:true,online:false,game:null});
    }

    const upsert=await sb("/rest/v1/club_game_presence",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({
        user_id:targetUserId,
        game_id:resolved.game.id,
        updated_at:new Date().toISOString()
      })
    });
    if(!upsert.ok)throw new Error(`Presence upsert ${upsert.status}: ${await upsert.text()}`);

    return json(res,200,{ok:true,updated:true,online:true,game:resolved.game});
  }catch(error){
    console.error("discord presence bridge",error);
    return json(res,500,{error:error?.message||"Discord presence sync failed."});
  }
}
