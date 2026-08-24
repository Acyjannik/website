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

async function rpc(base, key, functionName, body = {}) {
  return sb(base, key, `/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
}

async function getAdminFromBearer(base, key, authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const userRes = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const adminRes = await sb(base, key, `/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  if (!adminRes.ok) return null;
  return (await adminRes.json())?.length ? user : null;
}

function berlinParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

async function sendDailyStreakReadyNotifications({ base, key }) {
  const claimRes = await rpc(base, key, 'claim_daily_streak_notification_candidates', {
    p_allow_email: Boolean(process.env.CLUB_EVENT_HUB_SECRET)
  });
  if (!claimRes.ok) throw new Error('Daily-Streak-Kandidaten konnten nicht geladen werden.');

  const claimed = await claimRes.json();
  const byUser = new Map();
  for (const row of claimed || []) {
    if (!row.user_id || !row.last_checkin_at) continue;
    const current = byUser.get(row.user_id) || { ...row, needs_in_app: false, needs_push: false, needs_email: false };
    current.needs_in_app ||= row.needs_in_app === true;
    current.needs_push ||= row.needs_push === true;
    current.needs_email ||= row.needs_email === true;
    byUser.set(row.user_id, current);
  }

  let inApp = 0, push = 0, email = 0, failed = 0, removed = 0;
  const notificationRows = [];

  for (const row of byUser.values()) {
    const title = '🔥 Dein Daily-Check-in ist wieder bereit!';
    const ageHours = (Date.now() - new Date(row.last_checkin_at).getTime()) / 3600000;
    const body = ageHours <= 48
      ? `Deine 24 Stunden sind vorbei. Hol dir jetzt deinen Check-in und halte deine ${Number(row.current_streak || 0)}-Tage-Serie am Leben. 💜`
      : 'Dein Check-in ist wieder verfügbar. Wenn du die 48-Stunden-Gnadenfrist verpasst hast, startest du damit eine neue Serie. 💜';
    const link = '/club-profile.html#daily-streak-section';

    if (row.needs_in_app) {
      notificationRows.push({
        user_id: row.user_id,
        title,
        body,
        notification_type: 'daily_streak_ready',
        link_url: link
      });
    }

    if (row.needs_push) {
      try {
        const result = await sendPushToUser({
          supabaseUrl: base,
          serviceKey: key,
          userId: row.user_id,
          title,
          body,
          url: link,
          tag: 'acy-daily-streak-ready'
        });
        push += Number(result.sent || 0);
        removed += Number(result.removed || 0);
        failed += Number(result.failed || 0);
      } catch {
        failed++;
      }
    }

    if (row.needs_email && process.env.CLUB_EVENT_HUB_SECRET) {
      try {
        const er = await fetch(`${env('PUBLIC_SITE_URL', 'https://acyjannik.de')}/api/club-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            internalSecret: process.env.CLUB_EVENT_HUB_SECRET,
            personal: true,
            type: 'daily_streak_ready',
            targetUserId: row.user_id,
            emailOnly: true,
            title,
            body,
            linkUrl: link
          })
        });
        if (er.ok) {
          const ep = await er.json().catch(() => ({}));
          email += Number(ep.emailSent || 0);
        } else failed++;
      } catch {
        failed++;
      }
    }
  }

  if (notificationRows.length) {
    const notificationRes = await sb(base, key, '/rest/v1/club_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(notificationRows)
    });
    if (notificationRes.ok) inApp += notificationRows.length;
    else failed += notificationRows.length;
  }

  return {
    readyCandidates: byUser.size,
    inApp,
    push,
    email,
    skipped: 0,
    failed,
    removed
  };
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

  let candidates = [];
  let skipped = 0;

  if (!allowDuplicate) {
    const candidateRes = await rpc(base, key, 'claim_daily_greeting_candidates', { p_mode: mode });
    if (!candidateRes.ok) throw new Error('Gruß-Kandidaten konnten nicht geladen werden.');
    candidates = await candidateRes.json();
  } else {
    const [profilesRes, prefsRes] = await Promise.all([
      sb(base, key, '/rest/v1/profiles?select=id,display_name,username&limit=1000'),
      sb(base, key, '/rest/v1/club_notification_preferences?select=user_id,push_enabled,in_app_enabled&limit=1000')
    ]);
    if (!profilesRes.ok) throw new Error('Mitglieder konnten nicht geladen werden.');
    const profiles = await profilesRes.json();
    const prefRows = prefsRes.ok ? await prefsRes.json() : [];
    const prefs = new Map((prefRows || []).map(row => [row.user_id, row]));
    candidates = (profiles || []).map(profile => {
      const pref = prefs.get(profile.id) || {};
      return {
        user_id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        push_enabled: pref.push_enabled === true,
        in_app_enabled: pref.in_app_enabled !== false
      };
    });
  }

  let sentPush = 0, sentInApp = 0, removed = 0, failed = 0;
  const notificationRows = [];

  for (const candidate of candidates || []) {
    const pushEnabled = candidate.push_enabled === true;
    const inAppEnabled = candidate.in_app_enabled !== false;
    if (!pushEnabled && !inAppEnabled) { skipped++; continue; }

    if (inAppEnabled) {
      notificationRows.push({
        user_id: candidate.user_id,
        title: greeting.title,
        body: greeting.body,
        notification_type: `daily_greeting_${mode}`,
        link_url: greeting.link
      });
    }

    if (pushEnabled) {
      try {
        const result = await sendPushToUser({
          supabaseUrl: base,
          serviceKey: key,
          userId: candidate.user_id,
          title: greeting.title,
          body: greeting.body,
          url: greeting.link,
          tag: greeting.tag
        });
        sentPush += Number(result.sent || 0);
        removed += Number(result.removed || 0);
        failed += Number(result.failed || 0);
      } catch {
        failed++;
      }
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

  return {
    ok: true,
    mode,
    sentPush,
    sentInApp,
    removed,
    failed,
    skipped,
    members: (candidates || []).length
  };
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
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    body = {};
  }

  if (isCron) {
    const now = new Date();
    const p = berlinParts(now);
    const hour = Number(p.hour);
    const minute = Number(p.minute);
    try {
      const ready = await sendDailyStreakReadyNotifications({ base, key });
      if (minute !== 0 || ![8, 18].includes(hour)) {
        return json(res, 200, { ok: true, ready, greeting: null, berlinTime: `${p.hour}:${p.minute}` });
      }
      const mode = hour === 8 ? 'morning' : 'evening';
      const greeting = await sendGreeting({ mode, base, key });
      return json(res, 200, { ok: true, ready, greeting });
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
