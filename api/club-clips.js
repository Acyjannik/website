export default async function handler(_req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return res.status(200).json({clips:[],source:"fallback"});
  try{
    const r=await fetch(`${url}/rest/v1/club_clips?select=*&enabled=eq.true&order=published_at.desc&limit=12`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"
    });
    const t=await r.text();
    if(!r.ok) throw new Error(t);
    return res.status(200).json({clips:t?JSON.parse(t):[],source:"supabase"});
  }catch(e){
    console.error("club-clips",e);
    return res.status(200).json({clips:[],source:"fallback-error"});
  }
}
