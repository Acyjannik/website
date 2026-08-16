export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});

  const url=process.env.SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey) return res.status(503).json({error:"Attendance service is not configured."});

  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer ")) return res.status(401).json({error:"Unauthorized"});
  const token=auth.slice(7);
  const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
  const eventId=Number(body.eventId), action=body.action==="leave"?"leave":"join";
  if(!Number.isInteger(eventId)||eventId<=0) return res.status(400).json({error:"Invalid eventId"});

  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:`Bearer ${token}`}});
    if(!who.ok) return res.status(401).json({error:"Invalid session."});
    const user=await who.json();

    const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"};

    const eventRes=await fetch(`${url}/rest/v1/club_events?id=eq.${eventId}&select=id,title,event_date,enabled&limit=1`,{headers});
    if(!eventRes.ok) return res.status(500).json({error:`Event konnte nicht geprüft werden (${eventRes.status}).`});
    const eventRows=await eventRes.json();
    const event=eventRows?.[0];
    if(!event) return res.status(404).json({error:"Event nicht gefunden."});
    if(event.enabled!==true) return res.status(410).json({error:"Dieses Event ist nicht mehr aktiv."});
    const eventTime=new Date(event.event_date).getTime();
    if(Number.isFinite(eventTime) && eventTime<Date.now()) return res.status(410).json({error:"Dieses Event ist bereits vorbei."});

    if(action==="join"){
      const r=await fetch(`${url}/rest/v1/club_event_attendance`,{
        method:"POST",headers,
        body:JSON.stringify({event_id:eventId,user_id:user.id})
      });
      if(!r.ok && r.status!==409) {
        const t=await r.text(); return res.status(500).json({error:t||"Could not join event."});
      }

      // Award once through the existing progression function.
      const rpc=await fetch(`${url}/rest/v1/rpc/award_club_xp`,{
        method:"POST",headers,
        body:JSON.stringify({p_user_id:user.id,p_event_key:`event_attended_${eventId}`,p_xp:100})
      });
      if(!rpc.ok){
        const t=await rpc.text(); console.error("XP award:",t);
      }
    } else {
      const existingAttendance=await fetch(`${url}/rest/v1/club_event_attendance?event_id=eq.${eventId}&user_id=eq.${user.id}&select=id&limit=1`,{headers});
      if(!existingAttendance.ok) return res.status(500).json({error:`Teilnahme konnte nicht geprüft werden (${existingAttendance.status}).`});
      const hadAttendance=(await existingAttendance.json()).length>0;

      const r=await fetch(`${url}/rest/v1/club_event_attendance?event_id=eq.${eventId}&user_id=eq.${user.id}`,{
        method:"DELETE",headers
      });
      if(!r.ok){
        const t=await r.text(); return res.status(500).json({error:t||"Could not leave event."});
      }

      // Reverse the one-time attendance XP only when the attendance record existed.
      if(hadAttendance){
        const rpc=await fetch(`${url}/rest/v1/rpc/revoke_club_xp`,{
          method:"POST",headers,
          body:JSON.stringify({p_user_id:user.id,p_event_key:`event_attended_${eventId}`,p_xp:100})
        });
        if(!rpc.ok){
          const t=await rpc.text();
          console.error("XP revoke:",t);
        }
      }
    }

    const notificationPayload = action === "join"
      ? {
          user_id: user.id,
          title: "Du bist dabei! 🎮",
          body: `Deine Teilnahme an Event #${eventId} wurde gespeichert. Du erhältst 100 XP.`,
          notification_type: "event",
          link_url: "/club-profile.html"
        }
      : {
          user_id: user.id,
          title: "Event-Teilnahme beendet",
          body: `Du hast die Teilnahme an Event #${eventId} beendet. Die 100 XP wurden entfernt.`,
          notification_type: "event",
          link_url: "/club-profile.html"
        };

    await fetch(`${url}/rest/v1/club_notifications`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(notificationPayload)
    });

    const countRes=await fetch(`${url}/rest/v1/club_event_attendance?event_id=eq.${eventId}&select=id`,{headers:{
      apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,Prefer:"count=exact"
    }});
    const count=parseInt(countRes.headers.get("content-range")?.split("/")?.[1]||"0",10);

    return res.status(200).json({eventId,action,attending:action==="join",count:Number.isFinite(count)?count:0});
  }catch(e){
    console.error(e); return res.status(500).json({error:"Attendance service failed."});
  }
}
