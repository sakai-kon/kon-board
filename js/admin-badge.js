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
    span.textContent = 'ADMIN';
    return span;
  }

  function addBadgeAfterName(nameElement) {
    if (!nameElement || nameElement.parentElement?.querySelector('.admin-owner-badge')) return;
    nameElement.after(badge());
  }

  function apply(profile) {
    if (!profile) return;
    const adminName = profile.display_name?.trim();
    if (!adminName) return;

    // 投稿・コメント・スレッド詳細に表示される管理者本人の名前だけに ADMIN タグを付与
    document.querySelectorAll('.thread-author span, .detail-author strong, .comment-author strong').forEach(el => {
      if (el.textContent.trim() === adminName) addBadgeAfterName(el);
    });

    // 管理画面の自分の行にも表示
    document.querySelectorAll('.admin-user').forEach(row => {
      const strong = row.querySelector('strong');
      if (strong?.textContent.trim() === adminName) addBadgeAfterName(strong);
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
