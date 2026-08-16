export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});

  const supabaseUrl=process.env.SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhook=process.env.DISCORD_EVENT_WEBHOOK_URL||"";
  if(!supabaseUrl||!serviceKey)return res.status(503).json({error:"Discord Feed is not configured."});
  if(!webhook)return res.status(503).json({error:"DISCORD_EVENT_WEBHOOK_URL is not configured."});

  const allowed=new Set([
    "friend_accepted",
    "achievement_unlocked",
    "reward_rare",
    "daily_streak_milestone",
    "wheel_rare_reward"
  ]);

  try{
    const auth=req.headers.authorization||"";
    if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Unauthorized"});

    const token=auth.slice(7);
    const meResponse=await fetch(`${supabaseUrl}/auth/v1/user`,{
      headers:{apikey:serviceKey,Authorization:`Bearer ${token}`}
    });
    if(!meResponse.ok)return res.status(401).json({error:"Invalid session."});
    const user=await meResponse.json();

    const body=typeof req.body==="object"?(req.body||{}):JSON.parse(req.body||"{}");
    const eventType=String(body.eventType||"").trim();
    const payload=body.payload&&typeof body.payload==="object"?body.payload:{};
    const dedupeKey=String(body.dedupeKey||"").trim().slice(0,180);

    if(!allowed.has(eventType))return res.status(400).json({error:"Event type is not allowed."});
    if(dedupeKey && !/^[a-zA-Z0-9._:-]+$/.test(dedupeKey))return res.status(400).json({error:"Invalid dedupe key."});

    // Gentle anti-spam guard: max 10 community events per user per hour.
    const recent=await fetch(
      `${supabaseUrl}/rest/v1/club_discord_feed_log?select=id&user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(new Date(Date.now()-3600000).toISOString())}`,
      {headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}}
    );
    if(recent.ok){
      const rows=await recent.json();
      if(Array.isArray(rows)&&rows.length>=10)return res.status(429).json({error:"Discord feed rate limit reached."});
    }

    if(dedupeKey){
      const existing=await fetch(
        `${supabaseUrl}/rest/v1/club_discord_feed_log?event_type=eq.${encodeURIComponent(eventType)}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`,
        {headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}}
      );
      if(existing.ok && (await existing.json()).length)return res.status(200).json({ok:true,duplicate:true});
    }

    const profileRes=await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=username,display_name,avatar_url&limit=1`,
      {headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}}
    );
    const profileRows=profileRes.ok?await profileRes.json():[];
    const profile=profileRows?.[0]||{};
    const name=String(payload.displayName||profile.display_name||profile.username||"ACY Member").slice(0,80);

    const config={
      friend_accepted:{
        title:"Neue Freundschaft 💜",
        description:`${name} hat eine neue Freundschaft im ACY Club geschlossen.`,
        color:0xa855f7
      },
      achievement_unlocked:{
        title:"Achievement freigeschaltet 🏆",
        description:`${name} hat ${String(payload.achievement||"ein Achievement").slice(0,100)} freigeschaltet.`,
        color:0xf0abfc
      },
      reward_rare:{
        title:"Seltener Reward 🎁",
        description:`${name} hat ${String(payload.reward||"einen seltenen Reward").slice(0,100)} erhalten.`,
        color:0xc084fc
      },
      daily_streak_milestone:{
        title:"Streak-Meilenstein 🔥",
        description:`${name} hält jetzt eine ${Number(payload.days||0)}-Tage-Serie.`,
        color:0xf59e0b
      },
      wheel_rare_reward:{
        title:"Glücksrad! 🎡",
        description:`${name} hat ${String(payload.reward||"einen seltenen Gewinn").slice(0,100)} gezogen.`,
        color:0x8b5cf6
      }
    }[eventType];

    const embed={
      title:config.title,
      description:config.description,
      color:config.color,
      timestamp:new Date().toISOString(),
      footer:{text:"ACY Club · Community Feed"}
    };
    if(profile.avatar_url)embed.thumbnail={url:String(profile.avatar_url).slice(0,500)};

    const discord=await fetch(webhook,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        username:"ACY Club",
        embeds:[embed],
        allowed_mentions:{parse:[]}
      })
    });
    const discordSent=discord.ok;

    await fetch(`${supabaseUrl}/rest/v1/club_discord_feed_log`,{
      method:"POST",
      headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({
        user_id:user.id,event_type:eventType,dedupe_key:dedupeKey||null,
        payload,discord_sent:discordSent
      })
    });

    if(!discordSent){
      const txt=await discord.text().catch(()=> "");
      return res.status(502).json({error:`Discord webhook failed: ${txt||discord.status}`});
    }
    return res.status(200).json({ok:true,discordSent:true});
  }catch(error){
    console.error("discord-feed",error);
    return res.status(500).json({error:error?.message||"Discord feed failed."});
  }
}
