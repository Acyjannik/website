const tls = require('node:tls');

const NOTIFICATION_EMAIL_API_VERSION = '7.1.12';
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


function smtpResponse(socket, expectedCodes) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return;

      cleanup();
      const code = Number(last.slice(0, 3));
      if (expectedCodes.includes(code)) resolve(buffer.trim());
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

function openTcpSocket(host, port) {
  return new Promise((resolve, reject) => {
    const socket = require('node:net').connect({ host, port }, () => resolve(socket));
    socket.once('error', reject);
  });
}

function upgradeToTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({
      socket,
      servername: host,
      rejectUnauthorized: true
    }, () => resolve(secure));
    secure.once('error', reject);
  });
}

function cleanEmail(value='') {
  return String(value || '').trim();
}

function assertAllowedSender() {
  const smtpUser = cleanEmail(env('SMTP_USER'));
  const emailFrom = cleanEmail(env('EMAIL_FROM')) || smtpUser;

  if (!smtpUser || !smtpUser.includes('@')) {
    throw new Error('SMTP_USER ist keine gültige E-Mail-Adresse.');
  }
  if (!emailFrom || !emailFrom.includes('@')) {
    throw new Error('EMAIL_FROM ist keine gültige E-Mail-Adresse.');
  }

  // IONOS only permits a sender from the same domain as the authenticated mailbox.
  const smtpDomain = smtpUser.slice(smtpUser.lastIndexOf('@') + 1).toLowerCase();
  const fromDomain = emailFrom.slice(emailFrom.lastIndexOf('@') + 1).toLowerCase();
  if (smtpDomain !== fromDomain) {
    throw new Error(`IONOS-Senderdomain stimmt nicht überein: SMTP_USER=${smtpDomain}, EMAIL_FROM=${fromDomain}.`);
  }

  return { smtpUser, emailFrom };
}

async function smtpSendMinimal({to}) {
  const host = cleanEmail(env('SMTP_HOST'));
  const port = Number(env('SMTP_PORT', '587'));
  const {smtpUser} = assertAllowedSender();
  const recipient = cleanEmail(to);
  let socket;

  try {
    socket = await openTcpSocket(host, port);
    await smtpResponse(socket, [220]);

    socket.write(`EHLO ${cleanEmail(env('SMTP_HELO', 'acyjannik.de'))}\r\n`);
    await smtpResponse(socket, [250]);

    if (port === 587) {
      socket.write('STARTTLS\r\n');
      await smtpResponse(socket, [220]);
      socket = await upgradeToTls(socket, host);
      socket.write(`EHLO ${cleanEmail(env('SMTP_HELO', 'acyjannik.de'))}\r\n`);
      await smtpResponse(socket, [250]);
    }

    socket.write('AUTH LOGIN\r\n');
    await smtpResponse(socket, [334]);
    socket.write(`${Buffer.from(smtpUser).toString('base64')}\r\n`);
    await smtpResponse(socket, [334]);
    socket.write(`${Buffer.from(cleanEmail(env('SMTP_PASS'))).toString('base64')}\r\n`);
    await smtpResponse(socket, [235]);

    socket.write(`MAIL FROM:<${smtpUser}>\r\n`);
    await smtpResponse(socket, [250]);
    socket.write(`RCPT TO:<${recipient}>\r\n`);
    await smtpResponse(socket, [250, 251]);

    socket.write('DATA\r\n');
    await smtpResponse(socket, [354]);

    const now = new Date().toUTCString();
    const domain = smtpUser.slice(smtpUser.lastIndexOf('@') + 1);
    const messageId = `<minimal-${Date.now()}.${Math.random().toString(16).slice(2)}@${domain}>`;
    const message = [
      `Date: ${now}`,
      `Message-ID: ${messageId}`,
      `From: <${smtpUser}>`,
      `To: <${recipient}>`,
      'Subject: ACY IONOS Minimal SMTP Test',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      'ACYJANNIK IONOS Minimal SMTP Test',
      '',
      'Wenn diese Mail ankommt, akzeptiert IONOS den authentifizierten Absender in dieser Minimalform.',
      ''
    ].join('\r\n').replace(/^\./gm, '..');

    socket.write(message + '\r\n.\r\n');
    await smtpResponse(socket, [250]);
    socket.write('QUIT\r\n');
    await smtpResponse(socket, [221, 250]);

    return {host,port,smtpUser,envelopeFrom:smtpUser,headerFrom:smtpUser};
  } finally {
    socket?.end?.();
  }
}

