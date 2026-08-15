export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});

  const url=process.env.SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId=process.env.TWITCH_CLIENT_ID;
  const accessToken=process.env.TWITCH_BOT_ACCESS_TOKEN;
  const broadcasterId=process.env.TWITCH_BROADCASTER_ID;
  const botUserId=process.env.TWITCH_BOT_USER_ID;

  if(!url||!serviceKey)return res.status(503).json({error:"Supabase is not configured."});
  if(!clientId||!accessToken||!broadcasterId||!botUserId){
    return res.status(503).json({
      error:"Twitch-Chat ist noch nicht vollständig konfiguriert.",
      missing:[
        !clientId?"TWITCH_CLIENT_ID":null,
        !accessToken?"TWITCH_BOT_ACCESS_TOKEN":null,
        !broadcasterId?"TWITCH_BROADCASTER_ID":null,
        !botUserId?"TWITCH_BOT_USER_ID":null
      ].filter(Boolean)
    });
  }

  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Unauthorized"});

  try{
    const token=auth.slice(7);
    const me=await fetch(`${url}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:`Bearer ${token}`}});
    if(!me.ok)return res.status(401).json({error:"Ungültige Admin-Sitzung."});
    const adminUser=await me.json();
    const admin=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(adminUser.id)}&select=user_id&limit=1`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}});
    if(!admin.ok||!(await admin.json()).length)return res.status(403).json({error:"Admin-Rechte erforderlich."});

    const body=typeof req.body==="object"?(req.body||{}):JSON.parse(req.body||"{}");
    const message=String(body.message||"🟣 ACY Event Hub: Twitch-Test erfolgreich.").trim().slice(0,500);
    if(!message)return res.status(400).json({error:"Nachricht fehlt."});

    const response=await fetch("https://api.twitch.tv/helix/chat/messages",{
      method:"POST",
      headers:{
        Authorization:`Bearer ${accessToken}`,
        "Client-Id":clientId,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        broadcaster_id:broadcasterId,
        sender_id:botUserId,
        message
      })
    });

    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      return res.status(response.status).json({
        error:payload?.message||payload?.error||"Twitch Chat konnte die Nachricht nicht senden.",
        twitch:payload
      });
    }

    const result=payload?.data?.[0]||{};
    return res.status(200).json({
      ok:true,
      sent:Boolean(result.is_sent),
      messageId:result.message_id||null,
      dropReason:result.drop_reason||null
    });
  }catch(error){
    console.error("twitch-chat-test",error);
    return res.status(500).json({error:error?.message||"Twitch Chat Test fehlgeschlagen."});
  }
}
