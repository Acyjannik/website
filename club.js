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
  $('club-success').hidden = true;
  $('show-register').classList.toggle('active', register);
  $('show-login').classList.toggle('active', !register);
  if (register) $('login-status').textContent = '';
  else $('auth-status').textContent = '';
}

function showRegistrationSuccess(email, confirmedSession = false, pending = false) {
  $('register-form').hidden = true;
  $('club-success').hidden = false;
  $('auth-status').textContent = '';
  $('club-success-text').textContent = pending
    ? `Wir haben deine Registrierung verarbeitet. Falls du bereits die Bestätigungs-E-Mail von info@acyjannik.de erhalten hast, bestätige sie bitte. Die E-Mail wurde an ${email} gesendet.`
    : confirmedSession
      ? 'Dein Account ist erstellt. Willkommen im ACY Club.'
      : `Dein Account ist erstellt. Wir haben eine Bestätigungs-E-Mail an ${email} gesendet. Bitte prüfe auch Spam/Junk und bestätige deine E-Mail-Adresse, bevor du dich einloggst.`;
}

async function awardProgression(eventKey) {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (!data?.session?.access_token) return;
    await fetch('/api/club-progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.session.access_token}` },
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
    if (data?.session?.user) window.location.href = '/club-profile.html';
  } catch (error) {
    console.error(error);
    status('auth-status', error.message || 'Registrierung momentan nicht verfügbar.', 'error');
  }
}

$('show-register')?.addEventListener('click', () => switchMode('register'));
$('show-login')?.addEventListener('click', () => switchMode('login'));

$('username')?.addEventListener('input', (event) => {
  const input = event.currentTarget;
  const before = input.value;
  const normalized = before.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (before !== normalized) input.value = normalized;
});

$('register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return status('auth-status', 'Die Verbindung zum ACY Club wird noch hergestellt. Bitte kurz warten.', 'error');

  const username = $('username').value.trim().toLowerCase();
  const displayName = $('display-name').value.trim() || username;
  const email = $('register-email').value.trim();
  const password = $('register-password').value;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) return status('auth-status', 'Benutzername: 3–24 Zeichen. Nur Kleinbuchstaben (a–z), Zahlen und _.', 'error');
  if (password.length < 10) return status('auth-status', 'Das Passwort muss mindestens 10 Zeichen lang sein.', 'error');

  const button = $('register-submit');
  button.disabled = true;
  button.textContent = 'Registrierung läuft…';
  status('auth-status', 'Account wird erstellt…');

  const signupPromise = supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName }, emailRedirectTo: `${window.location.origin}/club-profile.html` }
  });

  const timeout = new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 10000));

  try {
    const result = await Promise.race([signupPromise, timeout]);
    if (result?.timeout) {
      showRegistrationSuccess(email, false, true);
      button.textContent = 'Registrierung abgeschlossen';
      signupPromise.then(({ data, error }) => {
        if (error) {
          console.error('Late signup error:', error);
          $('club-success').hidden = true;
          $('register-form').hidden = false;
          button.disabled = false;
          button.textContent = 'ACY Club beitreten';
          status('auth-status', error.message || 'Registrierung fehlgeschlagen.', 'error');
          return;
        }
        if (data?.session) awardProgression('registration');
      }).catch(error => console.error('Late signup failure:', error));
      return;
    }

    const { data, error } = result;
    if (error) throw error;
    if (data.session) await awardProgression('registration');
    showRegistrationSuccess(email, !!data.session, false);
    button.textContent = 'Account erstellt';
  } catch (error) {
    const msg = String(error.message || '');
    status('auth-status', /already registered/i.test(msg) ? 'Diese E-Mail ist bereits registriert.' : msg || 'Registrierung fehlgeschlagen.', 'error');
    button.disabled = false;
    button.textContent = 'ACY Club beitreten';
  }
});

$('login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-submit').disabled = true;
  status('login-status', 'Anmeldung läuft…');

  try {
    const identifier = $('login-email').value.trim();
    const password = $('login-password').value;
    const response = await fetch('/api/club-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Login fehlgeschlagen.');
    if (!payload.access_token || !payload.refresh_token) throw new Error('Keine gültige Sitzung erhalten.');

    const { error: sessionError } = await supabaseClient.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token
    });
    if (sessionError) throw sessionError;

    await awardProgression('registration');
    window.location.href = '/club-profile.html';
  } catch (error) {
    status('login-status', error.message || 'Login fehlgeschlagen.', 'error');
    $('login-submit').disabled = false;
  }
});

$('forgot-password')?.addEventListener('click', async () => {
  const identifier = $('login-email').value.trim();
  if (!identifier || !identifier.includes('@')) return status('login-status', 'Für den Passwort-Reset bitte deine E-Mail-Adresse eingeben.', 'error');

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(identifier, { redirectTo: `${window.location.origin}/club-reset.html` });
    if (error) throw error;
    status('login-status', 'Eine E-Mail zum Zurücksetzen des Passworts wurde angefordert.', 'success');
  } catch (error) {
    const msg = String(error.message || '');
    status('login-status', /rate limit|too many|email rate/i.test(msg) ? 'Zu viele Reset-E-Mails wurden gerade angefordert. Bitte etwas warten und es danach erneut versuchen.' : msg || 'Passwort-Reset fehlgeschlagen.', 'error');
  }
});

init();
