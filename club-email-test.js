const tls = require('node:tls');

const VERSION = '7.1.4';
const env = (name, fallback='') => String(process.env[name] || fallback);

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      apikey: env('SUPABASE_ANON_KEY', env('SUPABASE_SERVICE_ROLE_KEY')),
      Authorization: `Bearer ${token}`
    }
  });
  return r.ok ? r.json() : null;
}

async function isAdmin(userId) {
  const r = await sbFetch(`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`);
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

function smtpConfigured() {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') && env('EMAIL_FROM'));
}

function smtpWait(socket, expectedCodes) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return;
      cleanup();
      const code = Number(last.slice(0,3));
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

async function sendSmtp({to, subject, text, html}) {
  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT', '465'));
  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });

  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });

    const greeting = await smtpWait(socket, [220]);
    socket.write(`EHLO ${env('SMTP_HELO', 'acyjannik.de')}\r\n`);
    const ehlo = await smtpWait(socket, [250]);

    socket.write('AUTH LOGIN\r\n');
    await smtpWait(socket, [334]);
    socket.write(`${Buffer.from(env('SMTP_USER')).toString('base64')}\r\n`);
    await smtpWait(socket, [334]);
    socket.write(`${Buffer.from(env('SMTP_PASS')).toString('base64')}\r\n`);
    await smtpWait(socket, [235]);

    socket.write(`MAIL FROM:<${env('EMAIL_FROM')}>\r\n`);
    await smtpWait(socket, [250]);

    socket.write(`RCPT TO:<${to}>\r\n`);
    await smtpWait(socket, [250, 251]);

    socket.write('DATA\r\n');
    await smtpWait(socket, [354]);

    const boundary = `=_ACY_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const fromName = env('EMAIL_FROM_NAME', 'ACYJANNIK · ACY Club');

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
      text,
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
    const dataAccepted = await smtpWait(socket, [250]);

    socket.write('QUIT\r\n');
    const quit = await smtpWait(socket, [221, 250]);

    return { greeting, ehlo, dataAccepted, quit };
  } finally {
    socket.end();
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { apiVersion: VERSION, error: 'POST only' });
  }

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(res, 401, { apiVersion: VERSION, error: 'Nicht angemeldet.' });

    const user = await getAuthUser(token);
    if (!user?.id) return json(res, 401, { apiVersion: VERSION, error: 'Sitzung ungültig.' });
    if (!(await isAdmin(user.id))) {
      return json(res, 403, { apiVersion: VERSION, error: 'Admin-Rechte erforderlich.' });
    }

    if (!smtpConfigured()) {
      return json(res, 503, {
        apiVersion: VERSION,
        error: 'SMTP ist noch nicht vollständig konfiguriert.',
        missing: ['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM'].filter(k => !env(k))
      });
    }

    const authRes = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`);
    if (!authRes.ok) {
      return json(res, 500, { apiVersion: VERSION, error: `Eigene E-Mail konnte nicht geladen werden. Auth HTTP ${authRes.status}` });
    }
    const authUser = await authRes.json();
    const target = authUser.email;
    if (!target) {
      return json(res, 400, { apiVersion: VERSION, error: 'Dein Admin-Account hat keine E-Mail-Adresse.' });
    }

    const now = new Date().toLocaleString('de-DE');
    const subject = 'ACY Club SMTP-Test';
    const text = `SMTP-Test erfolgreich ausgelöst.\n\nZeit: ${now}\nEmpfänger: ${target}\nAPI: ${VERSION}`;
    const html = `
      <div style="font-family:Arial,sans-serif;background:#0b0b10;color:#f4f4f5;padding:28px">
        <div style="max-width:600px;margin:auto;background:#14131b;border:1px solid #282230;border-radius:16px;padding:24px">
          <div style="color:#c084fc;font-size:11px;letter-spacing:.14em;font-weight:800">ACYJANNIK · ACY CLUB</div>
          <h1 style="font-size:24px">SMTP-Test erfolgreich 🎉</h1>
          <p style="color:#b8b8c3">Die Vercel-API konnte eine Mail über die hinterlegten SMTP-Daten versenden.</p>
          <p style="font-size:12px;color:#71717a">API ${VERSION} · ${now}</p>
        </div>
      </div>`;

    const smtp = await sendSmtp({ to: target, subject, text, html });

    return json(res, 200, {
      apiVersion: VERSION,
      ok: true,
      sentTo: target,
      smtpHost: env('SMTP_HOST'),
      smtpPort: Number(env('SMTP_PORT','465')),
      message: 'Test-Mail wurde an deinen Admin-Account übergeben.'
    });
  } catch (error) {
    console.error('ACY SMTP test failed:', error);
    return json(res, 500, {
      apiVersion: VERSION,
      ok: false,
      error: error?.message || 'SMTP-Test fehlgeschlagen.'
    });
  }
};
