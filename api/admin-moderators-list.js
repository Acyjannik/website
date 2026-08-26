import { requireAdminAAL2 } from './_admin-auth.js';

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const authz=await requireAdminAAL2(req);
  if(!authz.ok)return res.status(authz.status).json({error:authz.error});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:"Service not configured."});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  try{
    const r=await fetch(`${url}/rest/v1/club_moderators?select=user_id,granted_by,created_at&order=created_at.asc`,{headers});
    if(!r.ok)return res.status(500).json({error:await r.text()});
    return res.status(200).json({moderators:await r.json()});
  }catch(error){return res.status(500).json({error:error?.message||"Moderatoren konnten nicht geladen werden."});}
}
