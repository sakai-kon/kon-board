import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const app = document.querySelector('#managed-admin-app');
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const validId = (value) => /^[a-z0-9_-]{3,32}$/.test(value);
const escapeHtml = (value = '') => String(value).replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;'
}[char]));

function setMessage(text, type = 'notice') {
  const el = document.querySelector('#managed-admin-message');
  if (!el) return;
  el.className = `auth-status ${type}`;
  el.textContent = text;
}

async function invokeAdmin(body) {
  if (!supabase) throw new Error('Supabaseの設定を読み込めませんでした。');
  const { data, error } = await supabase.functions.invoke('admin-moderation', { body });
  if (error) throw error;
  if (data?.ok === false || data?.error) throw new Error(data.error || '処理に失敗しました。');
  return data;
}

async function ensureAdmin() {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, account_status, display_name')
    .eq('id', user.id)
    .maybeSingle();
  return profile?.role === 'admin' && profile?.account_status === 'active';
}

async function refreshList() {
  const list = document.querySelector('#managed-admin-list');
  if (!list) return;
  try {
    const { users = [] } = await invokeAdmin({ action: 'list_managed_accounts' });
    list.innerHTML = users.length
      ? users.map((user) => `<div class="managed-account-row">
          <div>
            <strong>${escapeHtml(user.display_name || '名無しさん')}</strong>
            <div class="meta">ID: ${escapeHtml(user.managed_id || '')} ・ 権限: 一般 ・ 状態: 有効</div>
          </div>
          <button class="button button-danger button-small" data-delete-id="${escapeHtml(user.id)}" type="button">削除</button>
        </div>`).join('')
      : '<div class="empty">管理者発行アカウントはまだありません。</div>';

    list.querySelectorAll('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('この特別アカウントを削除しますか？')) return;
        button.disabled = true;
        try {
          await invokeAdmin({ action: 'delete_managed_account', targetUserId: button.dataset.deleteId });
          setMessage('アカウントを削除しました。', 'success');
          await refreshList();
        } catch (error) {
          setMessage(error?.message || 'アカウント削除に失敗しました。', 'error');
          if (button.isConnected) button.disabled = false;
        }
      });
    });
  } catch (error) {
    setMessage(error?.message || 'アカウント一覧の取得に失敗しました。', 'error');
  }
}

async function start() {
  if (!app) return;
  if (!(await ensureAdmin())) {
    window.location.replace('./#/login');
    return;
  }

  app.innerHTML = `<section class="admin-page managed-accounts-page">
    <div class="section-heading">
      <div>
        <p class="eyebrow">ACCOUNT MANAGEMENT</p>
        <h1>特別アカウント発行</h1>
        <p>ユーザーID・表示名・パスワードだけで発行できます。発行アカウントの権限は常に一般ユーザーです。</p>
      </div>
      <div class="managed-login-actions">
        <a href="./managed-login.html" class="button button-secondary">専用ログインページ</a>
        <a href="./#/admin" class="button button-secondary">管理画面へ</a>
      </div>
    </div>

    <div class="admin-card managed-create-card">
      <h2>アカウントを作成</h2>
      <form id="managed-admin-form" class="managed-create-form" novalidate>
        <label class="field"><span class="field-label">ユーザーID</span><input name="managedId" minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+" required placeholder="例: kotoha_001" /></label>
        <label class="field"><span class="field-label">表示名</span><input name="displayName" maxlength="32" required placeholder="表示名" /></label>
        <label class="field"><span class="field-label">初期パスワード</span><input name="password" type="password" minlength="8" required placeholder="8文字以上" autocomplete="new-password" /></label>
        <button class="button button-primary" type="submit">特別アカウントを発行</button>
      </form>
      <div id="managed-admin-message" class="auth-status" aria-live="polite"></div>
    </div>

    <div class="admin-card">
      <div class="section-heading"><div><h2>発行済みアカウント</h2><p>ここに表示されるアカウントだけが管理者発行アカウントです。</p></div><button id="managed-admin-refresh" class="button button-secondary" type="button">再読み込み</button></div>
      <div id="managed-admin-list" class="managed-account-list"></div>
    </div>
  </section>`;

  const form = document.querySelector('#managed-admin-form');
  const refreshButton = document.querySelector('#managed-admin-refresh');
  refreshButton?.addEventListener('click', () => refreshList());
  await refreshList();

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const managedId = String(formData.get('managedId') || '').trim().toLowerCase();
    const displayName = String(formData.get('displayName') || '').trim();
    const password = String(formData.get('password') || '');
    const button = formElement.querySelector('button[type="submit"]');

    if (!validId(managedId)) return setMessage('ユーザーIDは英数字・_・-の3〜32文字で設定してください。', 'error');
    if (displayName.length < 1 || displayName.length > 32) return setMessage('表示名は1〜32文字で入力してください。', 'error');
    if (password.length < 8) return setMessage('パスワードは8文字以上にしてください。', 'error');
    if (!button) return;

    button.disabled = true;
    setMessage('アカウントを発行しています…');
    try {
      const result = await invokeAdmin({ action: 'create_managed_account', managedId, displayName, password });
      setMessage(`${result?.user?.managed_id || managedId} を発行しました。専用ログインページからログインできます。`, 'success');
      if (formElement.isConnected && typeof formElement.reset === 'function') formElement.reset();
      await refreshList();
    } catch (error) {
      setMessage(error?.message || 'アカウント発行に失敗しました。', 'error');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

start().catch((error) => {
  console.error('Managed account admin page failed:', error);
  setMessage(error?.message || 'ページの初期化に失敗しました。', 'error');
});
