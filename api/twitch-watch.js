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
const SUPABASE_HEADERS=()=>({apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json"});
async function finalizeSession(session,userId,now){
  if(!session)return {addedMinutes:0};
  const last=new Date(session.last_heartbeat||session.started_at).getTime();
  const deltaSeconds=Math.max(0,Math.min(150,Math.floor((now.getTime()-last)/1000)));
  const previousSeconds=Math.max(0,Number(session.duration_seconds||0));
  const finalSeconds=previousSeconds+deltaSeconds;
  const addedMinutes=Math.max(0,Math.floor(finalSeconds/60)-Math.floor(previousSeconds/60));
  const url=process.env.SUPABASE_URL,headers=SUPABASE_HEADERS();
  await fetch(`${url}/rest/v1/club_twitch_stream_sessions?id=eq.${encodeURIComponent(session.id)}`,{method:"PATCH",headers,body:JSON.stringify({last_heartbeat:now.toISOString(),duration_seconds:finalSeconds,ended_at:now.toISOString(),active:false})});
  if(addedMinutes>0){
    const rpc=await fetch(`${url}/rest/v1/rpc/add_twitch_watch_time`,{method:"POST",headers,body:JSON.stringify({p_user_id:userId,p_minutes:addedMinutes,p_stream_date:session.stream_date})});
    if(!rpc.ok)console.warn("watch points RPC",await rpc.text());
  }
  return {addedMinutes,finalSeconds};
}
async function closeDuplicateSessions(rows,keepId,now){
  const url=process.env.SUPABASE_URL,headers=SUPABASE_HEADERS();
  for(const row of rows||[]){
    if(String(row.id)===String(keepId))continue;
    await fetch(`${url}/rest/v1/club_twitch_stream_sessions?id=eq.${encodeURIComponent(row.id)}`,{method:"PATCH",headers,body:JSON.stringify({active:false,ended_at:now.toISOString()})});
  }
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(!["POST","DELETE"].includes(req.method))return json(res,405,{error:"POST or DELETE only"});
  const user=await authUser(req);
  if(!user?.id)return json(res,401,{error:"Nicht angemeldet."});
  const url=process.env.SUPABASE_URL,headers=SUPABASE_HEADERS();
  try{
    const activeResponse=await fetch(`${url}/rest/v1/club_twitch_stream_sessions?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=id,stream_id,stream_date,last_heartbeat,started_at,duration_seconds&order=started_at.asc`,{headers});
    const activeRows=activeResponse.ok?(await activeResponse.json()):[];
    const now=new Date();

    if(req.method==="DELETE"){
      if(activeRows.length){
        const primary=activeRows[0];
        await finalizeSession(primary,user.id,now);
        await closeDuplicateSessions(activeRows,primary.id,now);
      }
      return json(res,200,{ok:true});
    }

    const stream=await getStream();
    if(!stream){
      if(activeRows.length){
        const primary=activeRows[0];
        await finalizeSession(primary,user.id,now);
        await closeDuplicateSessions(activeRows,primary.id,now);
      }
      const points=await fetch(`${url}/rest/v1/club_twitch_points?user_id=eq.${encodeURIComponent(user.id)}&select=watch_minutes,watch_points,stream_days,current_stream_streak,best_stream_streak&limit=1`,{headers});
      return json(res,200,{ok:true,live:false,points:points.ok?(await points.json())[0]||{}:{}});
    }

    let row=activeRows.find(r=>String(r.stream_id||"")===String(stream.id||""))||null;
    if(activeRows.length>1)await closeDuplicateSessions(activeRows,row?.id||activeRows[0].id,now);
    if(!row && activeRows.length)await finalizeSession(activeRows[0],user.id,now);

    let addedMinutes=0;
    if(row){
      const last=new Date(row.last_heartbeat||row.started_at).getTime();
      const deltaMs=Math.max(0,Math.min(150000,now.getTime()-last));
      const previousSeconds=Math.max(0,Number(row.duration_seconds||0));
      const newSeconds=previousSeconds+Math.floor(deltaMs/1000);
      addedMinutes=Math.max(0,Math.floor(newSeconds/60)-Math.floor(previousSeconds/60));
      await fetch(`${url}/rest/v1/club_twitch_stream_sessions?id=eq.${encodeURIComponent(row.id)}`,{method:"PATCH",headers,body:JSON.stringify({last_heartbeat:now.toISOString(),duration_seconds:newSeconds,active:true})});
    }else{
      const created=await fetch(`${url}/rest/v1/club_twitch_stream_sessions`,{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({user_id:user.id,stream_id:String(stream.id||""),stream_date:new Date(stream.started_at||now).toISOString().slice(0,10),started_at:now.toISOString(),last_heartbeat:now.toISOString(),active:true,duration_seconds:0})});
      if(!created.ok)return json(res,500,{error:"Twitch-Session konnte nicht gestartet werden."});
    }

    if(addedMinutes>0){
      const rpc=await fetch(`${url}/rest/v1/rpc/add_twitch_watch_time`,{method:"POST",headers,body:JSON.stringify({p_user_id:user.id,p_minutes:addedMinutes,p_stream_date:new Date(stream.started_at||now).toISOString().slice(0,10)})});
      if(!rpc.ok)console.warn("watch points RPC",await rpc.text());
    }

    const points=await fetch(`${url}/rest/v1/club_twitch_points?user_id=eq.${encodeURIComponent(user.id)}&select=watch_minutes,watch_points,stream_days,current_stream_streak,best_stream_streak&limit=1`,{headers});
    return json(res,200,{ok:true,live:true,stream:{id:stream.id,game:stream.game_name,title:stream.title,viewerCount:stream.viewer_count,startedAt:stream.started_at},points:points.ok?(await points.json())[0]||{}:{}});
  }catch(error){return json(res,500,{error:error?.message||"Twitch Watch Tracking fehlgeschlagen."});}
}
