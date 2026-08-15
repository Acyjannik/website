export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="GET") return res.status(405).json({error:"GET only"});

  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return res.status(503).json({error:"Member profile service is not configured."});

  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer ")) return res.status(401).json({error:"Unauthorized"});
  const token=auth.slice(7);

  const id=String(req.query?.id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({error:"Invalid member id"});

  try{
    const me=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
    if(!me.ok) return res.status(401).json({error:"Invalid session."});

    const r=await fetch(`${url}/rest/v1/profiles?select=id,username,display_name,bio,avatar_url,created_at,xp,badges,discord_connected&id=eq.${id}&limit=1`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"
    });
    const t=await r.text();
    if(!r.ok)return res.status(500).json({error:t||"Could not load member."});
    const rows=t?JSON.parse(t):[];
    if(!rows.length)return res.status(404).json({error:"Member not found."});

    const p=rows[0];
    return res.status(200).json({
      member:{
        id:p.id,
        username:p.username,
        display_name:p.display_name||p.username,
        bio:p.bio||"",
        avatar_url:p.avatar_url||"",
        created_at:p.created_at,
        xp:Number(p.xp||0),
        badges:Array.isArray(p.badges)?p.badges.slice(0,8):[],
        discord_connected:!!p.discord_connected
      }
    });
  }catch(e){
    console.error(e); return res.status(500).json({error:"Member profile failed."});
  }
}
