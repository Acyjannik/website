export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');
  if(req.method!=='GET') return res.status(405).json({error:'GET only'});
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:'Service not configured.'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Nicht angemeldet.'});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  try{
    const who=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth}});
    if(!who.ok)return res.status(401).json({error:'Ungültige Sitzung.'});
    const user=await who.json();
    const [adminRes,modRes,profileRes]=await Promise.all([
      fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers}),
      fetch(`${url}/rest/v1/club_moderators?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{headers}),
      fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,display_name,avatar_url,badges&limit=1`,{headers})
    ]);
    const isAdmin=adminRes.ok && (await adminRes.json()).length>0;
    const isModerator=modRes.ok && (await modRes.json()).length>0;
    const profile=profileRes.ok ? (await profileRes.json())[0] : null;

    // Streamer access intentionally stays server-side. No SQL migration is needed:
    // admins are streamers by default; additional streamer accounts can be listed in
    // Vercel's ACY_STREAMER_USERNAMES env var as a comma-separated allowlist.
    // The profile username is only evaluated after Supabase has authenticated the user.
    const configured=(process.env.ACY_STREAMER_USERNAMES||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
    const username=(profile?.username||'').trim().toLowerCase();
    const defaultStreamer=username==='acyjannik';
    const isStreamer=isAdmin || configured.includes(username) || defaultStreamer;

    return res.status(200).json({
      ok:true,
      userId:user.id,
      isAdmin,
      isModerator:isModerator||isAdmin,
      isStreamer,
      role:isAdmin?'admin':(isModerator?'mod':(isStreamer?'streamer':'member')),
      profile
    });
  }catch(error){return res.status(500).json({error:error?.message||'Rollenprüfung fehlgeschlagen.'});}
}
