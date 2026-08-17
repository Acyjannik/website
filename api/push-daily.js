import { sendPushToUser } from './_push-utils.js';

const json = (res, status, payload) => res.status(status).json(payload);
const env = (name, fallback = '') => String(process.env[name] || fallback);

async function sb(base, key, path, options = {}) {
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function getAdminFromBearer(base, key, authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const userRes = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization }
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const adminRes = await sb(base, key, `/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  if (!adminRes.ok) return null;
  const rows = await adminRes.json();
  return rows?.length ? user : null;
}

function berlinParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

function berlinDayStartUtc(date = new Date()) {
  const p = berlinParts(date);
  const utcMidnight = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 0, 0, 0));
  const offsetHour = Number(new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false
  }).format(utcMidnight));
  const offset = offsetHour === 2 ? '+02:00' : '+01:00';
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00${offset}`).toISOString();
}

\nasync function sendDailyStreakReadyNotifications({base,key}) {
  const now = new Date();
  const readyBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [streakRes,prefsRes] = await Promise.all([
    sb(base,key,`/rest/v1/club_daily_streaks?select=user_id,current_streak,last_checkin_at&last_checkin_at=lte.${encodeURIComponent(readyBefore)}&limit=1000`),
    sb(base,key,`/rest/v1/club_notification_preferences?select=user_id,in_app_enabled,push_enabled,email_enabled,email_daily_streak&limit=1000`)
  ]);
  if(!streakRes.ok) throw new Error('Daily-Streak-Daten konnten nicht geladen werden.');
  const streaks=await streakRes.json();
  const prefs=prefsRes.ok?await prefsRes.json():[];
  const prefMap=new Map((prefs||[]).map(row=>[row.user_id,row]));
  let inApp=0,push=0,email=0,skipped=0,failed=0,removed=0;

  async function reserveChannel(userId,eventKey,channel){
    const eventType=`daily_streak_ready_${channel}`;
    const existing=await sb(base,key,`/rest/v1/club_notification_dispatch_log?user_id=eq.${encodeURIComponent(userId)}&event_type=eq.${encodeURIComponent(eventType)}&event_key=eq.${encodeURIComponent(eventKey)}&select=id&limit=1`);
    if(existing.ok&&(await existing.json()).length)return false;
    const reserve=await sb(base,key,'/rest/v1/club_notification_dispatch_log',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({user_id:userId,event_type:eventType,event_key:eventKey})});
    if(!reserve.ok)return null;
    const rows=await reserve.json().catch(()=>[]);
    return Array.isArray(rows)&&rows.length;
  }

  for(const row of streaks||[]){
    if(!row.user_id||!row.last_checkin_at) continue;
    const eventKey=new Date(row.last_checkin_at).toISOString();
    const pref=prefMap.get(row.user_id)||{};
    const inAppEnabled=pref.in_app_enabled!==false;
    const pushEnabled=pref.push_enabled===true;
    const emailEnabled=pref.email_enabled===true&&pref.email_daily_streak===true;
    if(!inAppEnabled&&!pushEnabled&&!emailEnabled){skipped++;continue;}

    const title='🔥 Dein Daily-Check-in ist wieder bereit!';
    const ageHours=(Date.now()-new Date(row.last_checkin_at).getTime())/3600000;
    const body=ageHours<=48
      ? `Deine 24 Stunden sind vorbei. Hol dir jetzt deinen Check-in und halte deine ${Number(row.current_streak||0)}-Tage-Serie am Leben. 💜`
      : 'Dein Check-in ist wieder verfügbar. Wenn du die 48-Stunden-Gnadenfrist verpasst hast, startest du damit eine neue Serie. 💜';
    const link='/club-profile.html#daily-streak-section';

    if(inAppEnabled){
      const reserved=await reserveChannel(row.user_id,eventKey,'in_app');
      if(reserved===true){
        const n=await sb(base,key,'/rest/v1/club_notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:row.user_id,title,body,notification_type:'daily_streak_ready',link_url:link})});
        if(n.ok)inApp++;else failed++;
      }else if(reserved===null)failed++;
    }
    if(pushEnabled){
      const reserved=await reserveChannel(row.user_id,eventKey,'push');
      if(reserved===true){
        const r=await sendPushToUser({supabaseUrl:base,serviceKey:key,userId:row.user_id,title,body,url:link,tag:'acy-daily-streak-ready'});
        push+=Number(r.sent||0);removed+=Number(r.removed||0);failed+=Number(r.failed||0);
      }else if(reserved===null)failed++;
    }
    if(emailEnabled&&process.env.CLUB_EVENT_HUB_SECRET){
      const reserved=await reserveChannel(row.user_id,eventKey,'email');
      if(reserved===true){
        try{
          const er=await fetch(`${env('PUBLIC_SITE_URL','https://acyjannik.de')}/api/club-notification-email`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({internalSecret:process.env.CLUB_EVENT_HUB_SECRET,personal:true,type:'daily_streak_ready',targetUserId:row.user_id,emailOnly:true,title,body,linkUrl:link})});
          if(er.ok){const ep=await er.json().catch(()=>({}));email+=Number(ep.emailSent||0);}else failed++;
        }catch{failed++;}
      }else if(reserved===null)failed++;
    }
  }
  return {readyCandidates:(streaks||[]).length,inApp,push,email,skipped,failed,removed};
}