async function smtpSend({to, subject, text, html}) {
  const host = cleanEmail(env('SMTP_HOST'));
  const port = Number(env('SMTP_PORT', '587'));
  const {smtpUser} = assertAllowedSender();
  const recipient = cleanEmail(to);
  let socket;

  try {
    socket = await openTcpSocket(host, port);
    await smtpResponse(socket, [220]);

    socket.write(`EHLO ${cleanEmail(env('SMTP_HELO', 'acyjannik.de'))}\r\n`);
    await smtpResponse(socket, [250]);

    if (port === 587) {
      socket.write('STARTTLS\r\n');
      await smtpResponse(socket, [220]);
      socket = await upgradeToTls(socket, host);
      socket.write(`EHLO ${cleanEmail(env('SMTP_HELO', 'acyjannik.de'))}\r\n`);
      await smtpResponse(socket, [250]);
    }

    socket.write('AUTH LOGIN\r\n');
    await smtpResponse(socket, [334]);
    socket.write(`${Buffer.from(smtpUser).toString('base64')}\r\n`);
    await smtpResponse(socket, [334]);
    socket.write(`${Buffer.from(cleanEmail(env('SMTP_PASS'))).toString('base64')}\r\n`);
    await smtpResponse(socket, [235]);

    // Same envelope as the proven minimal IONOS test.
    socket.write(`MAIL FROM:<${smtpUser}>\r\n`);
    await smtpResponse(socket, [250]);
    socket.write(`RCPT TO:<${recipient}>\r\n`);
    await smtpResponse(socket, [250, 251]);
    socket.write('DATA\r\n');
    await smtpResponse(socket, [354]);

    const domain = smtpUser.slice(smtpUser.lastIndexOf('@') + 1);
    const now = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@${domain}>`;
    const safeSubject = String(subject || '').replace(/[\r\n]/g, ' ');
    const encodedSubject = `=?UTF-8?B?${Buffer.from(safeSubject, 'utf8').toString('base64')}?=`;
    const safeText = String(text || '').replace(/\r?\n/g, '\r\n');
    const safeHtml = String(html || '').replace(/\r?\n/g, '\r\n');
    const boundary = `=_ACY_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // Keep the structure intentionally close to the successful minimal test:
    // exact mailbox in From, no display name, no Reply-To, no custom headers.
    const message = [
      `Date: ${now}`,
      `Message-ID: ${messageId}`,
      `From: <${smtpUser}>`,
      `To: <${recipient}>`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      safeText,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      safeHtml,
      '',
      `--${boundary}--`,
      ''
    ].join('\r\n').replace(/^\./gm, '..');

    socket.write(message + '\r\n.\r\n');
    await smtpResponse(socket, [250]);

    socket.write('QUIT\r\n');
    await smtpResponse(socket, [221, 250]);
  } finally {
    socket?.end?.();
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
        apiVersion: NOTIFICATION_EMAIL_API_VERSION,
        missing:['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM'].filter(k => !env(k))
      });
    }

    const body = typeof req.body === 'object' ? (req.body || {}) : JSON.parse(req.body || '{}');

    // V7.1.11: isolated IONOS sender test. This intentionally sends the
    // smallest possible plain-text message using the authenticated mailbox.
    if (body.testSmtpMinimal === true) {
      const selfRes = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`);
      if (!selfRes.ok) throw new Error(`Eigene E-Mail konnte nicht geladen werden. Auth HTTP ${selfRes.status}`);
      const self = await selfRes.json();
      if (!self.email) return json(res, 400, {apiVersion: NOTIFICATION_EMAIL_API_VERSION,error:'Dein Admin-Account hat keine E-Mail-Adresse.'});

      const result = await smtpSendMinimal({to:self.email});
      return json(res, 200, {
        apiVersion: NOTIFICATION_EMAIL_API_VERSION,
        ok: true,
        mode: 'minimal',
        sentTo: self.email,
        smtpHost: result.host,
        smtpPort: result.port,
        smtpUserMasked: result.smtpUser
          ? `${result.smtpUser.slice(0, Math.min(2, result.smtpUser.length))}***${result.smtpUser.slice(result.smtpUser.lastIndexOf('@'))}`
          : '(leer)',
        smtpUserDomain: result.smtpUser.slice(result.smtpUser.lastIndexOf('@') + 1),
        authAccepted: true,
        dataAccepted: true,
        envelopeFrom: result.envelopeFrom,
        headerFrom: result.headerFrom
      });
    }

    // V7.1.5: direct SMTP test through the EXISTING deployed API route.
    // This avoids relying on a brand-new Vercel function path.
    if (body.testSmtp === true) {
      if (!smtpConfigured()) {
        return json(res, 503, {
          apiVersion: NOTIFICATION_EMAIL_API_VERSION,
          error: 'SMTP ist noch nicht vollständig konfiguriert.',
          missing: ['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM'].filter(k => !env(k))
        });
      }

      const selfRes = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`);
      if (!selfRes.ok) {
        throw new Error(`Eigene E-Mail konnte nicht geladen werden. Auth HTTP ${selfRes.status}`);
      }
      const self = await selfRes.json();

      const smtpUser = env('SMTP_USER');
      const at = smtpUser.lastIndexOf('@');
      const smtpUserDomain = at > 0 ? smtpUser.slice(at + 1) : '(ungültig)';
      const smtpUserMasked = smtpUser
        ? `${smtpUser.slice(0, Math.min(2, smtpUser.length))}***${at > 0 ? smtpUser.slice(at) : ''}`
        : '(leer)';

      if (!self.email) {
        return json(res, 400, {
          apiVersion: NOTIFICATION_EMAIL_API_VERSION,
          error: 'Dein Admin-Account hat keine E-Mail-Adresse.'
        });
      }

      const now = new Date().toLocaleString('de-DE');
      const text = `SMTP-Test erfolgreich ausgelöst.\n\nAPI ${NOTIFICATION_EMAIL_API_VERSION}\nZeit: ${now}`;
      const html = `
        <div style="font-family:Arial,sans-serif;background:#0b0b10;color:#f4f4f5;padding:28px">
          <div style="max-width:600px;margin:auto;background:#14131b;border:1px solid #282230;border-radius:16px;padding:24px">
            <div style="color:#c084fc;font-size:11px;letter-spacing:.14em;font-weight:800">ACYJANNIK · ACY CLUB</div>
            <h1 style="font-size:24px">SMTP-Test erfolgreich 🎉</h1>
            <p style="color:#b8b8c3">Diese Mail wurde über die bereits vorhandene ACY-Mail-API verschickt.</p>
            <p style="font-size:12px;color:#71717a">API ${NOTIFICATION_EMAIL_API_VERSION} · ${now}</p>
          </div>
        </div>`;

      try {
        await smtpSend({
          to: self.email,
          subject: 'ACY Club SMTP-Test',
          text,
          html
        });
      } catch (smtpError) {
        return json(res, 500, {
          apiVersion: NOTIFICATION_EMAIL_API_VERSION,
          ok: false,
          error: smtpError?.message || 'SMTP-Test fehlgeschlagen.',
          smtpHost: env('SMTP_HOST'),
          senderMode: 'SMTP_USER as envelope + From',
          ionosSenderRule: 'SMTP_USER und From verwenden exakt dasselbe Postfach',
          minimalTestAvailable: true,

          smtpPort: Number(env('SMTP_PORT', '587')),
          smtpUserMasked,
          smtpUserDomain,
          emailFromMasked: (() => {
            const value = env('EMAIL_FROM');
            const i = value.lastIndexOf('@');
            return value ? `${value.slice(0, Math.min(2, value.length))}***${i > 0 ? value.slice(i) : ''}` : '(leer)';
          })()
        });
      }

      return json(res, 200, {
        apiVersion: NOTIFICATION_EMAIL_API_VERSION,
        ok: true,
        sentTo: self.email,
        message: 'Test-Mail wurde an deinen Admin-Account übergeben.',
        envelopeFrom: env('SMTP_USER'),
        smtpHost: env('SMTP_HOST'),
        smtpPort: Number(env('SMTP_PORT', '587')),
        smtpUserMasked,
        smtpUserDomain
      });
    }

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

    const totalMembers = (profiles || []).length;
    const preferenceRows = (prefs || []).length;
    const emailEnabledCount = (prefs || []).filter(row => row.email_enabled === true).length;
    const categoryEnabledCount = pref
      ? (prefs || []).filter(row => row.email_enabled === true && row[pref] === true).length
      : 0;

    const eligible = [];
    const missingAuthEmails = [];

    for (const profile of profiles || []) {
      const prefRow = prefsByUser.get(profile.id);
      if (!prefRow?.email_enabled || !pref || prefRow[pref] !== true) continue;

      const authRes = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(profile.id)}`);
      if (!authRes.ok) {
        missingAuthEmails.push({userId: profile.id, reason: `Auth HTTP ${authRes.status}`});
        continue;
      }

      const authUser = await authRes.json();
      if (authUser.email) {
        eligible.push({profile, email: authUser.email});
      } else {
        missingAuthEmails.push({userId: profile.id, reason: 'Keine E-Mail in Auth'});
      }
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
      totalMembers,
      preferenceRows,
      emailEnabledCount,
      categoryEnabledCount,
      emailEligible:eligible.length,
      emailSent:sent,
      emailFailed:failed,
      missingAuthEmailsCount: missingAuthEmails.length
    });
  } catch (error) {
    console.error('notification email dispatch', error);
    return json(res, 500, {apiVersion: NOTIFICATION_EMAIL_API_VERSION, error:error.message || 'E-Mails konnten nicht gesendet werden.'});
  }
};
