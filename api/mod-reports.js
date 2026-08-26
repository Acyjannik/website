import { requireStaffAAL2 } from './_staff-auth.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');
  const authz=await requireStaffAAL2(req);
  if(!authz.ok)return res.status(authz.status).json({error:authz.error});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  try{
    if(req.method==='GET'){
      const r=await fetch(`${url}/rest/v1/club_reports?select=*&order=created_at.desc&limit=100`,{headers}); if(!r.ok)return res.status(500).json({error:await r.text()});
      const rows=await r.json(); const ids=[...new Set(rows.flatMap(x=>[x.reporter_id,x.target_user_id]).filter(Boolean))];
      const map=new Map(); if(ids.length){const pr=await fetch(`${url}/rest/v1/profiles?select=id,username,display_name,avatar_url&id=in.(${ids.map(encodeURIComponent).join(',')})`,{headers}); if(pr.ok){for(const p of await pr.json())map.set(p.id,p);}}
      return res.status(200).json({reports:rows.map(r=>({...r,reporter:map.get(r.reporter_id)||null,target:map.get(r.target_user_id)||null}))});
    }
    if(req.method==='PATCH'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); const id=String(body.id||''); const action=String(body.action||'');
      if(!id)return res.status(400).json({error:'Report-ID fehlt.'});
      const reportRes=await fetch(`${url}/rest/v1/club_reports?id=eq.${encodeURIComponent(id)}&select=*`,{headers}); if(!reportRes.ok)return res.status(500).json({error:'Report konnte nicht geladen werden.'});
      const rows=await reportRes.json(); const report=rows?.[0]; if(!report)return res.status(404).json({error:'Report nicht gefunden.'});
      if(action==='mute24' && report.target_user_id){
        const mute=await fetch(`${url}/rest/v1/club_chat_bans`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:report.target_user_id,banned_until:new Date(Date.now()+24*3600*1000).toISOString(),reason:report.reason,created_by:authz.userId})});
        if(!mute.ok)return res.status(500).json({error:await mute.text()});
      }
      const status=action==='ignore'?'ignored':action==='warn'?'warned':action==='escalate'?'escalated':'reviewed';
      const patch=await fetch(`${url}/rest/v1/club_reports?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({status,handled_at:new Date().toISOString(),handled_by:authz.userId,moderator_note:String(body.note||'').slice(0,500)})});
      if(!patch.ok)return res.status(500).json({error:await patch.text()});
      if(action==='warn' && report.target_user_id){await fetch(`${url}/rest/v1/club_notifications`,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({user_id:report.target_user_id,title:'Hinweis der Moderation',body:'Deine Aktivität wurde von der ACY Moderation geprüft.',notification_type:'system',link_url:'/club-profile.html#club-chat'})});}
      return res.status(200).json({ok:true,status});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(error){return res.status(500).json({error:error?.message||'Moderationsdienst fehlgeschlagen.'});}
}
