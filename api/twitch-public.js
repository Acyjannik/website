function json(res,status,p){res.status(status).json(p);}
async function auth(req){
  const a=String(req.headers.authorization||"");
  if(!a.startsWith("Bearer "))return null;
  const r=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:a}});
  return r.ok?(await r.json()):null;
}
export default async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"GET only"});
  const user=await auth(req); if(!user?.id)return json(res,401,{error:"Nicht angemeldet."});
  const id=String(req.query?.userId||""); if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:"Invalid userId"});
  const h={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`};
  try{
    const accountR=await fetch(`${process.env.SUPABASE_URL}/rest/v1/club_twitch_accounts?user_id=eq.${encodeURIComponent(id)}&select=login,display_name&limit=1`,{headers:h});
    if(!accountR.ok)throw new Error(await accountR.text());
    const account=(await accountR.json())[0];
    if(!account)return json(res,200,{connected:false});
    const pointsR=await fetch(`${process.env.SUPABASE_URL}/rest/v1/club_twitch_points?user_id=eq.${encodeURIComponent(id)}&select=watch_minutes,watch_points,current_stream_streak&limit=1`,{headers:h});
    const p=pointsR.ok?(await pointsR.json())[0]||{}:{};
    return json(res,200,{connected:true,login:account.login,displayName:account.display_name,watchMinutes:Number(p.watch_minutes||0),watchPoints:Number(p.watch_points||0),currentStreak:Number(p.current_stream_streak||0)});
  }catch(e){return json(res,500,{error:e?.message||"Twitch public profile failed."});}
}
