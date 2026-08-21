import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const app = document.querySelector('#managed-login-app');
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const validId = (value) => /^[a-z0-9_-]{3,32}$/.test(value);
const internalEmail = (id) => `${id.toLowerCase()}@managed.kotohaboard.local`;
const setMessage = (text, type = 'notice') => {
  const el = document.querySelector('#managed-login-message');
  if (!el) return;
  el.className = `auth-status ${type}`;
  el.textContent = text;
};

function render() {
  if (!app) return;
  app.innerHTML = `
    <section class="managed-login-page">
      <div class="managed-login-card">
        <p class="eyebrow">KOTOHA BOARD</p>
        <h1>特別アカウントログイン</h1>
        <p class="managed-login-lead">管理者から発行されたユーザーIDとパスワードでログインしてください。</p>
        <form id="managed-login-form" class="auth-form" novalidate>
          <label class="field">
            <span class="field-label">ユーザーID</span>
            <input id="managed-id" name="managedId" autocomplete="username" inputmode="text" minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+" required placeholder="例: kotoha_001" />
          </label>
          <label class="field">
            <span class="field-label">パスワード</span>
            <input id="managed-password" name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="パスワード" />
          </label>
          <button id="managed-login-submit" class="button button-primary" type="submit">ログイン</button>
        </form>
        <div id="managed-login-message" class="auth-status" aria-live="polite"></div>
        <div class="managed-login-actions">
          <a href="./" class="button button-secondary">Kotoha Boardへ戻る</a>
          <a href="./#/login" class="button button-secondary">通常のログイン</a>
        </div>
      </div>
    </section>`;

  const form = document.querySelector('#managed-login-form');
  const button = document.querySelector('#managed-login-submit');
  if (!form || !button) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) {
      setMessage('認証設定を読み込めませんでした。', 'error');
      return;
    }

    const fd = new FormData(form);
    const managedId = String(fd.get('managedId') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');

    if (!validId(managedId)) {
      setMessage('ユーザーIDは英数字・_・-の3〜32文字で入力してください。', 'error');
      return;
    }
    if (password.length < 8) {
      setMessage('パスワードは8文字以上で入力してください。', 'error');
      return;
    }

    button.disabled = true;
    setMessage('ログインしています…');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail(managedId),
        password,
      });

      if (error || !data.user) {
        setMessage('ユーザーIDまたはパスワードが違います。', 'error');
        return;
      }

      const metadata = data.user.app_metadata || {};
      const storedId = String(metadata.managed_id || '').trim().toLowerCase();
      const managed = metadata.kotoha_managed_account === true && storedId === managedId;

      if (!managed) {
        await supabase.auth.signOut();
        setMessage('このアカウントは特別アカウントとして登録されていません。', 'error');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, role, account_status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setMessage('アカウント情報の確認に失敗しました。管理者に確認してください。', 'error');
        return;
      }

      if (profile.role !== 'user' || profile.account_status !== 'active') {
        await supabase.auth.signOut();
        setMessage('このアカウントは現在ログインできません。', 'error');
        return;
      }

      sessionStorage.setItem('kotoha_managed_login', '1');
      window.location.replace('./#/home');
    } catch (error) {
      console.error('Managed login failed:', error);
      setMessage('ログイン処理でエラーが発生しました。もう一度お試しください。', 'error');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

render();
