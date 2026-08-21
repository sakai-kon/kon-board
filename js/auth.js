import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const app = document.querySelector('#app');
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } })
  : null;

function showMessage(el, text, type='notice') {
  el.className = type;
  el.textContent = text;
}

function redirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

async function startOAuth(provider) {
  if (!supabase) return alert('Supabaseの設定がまだ完了していません。');
  const { error } = await supabase.auth.signInWithOAuth({ provider, options:{ redirectTo: redirectUrl() } });
  if (error) alert(error.message);
}

function renderLoginScreen() {
  if (location.hash !== '#/login' || !app) return;
  app.innerHTML = `<section class="auth-page auth-page-expanded">
    <p class="eyebrow">AUTHENTICATION</p>
    <h1>KON BOARDにログイン</h1>
    <p>好きな方法でログインまたは新規登録できます。</p>
    <div class="auth-actions auth-provider-actions">
      <button id="auth-github" class="button button-primary auth-provider-button" type="button">GitHubで続ける</button>
      <button id="auth-google" class="button button-secondary auth-provider-button" type="button">Googleで続ける</button>
    </div>
    <div class="auth-divider"><span>または</span></div>
    <div class="auth-tabs" role="tablist">
      <button class="auth-tab active" data-auth-tab="login" type="button">メールでログイン</button>
      <button class="auth-tab" data-auth-tab="signup" type="button">新規登録</button>
    </div>
    <form id="email-login-form" class="auth-email-form">
      <label>メールアドレス<input name="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
      <label>パスワード<input name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="8文字以上"></label>
      <button class="button button-primary" type="submit">メールでログイン</button>
    </form>
    <form id="email-signup-form" class="auth-email-form hidden">
      <label>メールアドレス<input name="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
      <label>パスワード<input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="8文字以上"></label>
      <label>パスワード（確認）<input name="password_confirm" type="password" autocomplete="new-password" minlength="8" required placeholder="もう一度入力"></label>
      <button class="button button-primary" type="submit">アカウントを作成</button>
    </form>
    <p id="auth-message" class="auth-message" aria-live="polite"></p>
    <a href="#/home" class="button button-secondary auth-home-button">← ホームへ戻る</a>
  </section>`;

  const message = app.querySelector('#auth-message');
  app.querySelector('#auth-github').onclick = () => startOAuth('github');
  app.querySelector('#auth-google').onclick = () => startOAuth('google');
  app.querySelectorAll('[data-auth-tab]').forEach(button => button.onclick = () => {
    const signup = button.dataset.authTab === 'signup';
    app.querySelectorAll('[data-auth-tab]').forEach(x => x.classList.toggle('active', x === button));
    app.querySelector('#email-login-form').classList.toggle('hidden', signup);
    app.querySelector('#email-signup-form').classList.toggle('hidden', !signup);
    message.className = 'auth-message';
    message.textContent = '';
  });

  app.querySelector('#email-login-form').onsubmit = async event => {
    event.preventDefault();
    if (!supabase) return showMessage(message, 'Supabaseの設定がまだ完了していません。');
    const data = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email:data.get('email').trim(), password:data.get('password') });
    button.disabled = false;
    if (error) return showMessage(message, 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。');
    location.hash = '/home';
  };

  app.querySelector('#email-signup-form').onsubmit = async event => {
    event.preventDefault();
    if (!supabase) return showMessage(message, 'Supabaseの設定がまだ完了していません。');
    const data = new FormData(event.currentTarget);
    const email = data.get('email').trim();
    const password = data.get('password');
    if (password !== data.get('password_confirm')) return showMessage(message, 'パスワードが一致しません。');
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const { data: result, error } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo: redirectUrl() } });
    button.disabled = false;
    if (error) return showMessage(message, `登録に失敗しました: ${error.message}`);
    if (result.session) {
      showMessage(message, 'アカウントを作成してログインしました。', 'success');
      location.hash = '/home';
      return;
    }
    showMessage(message, '確認メールを送信しました。メール内のリンクを開いて認証を完了してください。', 'success');
    event.currentTarget.reset();
  };
}

window.addEventListener('hashchange', () => setTimeout(renderLoginScreen, 0));
new MutationObserver(() => { if (location.hash === '#/login') renderLoginScreen(); }).observe(app, { childList:true });
setTimeout(renderLoginScreen, 0);
