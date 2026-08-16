export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  const fallback={
    events:[],
    news:[{id:"fallback",title:"Willkommen im ACY Club",body:"Der ACY Club ist jetzt live. Mehr Community-Funktionen folgen nach und nach.",published_at:new Date().toISOString(),enabled:true}]
  };
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(200).json({...fallback,source:"fallback"});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  let userId=null;
  const auth=req.headers.authorization||"";
  if(auth.startsWith("Bearer ")){
    try{
      const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
      if(r.ok){const u=await r.json();userId=u.id;}
    }catch{}
  }
  async function rows(path, opts={}){
    const r=await fetch(`${url}/rest/v1/${path}`,{headers:{...headers,...opts.headers},cache:"no-store"});
    const t=await r.text(); if(!r.ok)throw new Error(`${r.status}: ${t}`);
    return t?JSON.parse(t):[];
  }
  try{
    const events=await rows("club_events?select=*&enabled=eq.true&event_date=gte."+encodeURIComponent(new Date().toISOString())+"&order=event_date.asc&limit=8");
    const news=await rows("club_news?select=*&enabled=eq.true&order=published_at.desc&limit=8");

    for(const event of events){
      try{
        const attendees=await rows(`club_event_attendance?event_id=eq.${event.id}&select=user_id`);
        event.attendee_count = attendees.length;
        event.user_attending = !!userId && attendees.some(a => String(a.user_id) === String(userId));
      }catch(attendanceError){
        console.warn('Event attendance data unavailable:', attendanceError?.message||attendanceError);
        event.attendee_count = 0;
        event.user_attending = false;
      }
    }

    return res.status(200).json({
      events:events||[],
      news:news.length?news:fallback.news,
      source:"supabase"
    });
  }catch(e){
    console.error(e);
    return res.status(200).json({...fallback,source:"fallback-error"});
  }
}
