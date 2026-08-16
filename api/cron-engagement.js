
import { sendPushToUser } from './_push-utils.js';

const env = (name, fallback='') => String(process.env[name] || fallback);
const json = (res,status,payload) => res.status(status).json(payload);

function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function smtpConfigured(){
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') && env('EMAIL_FROM'));
}
function openSocket(host,port){
  return new Promise((resolve,reject)=>{
    const socket=require('node:net').connect({host,port},()=>resolve(socket));
    socket.once('error',reject);
  });
}
function tlsSocket(socket,host){
  const tls=require('node:tls');
  return new Promise((resolve,reject)=>{
    const secure=tls.connect({socket,servername:host,rejectUnauthorized:true},()=>resolve(secure));
    secure.once('error',reject);
  });
}
function waitCode(socket,codes){
  return new Promise((resolve,reject)=>{
    let buffer='';
    const onData=chunk=>{
      buffer+=chunk.toString('utf8');
      const lines=buffer.split(/\r?\n/).filter(Boolean);
      const last=lines[lines.length-1]||'';
      if(!/^\d{3} /.test(last))return;
      cleanup();
      const code=Number(last.slice(0,3));
      if(codes.includes(code))resolve(buffer);
      else reject(new Error(`SMTP ${code}`));
    };
    const onError=err=>{cleanup();reject(err)};
    const cleanup=()=>{socket.off('data',onData);socket.off('error',onError)};
    socket.on('data',onData);socket.on('error',onError);
  });
}
async function smtpSend({to,subject,text,html}){
  const host=env('SMTP_HOST');
  const port=Number(env('SMTP_PORT','587'));
  const user=env('SMTP_USER');
  let socket=await openSocket(host,port);
  try{
    await waitCode(socket,[220]);
    socket.write(`EHLO ${env('SMTP_HELO','acyjannik.de')}\r\n`);
    await waitCode(socket,[250]);
    if(port===587){
      socket.write('STARTTLS\r\n');
      await waitCode(socket,[220]);
      socket=await tlsSocket(socket,host);
      socket.write(`EHLO ${env('SMTP_HELO','acyjannik.de')}\r\n`);
      await waitCode(socket,[250]);
    }
    socket.write('AUTH LOGIN\r\n'); await waitCode(socket,[334]);
    socket.write(`${Buffer.from(user).toString('base64')}\r\n`); await waitCode(socket,[334]);
    socket.write(`${Buffer.from(env('SMTP_PASS')).toString('base64')}\r\n`); await waitCode(socket,[235]);
    socket.write(`MAIL FROM:<${user}>\r\n`); await waitCode(socket,[250]);
    socket.write(`RCPT TO:<${to}>\r\n`); await waitCode(socket,[250,251]);
    socket.write('DATA\r\n'); await waitCode(socket,[354]);
    const msg=[
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <acy-reminder-${Date.now()}-${Math.random().toString(16).slice(2)}@${user.split('@').pop()}>`,
      `From: <${user}>`,`To: <${to}>`,`Subject: ${subject}`,
      'MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: 8bit','',
      html.replace(/^\./gm,'..'),''
    ].join('\r\n');
    socket.write(msg+'\r\n.\r\n'); await waitCode(socket,[250]);
    socket.write('QUIT\r\n');
  } finally { socket.end?.(); }
}

async function sb(base,key,path,options={}){
  return fetch(`${base}${path}`,{
    ...options,
    headers:{
      apikey:key,
      Authorization:`Bearer ${key}`,
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store,max-age=0');
  if(req.method!=='GET' && req.method!=='POST') return json(res,405,{error:'GET or POST only'});
  const cronSecret=env('CRON_SECRET');
  const auth=String(req.headers.authorization||'');
  const supplied=auth.replace(/^Bearer\s+/i,'');
  if(!cronSecret || supplied!==cronSecret) return json(res,401,{error:'Unauthorized cron request.'});

  const base=env('SUPABASE_URL'), key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key) return json(res,503,{error:'Supabase service is not configured.'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  try{
    const sinceReminder=new Date(Date.now()-72*60*60*1000).toISOString();
    const inactiveSince=new Date(Date.now()-24*60*60*1000).toISOString();

    // Users who have not sent an online heartbeat in at least 24h.
    const profilesRes=await sb(base,key,'/rest/v1/profiles?select=id,display_name,username&limit=500');
    if(!profilesRes.ok) return json(res,500,{error:'Profiles konnten nicht geladen werden.'});
    const profiles=await profilesRes.json();

    const results={checked:profiles.length,sentInApp:0,sentPush:0,sentEmail:0,skipped:0,failed:0};

    for(const profile of profiles){
      const uid=profile.id;

      const [presenceRes,prefRes,recentRes] = await Promise.all([
        sb(base,key,`/rest/v1/club_online_presence?user_id=eq.${encodeURIComponent(uid)}&select=updated_at&limit=1`),
        sb(base,key,`/rest/v1/club_notification_preferences?user_id=eq.${encodeURIComponent(uid)}&select=push_enabled,email_enabled,in_app_enabled&limit=1`),
        sb(base,key,`/rest/v1/club_notifications?user_id=eq.${encodeURIComponent(uid)}&notification_type=eq.engagement_reminder&created_at=gte.${encodeURIComponent(sinceReminder)}&select=id&limit=1`)
      ]);

      if(recentRes.ok && (await recentRes.json()).length){ results.skipped++; continue; }

      const presence=presenceRes.ok ? await presenceRes.json() : [];
      const lastSeen=presence?.[0]?.updated_at ? new Date(presence[0].updated_at) : null;
      if(lastSeen && lastSeen > new Date(inactiveSince)){ results.skipped++; continue; }

      const prefRows=prefRes.ok ? await prefRes.json() : [];
      const pref=prefRows?.[0] || {};
      const inApp=pref.in_app_enabled !== false;
      const push=pref.push_enabled === true;
      const email=pref.email_enabled === true;

      if(!inApp && !push && !email){ results.skipped++; continue; }

      const name=String(profile.display_name||profile.username||'ACY Member').trim();
      const variants=[
        [`👀 ${name}, dein ACY Club wartet`,`Es gibt Neues zu entdecken. Schau kurz vorbei und hol dir deine nächsten XP.`],
        [`💜 Zeit für den ACY Club`,`Dein Fortschritt wartet nicht ewig. Ein kurzer Check-in und weiter geht's.`],
        [`🐾 Dein ACY Club hat dich vermisst`,`Pet, Quests, Achievements und Community warten auf deinen nächsten Besuch.`],
        [`🏆 Dein nächster Fortschritt ist da`,`Ein kurzer Besuch kann dir neue XP, Achievements oder Rewards bringen.`]
      ];
      const [title,body]=variants[Math.floor(Math.random()*variants.length)];
      const link='/club-profile.html';

      if(inApp){
        const r=await sb(base,key,'/rest/v1/club_notifications',{
          method:'POST',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({user_id:uid,title,body,notification_type:'engagement_reminder',link_url:link})
        });
        if(r.ok)results.sentInApp++; else results.failed++;
      }

      if(push){
        const p=await sendPushToUser({supabaseUrl:base,serviceKey:key,userId:uid,title,body,url:link,tag:'acy-engagement'});
        results.sentPush+=Number(p.sent||0);
      }

      if(email && smtpConfigured()){
        try{
          const authUserRes=await sb(base,key,`/auth/v1/admin/users/${encodeURIComponent(uid)}`);
          const authUser=authUserRes.ok?await authUserRes.json():null;
          if(authUser?.email){
            const html=`<div style="background:#09090d;padding:32px 16px;font-family:Arial,sans-serif;color:#f4f4f5">
              <div style="max-width:620px;margin:auto;background:#14131b;border:1px solid #33243f;border-radius:20px;padding:30px">
                <div style="color:#c084fc;font-size:11px;letter-spacing:.16em;font-weight:800">ACYJANNIK · ACY CLUB</div>
                <h1 style="font-size:28px;line-height:1.15;margin:12px 0 14px">${escapeHtml(title)}</h1>
                <p style="color:#b8b8c3;line-height:1.7">${escapeHtml(body)}</p>
                <a href="${env('PUBLIC_SITE_URL','https://acyjannik.de')}${link}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:700;margin-top:8px">ACY Club öffnen ↗</a>
                <p style="font-size:11px;color:#71717a;margin-top:28px">Du kannst Erinnerungen jederzeit in den Benachrichtigungseinstellungen anpassen.</p>
              </div>
            </div>`;
            await smtpSend({to:authUser.email,subject:`${title} · ACY Club`,text:body,html});
            results.sentEmail++;
          }
        }catch(e){ results.failed++; }
      }
    }
    return json(res,200,{ok:true,...results,ranAt:new Date().toISOString()});
  }catch(error){
    console.error('cron-engagement',error);
    return json(res,500,{error:error?.message||'Engagement reminder failed.'});
  }
}
