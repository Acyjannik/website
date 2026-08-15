export default async function handler(_req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  const fallback={
    events:[{id:"fallback",title:"Fortnite Community Night",description:"Gemeinsame Runden mit der ACY Community.",event_date:"2026-08-16T20:30:00+02:00",location:"Twitch",twitch_url:"https://www.twitch.tv/acyjannik",enabled:true}],
    news:[{id:"fallback",title:"Willkommen im ACY Club",body:"Der ACY Club ist jetzt live. Mehr Community-Funktionen folgen nach und nach.",published_at:new Date().toISOString(),enabled:true}]
  };
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
  if(!url||!key)return res.status(200).json({...fallback,source:"fallback"});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  async function rows(path){
    const r=await fetch(`${url}/rest/v1/${path}`,{headers,cache:"no-store"});
    const t=await r.text(); if(!r.ok)throw new Error(`${r.status}: ${t}`);
    return t?JSON.parse(t):[];
  }
  try{
    const [events,news]=await Promise.all([
      rows("club_events?select=*&enabled=eq.true&order=event_date.asc&limit=8"),
      rows("club_news?select=*&enabled=eq.true&order=published_at.desc&limit=8")
    ]);
    return res.status(200).json({events:events.length?events:fallback.events,news:news.length?news:fallback.news,source:"supabase"});
  }catch(e){console.error(e);return res.status(200).json({...fallback,source:"fallback-error"});}
}
