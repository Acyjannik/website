export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  const secret=process.env.TWITCH_EVENTSUB_SECRET||"";

  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  const messageType=req.headers["twitch-eventsub-message-type"]||"";
  const signature=req.headers["twitch-eventsub-message-signature"]||"";
  const messageId=req.headers["twitch-eventsub-message-id"]||"";
  const timestamp=req.headers["twitch-eventsub-message-timestamp"]||"";
  const raw=typeof req.body==="string"?req.body:JSON.stringify(req.body||{});

  // Twitch EventSub requires signature validation. We intentionally fail closed
  // if the secret is not configured.
  if(!secret)return res.status(503).json({error:"TWITCH_EVENTSUB_SECRET is not configured."});
  try{
    const crypto=await import("node:crypto");
    const hmac=crypto.createHmac("sha256",secret);
    hmac.update(String(messageId)+String(timestamp)+raw);
    const expected="sha256="+hmac.digest("hex");
    if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(signature)))) {
      return res.status(403).json({error:"Invalid EventSub signature."});
    }
  }catch{return res.status(403).json({error:"Invalid EventSub signature."});}

  const message=req.body||{};
  if(messageType==="webhook_callback_verification"){
    return res.status(200).send(message.challenge||"");
  }

  if(messageType==="notification"){
    const type=message?.subscription?.type;
    const event=message?.event||{};
    let eventType=null;
    let title=null;
    let text=null;

    if(type==="stream.online"){
      eventType="stream_online";
      title="ACYJANNIK ist live";
      text=`🔴 ACYJANNIK ist LIVE! 🎮 Schaut jetzt im Stream vorbei.`;
    }else if(type==="stream.offline"){
      eventType="stream_offline";
      title="ACYJANNIK ist offline";
      text=`⚫ ACYJANNIK ist jetzt offline.`;
    }

    if(eventType){
      const site=process.env.PUBLIC_SITE_URL||"";
      const internalSecret=process.env.CLUB_EVENT_HUB_SECRET||"";
      if(site&&internalSecret){
        const eventPayload={
          message:text,
          broadcasterUserId:event?.broadcaster_user_id||null,
          startedAt:event?.started_at||null
        };
        await fetch(`${site}/api/club-event-hub`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({internalSecret,eventType,title,payload:eventPayload})
        }).catch(()=>{});
        await fetch(`${site}/api/club-notification-email`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({internalSecret,type:"live",title,body:text,linkUrl:"/"})
        }).catch(()=>{});
      }
    }
  }

  return res.status(204).end();
}
