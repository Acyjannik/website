let supabaseClient = null;

const $ = (id) => document.getElementById(id);

function status(id, text, type = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = `club-auth-status ${type}`.trim();
}

function switchMode(mode) {
  const register = mode === 'register';
  $('register-form').hidden = !register;
  $('login-form').hidden = register;
  $('show-register').classList.toggle('active', register);
  $('show-login').classList.toggle('active', !register);
}


async function awardProgression(eventKey) {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (!data?.session?.access_token) return;
    await fetch('/api/club-progression', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ eventKey })
    });
  } catch (error) {
    console.warn('Progression award skipped:', error);
  }
}

async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();
    if (!config.configured) throw new Error('Die ACY Club Registrierung ist noch nicht konfiguriert.');
    if (!window.supabase?.createClient) throw new Error('Supabase konnte nicht geladen werden.');

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    $('register-submit').disabled = false;
    $('login-submit').disabled = false;
    status('auth-status', 'Bereit. Dein ACY Club Account kann erstellt werden.', 'success');

    const { data } = await supabaseClient.auth.getSession();
    if (data?.session?.user) {
      window.location.href = '/club-profile.html';
    }
  } catch (error) {
    console.error(error);
    status('auth-status', error.message || 'Registrierung momentan nicht verfügbar.', 'error');
  }
}

$('show-register')?.addEventListener('click', () => switchMode('register'));
$('show-login')?.addEventListener('click', () => switchMode('login'));

$('register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = $('username').value.trim().toLowerCase();
  const displayName = $('display-name').value.trim() || username;
  const email = $('register-email').value.trim();
  const password = $('register-password').value;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return status('auth-status', 'Benutzername: 3–24 Zeichen, nur a–z, 0–9 und _.', 'error');
  }

  if (password.length < 10) {
    return status('auth-status', 'Das Passwort muss mindestens 10 Zeichen lang sein.', 'error');
  }

  $('register-submit').disabled = true;
  status('auth-status', 'Account wird erstellt…');

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName } }
    });

    if (error) throw error;

    if (data.session) {
      await awardProgression('registration');
    }
    $('register-form').hidden = true;
    $('club-success').hidden = false;
    $('club-success-text').textContent = data.session
      ? 'Dein Account ist erstellt. Willkommen im ACY Club.'
      : 'Dein Account ist erstellt. Prüfe gegebenenfalls deine E-Mail zur Bestätigung.';
  } catch (error) {
    const msg = String(error.message || '');
    status('auth-status',
      /already registered/i.test(msg)
        ? 'Diese E-Mail ist bereits registriert.'
        : msg || 'Registrierung fehlgeschlagen.',
      'error'
    );
    $('register-submit').disabled = false;
  }
});

$('login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-submit').disabled = true;
  status('login-status', 'Anmeldung läuft…');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: $('login-email').value.trim(),
      password: $('login-password').value
    });
    if (error) throw error;
    if (!data.session) throw new Error('Keine gültige Sitzung erhalten.');
    window.location.href = '/club-profile.html';
  } catch (error) {
    status('login-status', error.message || 'Login fehlgeschlagen.', 'error');
    $('login-submit').disabled = false;
  }
});

$('forgot-password')?.addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  if (!email) return status('login-status', 'Bitte zuerst deine E-Mail eingeben.', 'error');

  try {
    const origin = window.location.origin;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/club-reset.html`
    });
    if (error) throw error;
    status('login-status', 'Eine E-Mail zum Zurücksetzen des Passworts wurde angefordert.', 'success');
  } catch (error) {
    const msg=String(error.message||'');
    status(
      'login-status',
      /rate limit|too many|email rate/i.test(msg)
        ? 'Zu viele Reset-E-Mails wurden gerade angefordert. Bitte etwas warten und es danach erneut versuchen.'
        : msg || 'Passwort-Reset fehlgeschlagen.',
      'error'
    );
  }
});

init();
