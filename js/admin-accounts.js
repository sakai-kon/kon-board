import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
const app = document.querySelector('#app');

function ensureStyles() {
  if (document.querySelector('link[data-admin-accounts-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/admin-accounts.css';
  link.dataset.adminAccountsStyle = 'true';
  document.head.appendChild(link);
}
ensureStyles();

const escapeHtml = (v='') => String(v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const invoke = async body => {
  if (!supabase) throw new Error('Supabaseの設定がまだ完了していません。');
  const { data, error } = await supabase.functions.invoke('admin-moderation', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};
const isAdmin = async () => {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('role,account_status').eq('id', user.id).maybeSingle();
  return data?.role === 'admin' && data?.account_status === 'active';
};

function addManagedLoginLink() {
  const host = app?.querySelector('.auth-actions');
  if (!host || host.querySelector('#managed-login-link')) return;
  const link = document.createElement('a');
  link.id = 'managed-login-link';
  link.className = 'managed-login-link';
  link.href = '#/managed-login';
  link.textContent = '管理者発行アカウント専用ログインはこちら';
  host.appendChild(link);
}

function renderManagedLogin() {
  if (!app) return;
  app.innerHTML = `<section class="managed-login-page"><div class="managed-login-card">
    <p class="eyebrow">KOTOHA BOARD</p>
    <h1>発行アカウント専用ログイン</h1>
    <p class="managed-login-lead">管理者から発行されたメールアドレスとパスワードでログインしてください。</p>
    <form id="managed-login-form" class="auth-form">
      <label class="field"><span class="field-label">メールアドレス</span><input name="email" type="email" autocomplete="username" required placeholder="name@example.com"></label>
      <label class="field"><span class="field-label">パスワード</span><input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
      <button class="button button-primary" type="submit">専用アカウントでログイン</button>
    </form>
    <div id="managed-login-message" class="auth-message" aria-live="polite"></div>
    <a href="#/login" class="button button-secondary">通常のログインへ</a>
  </div></section>`;
  app.querySelector('#managed-login-form').onsubmit = async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const button = e.currentTarget.querySelector('button[type="submit"]');
    const message = app.querySelector('#managed-login-message');
    button.disabled = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(form.get('email')).trim(), password: String(form.get('password')) });
    button.disabled = false;
    if (error) {
      message.className = 'auth-message error';
      message.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
      return;
    }
    if (!data.user?.app_metadata?.kotoha_managed_account) {
      await supabase.auth.signOut();
      message.className = 'auth-message error';
      message.textContent = 'このページは管理者発行アカウント専用です。';
      return;
    }
    location.hash = '/home';
  };
}

async function renderManagedAccounts() {
  if (!(await isAdmin())) { location.hash = '/home'; return; }
  app.innerHTML = `<section class="admin-page managed-accounts-page">
    <div class="section-heading"><div><p class="eyebrow">ACCOUNT MANAGEMENT</p><h1>発行アカウント管理</h1><p>管理者が作成した専用アカウントを作成・削除できます。</p></div><a href="#/admin" class="button button-secondary">← 管理画面へ</a></div>
    <div class="admin-card managed-create-card">
      <h2>アカウントを作成</h2>
      <form id="managed-create-form" class="managed-create-form">
        <label class="field"><span class="field-label">表示名</span><input name="displayName" maxlength="32" required placeholder="表示名"></label>
        <label class="field"><span class="field-label">メールアドレス</span><input name="email" type="email" required placeholder="name@example.com"></label>
        <label class="field"><span class="field-label">初期パスワード</span><input name="password" type="password" minlength="8" required placeholder="8文字以上"></label>
        <button class="button button-primary" type="submit">アカウントを発行</button>
      </form>
      <div id="managed-create-message" class="auth-message" aria-live="polite"></div>
    </div>
    <div class="admin-card"><h2>発行済みアカウント</h2><div id="managed-account-list" class="managed-account-list"></div></div>
  </section>`;

  const list = app.querySelector('#managed-account-list');
  const message = app.querySelector('#managed-create-message');
  const refresh = async () => {
    const { users } = await invoke({ action: 'list_managed_accounts' });
    list.innerHTML = users.length ? users.map(u => `<div class="managed-account-row">
      <div><strong>${escapeHtml(u.display_name)}</strong><div class="meta">${escapeHtml(u.email || '')}</div></div>
      <div class="managed-account-meta"><span class="muted">作成: ${new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium'}).format(new Date(u.created_at))}</span><button class="button button-danger button-small" data-delete-id="${escapeHtml(u.id)}">削除</button></div>
    </div>`).join('') : '<div class="empty">管理者発行アカウントはまだありません。</div>';
    list.querySelectorAll('[data-delete-id]').forEach(btn => btn.onclick = async () => {
      if (!confirm('この発行アカウントを削除しますか？')) return;
      btn.disabled = true;
      try { await invoke({ action: 'delete_managed_account', targetUserId: btn.dataset.deleteId }); await refresh(); }
      catch (e) { alert(e.message); btn.disabled = false; }
    });
  };
  app.querySelector('#managed-create-form').onsubmit = async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const button = e.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = '';
    try {
      const result = await invoke({ action: 'create_managed_account', displayName: form.get('displayName'), email: form.get('email'), password: form.get('password') });
      message.className = 'auth-message success';
      message.textContent = `${result.user.display_name} のアカウントを発行しました。専用ログインページから利用できます。`;
      e.currentTarget.reset();
      await refresh();
    } catch (error) {
      message.className = 'auth-message error';
      message.textContent = error.message;
    } finally { button.disabled = false; }
  };
  await refresh();
}

function addAdminLink() {
  const nav = document.querySelector('.site-header nav');
  if (!nav || nav.querySelector('#managed-account-link')) return;
  const link = document.createElement('a');
  link.id = 'managed-account-link';
  link.href = '#/admin/accounts';
  link.textContent = 'アカウント発行';
  nav.appendChild(link);
}

function route() {
  const path = location.hash.slice(1).split('?')[0] || '/home';
  if (path === '/managed-login') return renderManagedLogin();
  if (path === '/admin/accounts') return renderManagedAccounts();
  if (path === '/admin') { isAdmin().then(ok => { if (ok) addAdminLink(); }); }
  if (path === '/login' || path === '/auth') addManagedLoginLink();
}

const observer = new MutationObserver(() => {
  const path = location.hash.slice(1).split('?')[0] || '/home';
  if (path === '/login' || path === '/auth') addManagedLoginLink();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', route);
route();
