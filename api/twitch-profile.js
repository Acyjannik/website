function json(res,status,p){res.status(status).json(p);}
async function getUser(req){
  const auth=String(req.headers.authorization||"");
  if(!auth.startsWith("Bearer "))return null;
  const r=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{
    headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:auth}
  });
  return r.ok?await r.json():null;
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(!["GET","DELETE"].includes(req.method))return json(res,405,{error:"GET or DELETE only"});
  const user=await getUser(req);
  if(!user?.id)return json(res,401,{error:"Nicht angemeldet."});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  try{
    if(req.method==="DELETE"){
      const del=await fetch(`${url}/rest/v1/club_twitch_accounts?user_id=eq.${encodeURIComponent(user.id)}`,{method:"DELETE",headers});
      if(!del.ok)throw new Error(await del.text());
      return json(res,200,{ok:true,connected:false});
    }
    const r=await fetch(`${url}/rest/v1/club_twitch_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=twitch_user_id,login,display_name,profile_image_url,connected_at&limit=1`,{headers});
    if(!r.ok)throw new Error(await r.text());
    const account=(await r.json())[0]||null;
    if(!account)return json(res,200,{connected:false});
    const pointsRes=await fetch(`${url}/rest/v1/club_twitch_points?user_id=eq.${encodeURIComponent(user.id)}&select=watch_minutes,watch_points,stream_days,current_stream_streak,best_stream_streak&limit=1`,{headers});
    const points=pointsRes.ok?(await pointsRes.json())[0]||{}:{};
    return json(res,200,{connected:true,account,points});
  }catch(error){return json(res,500,{error:error?.message||"Twitch-Profil konnte nicht geladen werden."});}
}
