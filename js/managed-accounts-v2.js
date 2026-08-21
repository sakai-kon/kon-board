import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
const app = document.querySelector('#app');
const escapeHtml = (v='') => String(v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const validId = id => /^[a-z0-9_-]{3,32}$/.test(id);
const internalEmail = id => `managed_${id.toLowerCase()}@managed.kotoha.invalid`;
const invoke = async body => {
  if (!supabase) throw new Error('Supabaseの設定がまだ完了していません。');
  const { data, error } = await supabase.functions.invoke('admin-moderation', { body });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || '処理に失敗しました。');
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

function safeReset(form) {
  if (form && typeof form.reset === 'function' && form.isConnected) form.reset();
}

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
    <p class="managed-login-lead">管理者から発行されたユーザーIDとパスワードでログインしてください。</p>
    <form id="managed-login-form" class="auth-form">
      <label class="field"><span class="field-label">ユーザーID</span><input name="managedId" autocomplete="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+" placeholder="ユーザーID"></label>
      <label class="field"><span class="field-label">パスワード</span><input name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="パスワード"></label>
      <button class="button button-primary" type="submit">専用アカウントでログイン</button>
    </form>
    <div id="managed-login-message" class="auth-message" aria-live="polite"></div>
    <a href="#/login" class="button button-secondary">通常のログインへ</a>
  </div></section>`;
  const loginForm = app.querySelector('#managed-login-form');
  if (!loginForm) return;
  loginForm.onsubmit = async e => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const managedId = String(form.get('managedId') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const button = formElement.querySelector('button[type="submit"]');
    const message = app.querySelector('#managed-login-message');
    if (!message || !button) return;
    if (!validId(managedId)) { message.className='auth-message error'; message.textContent='ユーザーIDは英数字・_・-の3〜32文字です。'; return; }
    button.disabled = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: internalEmail(managedId), password });
      if (error || !data.user) {
        message.className = 'auth-message error';
        message.textContent = 'ログインに失敗しました。ユーザーIDとパスワードを確認してください。';
        return;
      }
      const isManaged = data.user.app_metadata?.kotoha_managed_account === true && data.user.app_metadata?.managed_id === managedId;
      if (!isManaged) {
        await supabase.auth.signOut();
        message.className = 'auth-message error';
        message.textContent = 'このページは管理者発行アカウント専用です。';
        return;
      }
      location.hash = '/home';
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
}

async function renderManagedAccounts() {
  if (!(await isAdmin())) { location.hash = '/home'; return; }
  app.innerHTML = `<section class="admin-page managed-accounts-page">
    <div class="section-heading"><div><p class="eyebrow">ACCOUNT MANAGEMENT</p><h1>発行アカウント管理</h1><p>特別アカウントはユーザーID・表示名・パスワードだけで発行します。権限は一般ユーザーです。</p></div><a href="#/admin" class="button button-secondary">← 管理画面へ</a></div>
    <div class="admin-card managed-create-card">
      <h2>アカウントを作成</h2>
      <form id="managed-create-form" class="managed-create-form">
        <label class="field"><span class="field-label">ユーザーID</span><input name="managedId" maxlength="32" minlength="3" pattern="[A-Za-z0-9_-]+" required placeholder="例: kotoha_001"></label>
        <label class="field"><span class="field-label">表示名</span><input name="displayName" maxlength="32" required placeholder="表示名"></label>
        <label class="field"><span class="field-label">初期パスワード</span><input name="password" type="password" minlength="8" required placeholder="8文字以上"></label>
        <button class="button button-primary" type="submit">アカウントを発行</button>
      </form>
      <div id="managed-create-message" class="auth-message" aria-live="polite"></div>
    </div>
    <div class="admin-card"><h2>発行済みアカウント</h2><div id="managed-account-list" class="managed-account-list"></div></div>
  </section>`;
  const list = app.querySelector('#managed-account-list');
  const message = app.querySelector('#managed-create-message');
  const createForm = app.querySelector('#managed-create-form');
  if (!list || !message || !createForm) return;
  const refresh = async () => {
    const { users = [] } = await invoke({ action: 'list_managed_accounts' });
    if (!list.isConnected) return;
    list.innerHTML = users.length ? users.map(u => `<div class="managed-account-row">
      <div><strong>${escapeHtml(u.display_name)}</strong><div class="meta">ID: ${escapeHtml(u.managed_id || '')} ・ 権限: 一般</div></div>
      <div class="managed-account-meta"><span class="muted">${new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium'}).format(new Date(u.created_at))}</span><button class="button button-danger button-small" data-delete-id="${escapeHtml(u.id)}">削除</button></div>
    </div>`).join('') : '<div class="empty">管理者発行アカウントはまだありません。</div>';
    list.querySelectorAll('[data-delete-id]').forEach(btn => btn.onclick = async () => {
      if (!confirm('この発行アカウントを削除しますか？')) return;
      btn.disabled = true;
      try { await invoke({ action: 'delete_managed_account', targetUserId: btn.dataset.deleteId }); await refresh(); }
      catch (e) { alert(e?.message || '削除に失敗しました。'); if (btn.isConnected) btn.disabled = false; }
    });
  };
  createForm.onsubmit = async e => {
    e.preventDefault();
    const formElement = e.currentTarget;
    if (!formElement || typeof formElement.reset !== 'function') return;
    const form = new FormData(formElement);
    const managedId = String(form.get('managedId') || '').trim().toLowerCase();
    const displayName = String(form.get('displayName') || '').trim();
    const password = String(form.get('password') || '');
    const button = formElement.querySelector('button[type="submit"]');
    message.textContent = '';
    if (!validId(managedId)) { message.className='auth-message error'; message.textContent='ユーザーIDは英数字・_・-の3〜32文字で設定してください。'; return; }
    if (password.length < 8) { message.className='auth-message error'; message.textContent='パスワードは8文字以上にしてください。'; return; }
    if (!button) return;
    button.disabled = true;
    try {
      const result = await invoke({ action: 'create_managed_account', managedId, displayName, password });
      message.className = 'auth-message success';
      message.textContent = `${result?.user?.managed_id || managedId} のアカウントを発行しました。専用ログインページから利用できます。`;
      safeReset(formElement);
      await refresh();
    } catch (error) {
      message.className = 'auth-message error';
      message.textContent = error?.message || 'アカウントの発行に失敗しました。';
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
  await refresh();
}

function addAdminLink() {
  const nav = document.querySelector('.site-header nav');
  if (!nav || nav.querySelector('#managed-account-link')) return;
  const link = document.createElement('a');
  link.id = 'managed-account-link'; link.href = '#/admin/accounts'; link.textContent = 'アカウント発行'; nav.appendChild(link);
}

function route() {
  const path = location.hash.slice(1).split('?')[0] || '/home';
  if (path === '/managed-login') return renderManagedLogin();
  if (path === '/admin/accounts') return renderManagedAccounts();
  if (path === '/admin') { isAdmin().then(ok => { if (ok) addAdminLink(); }); }
  if (path === '/login' || path === '/auth') addManagedLoginLink();
}
const observer = new MutationObserver(() => { const path=location.hash.slice(1).split('?')[0]||'/home'; if(path==='/login'||path==='/auth') addManagedLoginLink(); });
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange', route);
route();
