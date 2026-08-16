function json(res,status,p){res.status(status).json(p);}
async function authUser(req){
  const auth=String(req.headers.authorization||"");
  if(!auth.startsWith("Bearer "))return null;
  const r=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:auth}});
  return r.ok?await r.json():null;
}
async function getStream(){
  const clientId=process.env.TWITCH_CLIENT_ID||"", secret=process.env.TWITCH_CLIENT_SECRET||"";
  if(!clientId||!secret)return null;
  const tr=await fetch("https://id.twitch.tv/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:"client_credentials"})});
  if(!tr.ok)return null;
  const tk=await tr.json();
  const r=await fetch("https://api.twitch.tv/helix/streams?user_login=acyjannik",{headers:{Authorization:`Bearer ${tk.access_token}`,"Client-Id":clientId}});
  if(!r.ok)return null;
  return (await r.json()).data?.[0]||null;
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(!["POST","DELETE"].includes(req.method))return json(res,405,{error:"POST or DELETE only"});
  const user=await authUser(req);
  if(!user?.id)return json(res,401,{error:"Nicht angemeldet."});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  try{
    if(req.method==="DELETE"){
      await fetch(`${url}/rest/v1/club_twitch_stream_sessions?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`,{
        method:"PATCH",headers,body:JSON.stringify({active:false,ended_at:new Date().toISOString()})
      });
      return json(res,200,{ok:true});
    }
    const stream=await getStream();
    if(!stream)return json(res,200,{ok:true,live:false});
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const now=new Date();
    const existing=await fetch(`${url}/rest/v1/club_twitch_stream_sessions?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=id,last_heartbeat,started_at,duration_seconds&limit=1`,{headers});
    const row=existing.ok?(await existing.json())[0]:null;
    let addedMinutes=0;
    if(row){
      const last=new Date(row.last_heartbeat).getTime();
      const delta=Math.max(0,Math.min(90_000,now.getTime()-last));
      addedMinutes=Math.floor(delta/60000);
      await fetch(`${url}/rest/v1/club_twitch_stream_sessions?id=eq.${encodeURIComponent(row.id)}`,{
        method:"PATCH",headers,body:JSON.stringify({last_heartbeat:now.toISOString(),duration_seconds:Number(row.duration_seconds||0)+Math.floor(delta/1000)})
      });
    }else{
      await fetch(`${url}/rest/v1/club_twitch_stream_sessions`,{
        method:"POST",headers:{...headers,Prefer:"return=minimal"},
        body:JSON.stringify({user_id:user.id,stream_id:String(stream.id||""),stream_date:new Date(stream.started_at||now).toISOString().slice(0,10),started_at:now.toISOString(),last_heartbeat:now.toISOString(),active:true})
      });
    }
    if(addedMinutes>0){
      const rpc=await fetch(`${url}/rest/v1/rpc/add_twitch_watch_time`,{
        method:"POST",headers,body:JSON.stringify({p_user_id:user.id,p_minutes:addedMinutes,p_stream_date:new Date(stream.started_at||now).toISOString().slice(0,10)})
      });
      if(!rpc.ok)console.warn("watch points RPC",await rpc.text());
    }
    const points=await fetch(`${url}/rest/v1/club_twitch_points?user_id=eq.${encodeURIComponent(user.id)}&select=watch_minutes,watch_points,stream_days,current_stream_streak,best_stream_streak&limit=1`,{headers});
    return json(res,200,{ok:true,live:true,stream:{id:stream.id,game:stream.game_name,title:stream.title,viewerCount:stream.viewer_count,startedAt:stream.started_at},points:points.ok?(await points.json())[0]||{}:{}});
  }catch(error){return json(res,500,{error:error?.message||"Twitch Watch Tracking fehlgeschlagen."});}
}
