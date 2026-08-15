const tls = require('node:tls');

const env = (name, fallback='') => String(process.env[name] || fallback);

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[c]));
}

async function sbFetch(path, options={}) {
  return fetch(`${env('SUPABASE_URL')}${path}`, {
    ...options,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function getAuthUser(token) {
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      apikey: env('SUPABASE_ANON_KEY', env('SUPABASE_SERVICE_ROLE_KEY')),
      Authorization: `Bearer ${token}`
    }
  });
  return response.ok ? response.json() : null;
}

async function isAdmin(userId) {
  const response = await sbFetch(
    `/rest/v1/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`
  );
  if (!response.ok) return false;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

function prefColumn(type) {
  return ({
    community_vote: 'email_votes',
    event: 'email_events',
    news: 'email_news',
    live: 'email_live',
    achievement: 'email_achievements',
    direct_message: 'email_direct_messages',
    spotlight: 'email_spotlight',
    reward: 'email_rewards',
    pet: 'email_pet'
  })[type] || null;
}

function smtpConfigured() {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') && env('EMAIL_FROM'));
}

function smtpResponse(socket, expected) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return;
      cleanup();
      const code = Number(last.slice(0,3));
      if (expected.includes(code)) resolve(code);
      else reject(new Error(`SMTP ${code}: ${buffer.trim()}`));
    };
    const onError = err => { cleanup(); reject(err); };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function smtpSend({to, subject, text, html}) {
  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT', '465'));
  const socket = tls.connect({
    host,
    port,
    servername: host,
    rejectUnauthorized: true
  });

  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    await smtpResponse(socket, [220]);

    socket.write(`EHLO ${env('SMTP_HELO', 'acyjannik.de')}\r\n`);
    await smtpResponse(socket, [250]);
    socket.write('AUTH LOGIN\r\n');
    await smtpResponse(socket, [334]);
    socket.write(`${Buffer.from(env('SMTP_USER')).toString('base64')}\r\n`);
    await smtpResponse(socket, [334]);
    socket.write(`${Buffer.from(env('SMTP_PASS')).toString('base64')}\r\n`);
    await smtpResponse(socket, [235]);

    socket.write(`MAIL FROM:<${env('EMAIL_FROM')}>\r\n`);
    await smtpResponse(socket, [250]);
    socket.write(`RCPT TO:<${to}>\r\n`);
    await smtpResponse(socket, [250, 251]);
    socket.write('DATA\r\n');
    await smtpResponse(socket, [354]);

    const boundary = `=_ACY_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const site = env('PUBLIC_SITE_URL', 'https://acyjannik.de');
    const fromName = env('EMAIL_FROM_NAME', 'ACYJANNIK · ACY Club');
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

    const message = [
      `From: ${fromName} <${env('EMAIL_FROM')}>`,
      `To: <${to}>`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      `${text}\n\n${site}`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      '',
      `--${boundary}--`,
      ''
    ].join('\r\n').replace(/^\./gm, '..');

    socket.write(message + '\r\n.\r\n');
    await smtpResponse(socket, [250]);
    socket.write('QUIT\r\n');
    await smtpResponse(socket, [221, 250]);
  } finally {
    socket.end();
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, {error:'POST only'});
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(res, 401, {error:'Nicht angemeldet.'});

    const user = await getAuthUser(token);
    if (!user?.id || !(await isAdmin(user.id))) {
      return json(res, 403, {error:'Admin-Rechte erforderlich.'});
    }

    if (!smtpConfigured()) {
      return json(res, 503, {
        error:'SMTP ist noch nicht konfiguriert.',
        missing:['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM'].filter(k => !env(k))
      });
    }

    const body = typeof req.body === 'object' ? (req.body || {}) : JSON.parse(req.body || '{}');
    const type = String(body.type || 'general').slice(0,50);
    const pref = prefColumn(type);
    const title = String(body.title || '').trim().slice(0,180);
    const text = String(body.body || '').trim().slice(0,1500);
    const linkUrl = String(body.linkUrl || '/club-profile.html').trim().slice(0,500);

    if (!title || !text) return json(res, 400, {error:'title und body sind erforderlich.'});

    const [profilesRes, prefsRes] = await Promise.all([
      sbFetch('/rest/v1/profiles?select=id,display_name,username'),
      sbFetch('/rest/v1/club_notification_preferences?select=user_id,email_enabled,email_votes,email_events,email_news,email_live,email_achievements,email_direct_messages,email_spotlight,email_rewards,email_pet')
    ]);

    if (!profilesRes.ok) throw new Error(`Profiles: HTTP ${profilesRes.status}`);
    if (!prefsRes.ok) throw new Error(`Preferences: HTTP ${prefsRes.status}`);

    const profiles = await profilesRes.json();
    const prefs = await prefsRes.json();
    const prefsByUser = new Map((prefs || []).map(p => [p.user_id, p]));

    const eligible = [];
    for (const profile of profiles || []) {
      const p = prefsByUser.get(profile.id);
      if (!p?.email_enabled || !pref || p[pref] !== true) continue;

      const authRes = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(profile.id)}`);
      if (!authRes.ok) continue;
      const authUser = await authRes.json();
      if (authUser.email) eligible.push({profile, email: authUser.email});
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of eligible) {
      try {
        const settingsUrl = `${env('PUBLIC_SITE_URL','https://acyjannik.de')}/club-profile.html#notification-settings`;
        const targetUrl = `${env('PUBLIC_SITE_URL','https://acyjannik.de')}${linkUrl}`;
        const html = `
          <div style="background:#09090d;padding:32px 16px;font-family:Arial,sans-serif;color:#f4f4f5">
            <div style="max-width:620px;margin:auto;background:#14131b;border:1px solid #282230;border-radius:18px;padding:28px">
              <div style="color:#c084fc;font-size:11px;letter-spacing:.15em;font-weight:800">ACYJANNIK · ACY CLUB</div>
              <h1 style="font-size:26px;line-height:1.15;margin:12px 0 14px">${escapeHtml(title)}</h1>
              <p style="color:#b8b8c3;line-height:1.6">${escapeHtml(text).replace(/\n/g,'<br>')}</p>
              <p style="margin-top:24px">
                <a href="${escapeHtml(targetUrl)}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Im ACY Club öffnen ↗</a>
              </p>
              <p style="font-size:11px;color:#6f6f7a;margin-top:30px">
                Benachrichtigungen:
                <a href="${escapeHtml(settingsUrl)}" style="color:#c084fc">Einstellungen verwalten</a>
              </p>
            </div>
          </div>`;

        await smtpSend({
          to: recipient.email,
          subject: `${title} · ACY Club`,
          text,
          html
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return json(res, 200, {
      ok:true,
      emailConfigured:true,
      emailEligible:eligible.length,
      emailSent:sent,
      emailFailed:failed
    });
  } catch (error) {
    console.error('notification email dispatch', error);
    return json(res, 500, {error:error.message || 'E-Mails konnten nicht gesendet werden.'});
  }
};
