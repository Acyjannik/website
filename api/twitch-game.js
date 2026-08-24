let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;

  const clientId = process.env.TWITCH_CLIENT_ID || "";
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Twitch API ist nicht konfiguriert.");

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    })
  });
  if (!response.ok) throw new Error(`Twitch OAuth ${response.status}: ${await response.text()}`);
  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Number(data.expires_in || 0) * 1000;
  return cachedToken;
}

function json(res,status,payload){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(payload));
}

function isInternal(req){
  const header=String(req.headers["x-acy-game-secret"]||"");
  const secret=String(process.env.ACY_GAME_DISCOVERY_SECRET||"");
  return Boolean(secret && header && header===secret);
}

function normalizeName(value){
  return String(value||"").trim().replace(/\s+/g," ").slice(0,180);
}

function coverUrl(boxArtUrl,width=600,height=800){
  return String(boxArtUrl||"").replace("{width}",String(width)).replace("{height}",String(height));
}

async function supabaseFetch(path,options={}){
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

async function resolveFromTwitch(name){
  const clientId=process.env.TWITCH_CLIENT_ID||"";
  const token=await getAppAccessToken();
  const response=await fetch(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(name)}`,{
    headers:{Authorization:`Bearer ${token}`,"Client-Id":clientId}
  });
  if(!response.ok)throw new Error(`Twitch Games ${response.status}: ${await response.text()}`);
  const payload=await response.json();
  return payload.data?.[0]||null;
}

export default async function handler(req,res){
  if(req.method!=="POST") return json(res,405,{error:"POST only"});
  if(!isInternal(req)) return json(res,403,{error:"Internal game discovery access required."});

  try{
    const body=typeof req.body==="object"?(req.body||{}):JSON.parse(req.body||"{}");
    const gameName=normalizeName(body.gameName);
    if(!gameName) return json(res,400,{error:"gameName fehlt."});

    const twitchGame=await resolveFromTwitch(gameName);

    if(!twitchGame){
      return json(res,200,{
        ok:true,
        discovered:false,
        reason:"twitch_game_not_found",
        gameName
      });
    }

    const record={
      name:twitchGame.name,
      description:"Automatisch erkannt · Community",
      tag:"COMMUNITY",
      image_url:coverUrl(twitchGame.box_art_url),
      featured:false,
      enabled:true,
      sort_order:1000,
      twitch_game_id:String(twitchGame.id),
      igdb_id:twitchGame.igdb_id?String(twitchGame.igdb_id):null,
      discovered_source:"twitch",
      discovered_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };

    // Match by Twitch ID first, then by the unique game name. This prevents
    // duplicate-name 409s when a game was already created manually.
    const existingRes=await supabaseFetch(
      `/rest/v1/games?or=(twitch_game_id.eq.${encodeURIComponent(String(twitchGame.id))},name.eq.${encodeURIComponent(record.name)})&select=id,name,twitch_game_id,discovered_at&limit=1`
    );
    if(!existingRes.ok)throw new Error(`Supabase lookup ${existingRes.status}: ${await existingRes.text()}`);
    const existing=(await existingRes.json())[0];

    let gameId=existing?.id||null;
    if(existing){
      const updateRes=await supabaseFetch(`/rest/v1/games?id=eq.${encodeURIComponent(existing.id)}`,{
        method:"PATCH",
        headers:{Prefer:"return=representation"},
        body:JSON.stringify({
          name:record.name,
          description:record.description,
          tag:record.tag,
          image_url:record.image_url,
          enabled:true,
          sort_order:record.sort_order,
          twitch_game_id:record.twitch_game_id,
          igdb_id:record.igdb_id,
          discovered_source:record.discovered_source,
          discovered_at:existing.discovered_at||record.discovered_at,
          updated_at:record.updated_at
        })
      });
      if(!updateRes.ok)throw new Error(`Supabase update ${updateRes.status}: ${await updateRes.text()}`);
    }else{
      const insertRes=await supabaseFetch("/rest/v1/games",{
        method:"POST",
        headers:{Prefer:"return=representation"},
        body:JSON.stringify(record)
      });
      if(!insertRes.ok){
        const txt=await insertRes.text();
        if(insertRes.status===409){
          const retry=await supabaseFetch(`/rest/v1/games?or=(twitch_game_id.eq.${encodeURIComponent(record.twitch_game_id)},name.eq.${encodeURIComponent(record.name)})&select=id&limit=1`);
          if(retry.ok)gameId=(await retry.json())[0]?.id||null;
        }else{
          throw new Error(`Supabase insert ${insertRes.status}: ${txt}`);
        }
      }else{
        gameId=(await insertRes.json())[0]?.id||null;
      }
    }

    return json(res,200,{
      ok:true,
      discovered:true,
      created:!existing,
      game:{
        id:gameId,
        name:twitchGame.name,
        twitchGameId:String(twitchGame.id),
        igdbId:twitchGame.igdb_id?String(twitchGame.igdb_id):null,
        imageUrl:coverUrl(twitchGame.box_art_url)
      }
    });
  }catch(error){
    console.error("twitch-game discovery",error);
    return json(res,500,{error:error?.message||"Game discovery failed."});
  }
}
