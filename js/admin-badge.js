import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
if (config.supabaseUrl && config.supabaseAnonKey) {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  async function getAdminProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, role, account_status')
      .eq('id', user.id)
      .maybeSingle();
    return data?.role === 'admin' && data?.account_status === 'active' ? data : null;
  }

  function badge() {
    const span = document.createElement('span');
    span.className = 'admin-owner-badge';
    span.title = 'Kotoha Board 管理者';
    span.innerHTML = '<span class="admin-crown" aria-hidden="true">♛</span><span>ADMIN</span>';
    return span;
  }

  function apply(profile) {
    if (!profile) return;
    const header = document.querySelector('#header-profile');
    if (header && !header.querySelector('.admin-owner-badge')) header.appendChild(badge());

    const profileLink = document.querySelector('#profile-link');
    if (profileLink && !profileLink.querySelector('.admin-nav-crown')) {
      const crown = document.createElement('span');
      crown.className = 'admin-nav-crown';
      crown.textContent = '♛';
      crown.title = '管理者';
      profileLink.appendChild(crown);
    }

    document.querySelectorAll('.admin-user').forEach(row => {
      if (row.querySelector('.muted')?.textContent?.trim() === '自分' && !row.querySelector('.admin-owner-badge')) {
        row.querySelector('strong')?.after(badge());
      }
    });
  }

  let profile = null;
  async function refresh() {
    profile = await getAdminProfile();
    apply(profile);
  }

  const observer = new MutationObserver(() => apply(profile));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();
  supabase.auth.onAuthStateChange(() => setTimeout(refresh, 0));
}