const GREETINGS = {
  morning: {
    title: '🌅 Guten Morgen, ACY Club!',
    body: 'Starte entspannt in den Tag. Denk kurz an dein Tier, schau bei deinen Quests vorbei und hol dir deine nächsten XP. 💜',
    link: '/club-profile.html#pet-section',
    tag: 'acy-morning'
  },
  evening: {
    title: '🌙 Schönen Abend im ACY Club!',
    body: 'Zeit für einen kleinen Check-in: Dein Tier, deine Quests und deine Community warten auf dich. 💜',
    link: '/club-profile.html#club-quests-section',
    tag: 'acy-evening'
  }
};

async function sendGreeting({ mode, base, key, allowDuplicate = false }) {
  const greeting = GREETINGS[mode];
  if (!greeting) throw new Error('Unbekannter Gruß-Modus.');

  const [profilesRes, prefsRes] = await Promise.all([
    sb(base, key, '/rest/v1/profiles?select=id,display_name,username&limit=1000'),
    sb(base, key, '/rest/v1/club_notification_preferences?select=user_id,push_enabled,in_app_enabled&limit=1000')
  ]);
  if (!profilesRes.ok) throw new Error('Mitglieder konnten nicht geladen werden.');

  const profiles = await profilesRes.json();
  const prefRows = prefsRes.ok ? await prefsRes.json() : [];
  const prefs = new Map((prefRows || []).map(row => [row.user_id, row]));

  const dayStart = berlinDayStartUtc();
  const notificationType = `daily_greeting_${mode}`;
  let sentPush = 0, sentInApp = 0, removed = 0, failed = 0, skipped = 0;
  const notificationRows = [];

  for (const profile of profiles || []) {
    const pref = prefs.get(profile.id) || {};
    const pushEnabled = pref.push_enabled === true;
    const inAppEnabled = pref.in_app_enabled !== false;
    if (!pushEnabled && !inAppEnabled) { skipped++; continue; }

    if (!allowDuplicate) {
      const existingRes = await sb(base, key, `/rest/v1/club_notifications?user_id=eq.${encodeURIComponent(profile.id)}&notification_type=eq.${encodeURIComponent(notificationType)}&created_at=gte.${encodeURIComponent(dayStart)}&select=id&limit=1`);
      if (existingRes.ok && (await existingRes.json()).length) { skipped++; continue; }
    }

    if (inAppEnabled) {
      notificationRows.push({
        user_id: profile.id,
        title: greeting.title,
        body: greeting.body,
        notification_type: notificationType,
        link_url: greeting.link
      });
    }

    if (pushEnabled) {
      const result = await sendPushToUser({
        supabaseUrl: base,
        serviceKey: key,
        userId: profile.id,
        title: greeting.title,
        body: greeting.body,
        url: greeting.link,
        tag: greeting.tag
      });
      sentPush += Number(result.sent || 0);
      removed += Number(result.removed || 0);
      failed += Number(result.failed || 0);
    }
  }

  if (notificationRows.length) {
    const notificationRes = await sb(base, key, '/rest/v1/club_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(notificationRows)
    });
    if (notificationRes.ok) sentInApp += notificationRows.length;
    else failed += notificationRows.length;
  }

  return { ok: true, mode, sentPush, sentInApp, removed, failed, skipped, members: (profiles || []).length };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store,max-age=0');
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'GET or POST only' });

  const base = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) return json(res, 503, { error: 'Supabase service is not configured.' });

  const cronSecret = env('CRON_SECRET');
  const authorization = String(req.headers.authorization || '');
  const suppliedCron = authorization.replace(/^Bearer\s+/i, '');
  const isCron = Boolean(cronSecret && suppliedCron === cronSecret);

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { body = {}; }

  if (isCron) {
    const now = new Date();
    const p = berlinParts(now);
    const hour = Number(p.hour);
    const minute = Number(p.minute);
    try {
      // Daily-Serie readiness is checked every hour. Greetings remain fixed at 08:00/18:00.
      const ready = await sendDailyStreakReadyNotifications({base,key});
      if (minute !== 0 || ![8, 18].includes(hour)) {
        return json(res, 200, { ok: true, ready, greeting: null, berlinTime: `${p.hour}:${p.minute}` });
      }
      const mode = hour === 8 ? 'morning' : 'evening';
      const greeting = await sendGreeting({ mode, base, key });
      return json(res, 200, {ok:true,ready,greeting});
    } catch (error) {
      console.error('push-daily cron', error);
      return json(res, 500, { error: error?.message || 'Automatischer Benachrichtigungsjob fehlgeschlagen.' });
    }
  }

  const admin = await getAdminFromBearer(base, key, authorization);
  if (!admin) return json(res, 401, { error: 'Nur angemeldete Admins dürfen Gruß-Pushes senden.' });

  const mode = String(body.mode || '').toLowerCase();
  if (!GREETINGS[mode]) return json(res, 400, { error: 'Bitte morning oder evening als Gruß auswählen.' });

  try {
    return json(res, 200, await sendGreeting({ mode, base, key, allowDuplicate: true }));
  } catch (error) {
    console.error('push-daily manual', error);
    return json(res, 500, { error: error?.message || 'Gruß konnte nicht gesendet werden.' });
  }
}
