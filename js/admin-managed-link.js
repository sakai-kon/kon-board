import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
if (config.supabaseUrl && config.supabaseAnonKey) {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });

  async function isAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from('profiles').select('role, account_status').eq('id', user.id).maybeSingle();
    return profile?.role === 'admin' && profile?.account_status === 'active';
  }

  async function apply() {
    if (location.hash.split('?')[0] !== '#/admin') return;
    if (!(await isAdmin())) return;
    const heading = document.querySelector('.admin-page .section-heading');
    if (!heading || heading.querySelector('#managed-account-admin-link')) return;
    const link = document.createElement('a');
    link.id = 'managed-account-admin-link';
    link.className = 'button button-primary';
    link.href = './admin-managed-accounts.html';
    link.textContent = '特別アカウントを発行';
    const right = document.createElement('div');
    right.className = 'managed-login-actions';
    right.appendChild(link);
    heading.appendChild(right);
  }

  window.addEventListener('hashchange', () => setTimeout(apply, 0));
  new MutationObserver(() => apply()).observe(document.documentElement, { childList: true, subtree: true });
  apply();
}
