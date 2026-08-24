(() => {
  'use strict';
  if (!document.body?.classList.contains('club-auth-page')) return;

  if (window.__acySupabaseWarmupPromise) return;

  const warm = async () => {
    try {
      if (window.__acySupabaseClient) {
        window.dispatchEvent(new CustomEvent('acy:supabase-ready'));
        return window.__acySupabaseClient;
      }
      if (!window.supabase?.createClient) return null;

      const response = await fetch('/api/config?_=2001', { cache: 'no-store' });
      const cfg = await response.json();
      if (!cfg?.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;

      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__acySupabaseClient = client;
      window.dispatchEvent(new CustomEvent('acy:supabase-ready'));
      return client;
    } catch (error) {
      console.debug('[V20] Supabase warmup skipped:', error);
      return null;
    }
  };

  window.__acySupabaseWarmupPromise = warm();
})();
