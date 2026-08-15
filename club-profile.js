let supabaseClient = null;
const $ = id => document.getElementById(id);

async function init() {
  try {
    const cfg = await (await fetch('/api/config', { cache: 'no-store' })).json();
    if (!cfg.configured) throw new Error('Supabase ist noch nicht konfiguriert.');
    supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    const { data } = await supabaseClient.auth.getSession();
    if (!data?.session?.user) {
      window.location.href = '/club.html';
      return;
    }

    const user = data.session.user;
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username,display_name,created_at')
      .eq('id', user.id)
      .maybeSingle();

    const name = profile?.display_name || user.user_metadata?.display_name || 'ACY Member';
    $('member-name').textContent = name;
    $('member-username').textContent = profile?.username || user.user_metadata?.username || '–';
    $('member-avatar').textContent = String(name).trim().charAt(0).toUpperCase() || 'A';

    const since = profile?.created_at || user.created_at;
    if (since) $('member-since').textContent = new Date(since).toLocaleDateString('de-DE');
  } catch (error) {
    $('profile-status').textContent = error.message || 'Profil konnte nicht geladen werden.';
    $('profile-status').classList.add('error');
  }
}

$('logout')?.addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  window.location.href = '/club.html';
});

init();
