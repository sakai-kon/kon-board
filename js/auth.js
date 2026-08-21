import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const app = document.querySelector('#app');
const authRedirect = () => `${window.location.origin}${window.location.pathname}`;
const resetRedirect = () => `${window.location.origin}${window.location.pathname}?auth=reset`;

function message(text, type = 'notice') {
  const el = app?.querySelector('#auth-message');
  if (!el) return;
  el.className = `auth-status ${type}`;
  el.textContent = text;
}

function setBusy(button, busy, label, busyLabel = '処理中…') {
  if (!button) return;
  button.disabled = busy;
  button.innerHTML = busy ? `<span class="auth-spinner" aria-hidden="true"></span>${busyLabel}` : label;
}

function isResetMode() {
  return new URLSearchParams(window.location.search).get('auth') === 'reset';
}

function passwordFeedback(password) {
  const meter = app?.querySelector('#password-meter');
  if (!meter) return;
  if (!password) {
    meter.className = 'auth-password-meter';
    meter.textContent = '8文字以上を推奨しています。';
    return;
  }
  const strong = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  meter.className = `auth-password-meter ${strong ? 'good' : 'weak'}`;
  meter.textContent = strong ? '十分な長さです。' : '8文字以上、英字と数字を含めるのがおすすめです。';
}

function renderAuthShell(content) {
  if (!app) return;
  app.innerHTML = `<section class="auth-shell"><div class="auth-card">${content}</div></section>`;
}

function bindOAuth() {
  app?.querySelector('#auth-github')?.addEventListener('click', () => startOAuth('github'));
  app?.querySelector('#auth-google')?.addEventListener('click', () => startOAuth('google'));
}

async function startOAuth(provider) {
  if (!supabase) return message('Supabaseの設定がまだ完了していません。', 'error');
  const label = provider === 'google' ? 'Googleで続ける' : 'GitHubで続ける';
  const button = app?.querySelector(`#auth-${provider}`);
  setBusy(button, true, label);
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirect() },
  });
  if (error) {
    setBusy(button, false, label);
    message(`ログインを開始できませんでした: ${error.message}`, 'error');
  }
}

function renderLoginSignup() {
  renderAuthShell(`
    <div class="auth-header">
      <div class="auth-mark">KB</div>
      <p class="eyebrow">KON BOARD ACCOUNT</p>
      <h1>アカウントにアクセス</h1>
      <p>GitHub、Google、メールアドレスから好きな方法を選べます。</p>
    </div>

    <div class="auth-providers">
      <button id="auth-github" class="button auth-provider-button github" type="button"><span class="provider-icon">●</span>GitHubで続ける</button>
      <button id="auth-google" class="button button-secondary auth-provider-button google" type="button"><span class="provider-icon">G</span>Googleで続ける</button>
    </div>

    <div class="auth-divider"><span>メールアドレスを使う</span></div>

    <div class="auth-tabs" role="tablist" aria-label="認証方法">
      <button class="auth-tab active" data-auth-tab="login" type="button" role="tab" aria-selected="true">ログイン</button>
      <button class="auth-tab" data-auth-tab="signup" type="button" role="tab" aria-selected="false">新規登録</button>
    </div>

    <form id="email-login-form" class="auth-form" novalidate>
      <label class="field"><span class="field-label">メールアドレス</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
      <label class="field"><span class="field-label">パスワード</span><input name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="パスワードを入力"></label>
      <div class="auth-extra"><button id="forgot-password" class="auth-link" type="button">パスワードを忘れた？</button></div>
      <button class="button button-primary" type="submit">メールでログイン</button>
    </form>

    <form id="email-signup-form" class="auth-form hidden" novalidate>
      <label class="field"><span class="field-label">メールアドレス</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
      <label class="field"><span class="field-label">パスワード</span><input id="signup-password" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="8文字以上"></label>
      <div id="password-meter" class="auth-password-meter">8文字以上を推奨しています。</div>
      <label class="field"><span class="field-label">パスワード（確認）</span><input name="password_confirm" type="password" autocomplete="new-password" minlength="8" required placeholder="同じパスワードをもう一度"></label>
      <button class="button button-primary" type="submit">アカウントを作成</button>
      <p class="auth-help">登録後、メールアドレスの確認が必要な設定では確認メールが送信されます。</p>
    </form>

    <div id="auth-message" class="auth-message" aria-live="polite"></div>
    <div class="auth-actions"><a href="#/home" class="button button-secondary auth-back">← ホームへ戻る</a></div>
  `);

  bindOAuth();
  const loginForm = app.querySelector('#email-login-form');
  const signupForm = app.querySelector('#email-signup-form');

  app.querySelectorAll('[data-auth-tab]').forEach(tab => tab.addEventListener('click', () => {
    const signup = tab.dataset.authTab === 'signup';
    app.querySelectorAll('[data-auth-tab]').forEach(x => {
      const selected = x === tab;
      x.classList.toggle('active', selected);
      x.setAttribute('aria-selected', String(selected));
    });
    loginForm.classList.toggle('hidden', signup);
    signupForm.classList.toggle('hidden', !signup);
    const current = app.querySelector('#auth-message');
    if (current) current.innerHTML = '';
    current?.classList.remove('error', 'success', 'notice');
  }));

  app.querySelector('#forgot-password')?.addEventListener('click', renderForgotPassword);
  app.querySelector('#signup-password')?.addEventListener('input', e => passwordFeedback(e.target.value));

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return message('Supabaseの設定がまだ完了していません。', 'error');
    const form = new FormData(loginForm);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const button = loginForm.querySelector('button[type="submit"]');
    setBusy(button, true, 'メールでログイン');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(button, false, 'メールでログイン');
    if (error) {
      const detail = /confirm|verified|email/i.test(error.message)
        ? 'メールアドレスの確認が必要な可能性があります。確認メールを確認してください。'
        : 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
      message(detail, 'error');
      return;
    }
    window.location.hash = '/home';
  });

  signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return message('Supabaseの設定がまだ完了していません。', 'error');
    const form = new FormData(signupForm);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirm = String(form.get('password_confirm') || '');
    if (password.length < 8) return message('パスワードは8文字以上で入力してください。', 'error');
    if (password !== confirm) return message('パスワードが一致していません。', 'error');
    const button = signupForm.querySelector('button[type="submit"]');
    setBusy(button, true, 'アカウントを作成');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authRedirect() },
    });
    setBusy(button, false, 'アカウントを作成');
    if (error) {
      message(`登録に失敗しました: ${error.message}`, 'error');
      return;
    }
    if (data.session) {
      message('アカウントを作成しました。', 'success');
      window.location.hash = '/home';
      return;
    }
    renderVerification(email);
  });
}

function renderVerification(email) {
  renderAuthShell(`
    <div class="auth-header">
      <div class="auth-mark">✓</div>
      <p class="eyebrow">VERIFY EMAIL</p>
      <h1>メールを確認してください</h1>
      <p>登録を続けるには、届いた確認メールのリンクを開いてください。</p>
    </div>
    <div class="auth-email-preview">${escapeHtml(email)}</div>
    <div id="auth-message" class="auth-message"><div class="auth-status success">確認メールを送信しました。</div></div>
    <p class="auth-help">メールが見つからない場合は、迷惑メールフォルダも確認してください。</p>
    <div class="auth-actions">
      <button id="resend-confirmation" class="button button-primary" type="button">確認メールを再送する</button>
      <a href="#/login" class="button button-secondary auth-back">ログイン画面へ戻る</a>
    </div>
  `);
  app.querySelector('#resend-confirmation')?.addEventListener('click', async event => {
    if (!supabase) return;
    const button = event.currentTarget;
    setBusy(button, true, '確認メールを再送する', '再送信中…');
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirect() } });
    setBusy(button, false, '確認メールを再送する');
    if (error) message(`再送信に失敗しました: ${error.message}`, 'error');
    else message('確認メールをもう一度送信しました。', 'success');
  });
}

function renderForgotPassword() {
  renderAuthShell(`
    <div class="auth-header">
      <div class="auth-mark">↻</div>
      <p class="eyebrow">PASSWORD RESET</p>
      <h1>パスワードを再設定</h1>
      <p>登録済みのメールアドレスに再設定用のリンクを送ります。</p>
    </div>
    <form id="forgot-form" class="auth-form">
      <label class="field"><span class="field-label">メールアドレス</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
      <button class="button button-primary" type="submit">再設定メールを送る</button>
    </form>
    <div id="auth-message" class="auth-message" aria-live="polite"></div>
    <div class="auth-actions"><button id="forgot-back" class="button button-secondary" type="button">← ログインへ戻る</button></div>
  `);
  app.querySelector('#forgot-back')?.addEventListener('click', renderLoginSignup);
  app.querySelector('#forgot-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return message('Supabaseの設定がまだ完了していません。', 'error');
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    setBusy(button, true, '再設定メールを送る');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect() });
    setBusy(button, false, '再設定メールを送る');
    if (error) return message(`送信に失敗しました: ${error.message}`, 'error');
    message('再設定用のメールを送信しました。メール内のリンクを開いてください。', 'success');
  });
}

function renderResetPassword() {
  renderAuthShell(`
    <div class="auth-header">
      <div class="auth-mark">●</div>
      <p class="eyebrow">NEW PASSWORD</p>
      <h1>新しいパスワード</h1>
      <p>新しいパスワードを設定してください。</p>
    </div>
    <form id="reset-form" class="auth-form">
      <label class="field"><span class="field-label">新しいパスワード</span><input id="reset-password" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="8文字以上"></label>
      <div id="reset-password-meter" class="auth-password-meter">8文字以上を推奨しています。</div>
      <label class="field"><span class="field-label">パスワード（確認）</span><input name="password_confirm" type="password" autocomplete="new-password" minlength="8" required placeholder="同じパスワードをもう一度"></label>
      <button class="button button-primary" type="submit">パスワードを更新</button>
    </form>
    <div id="auth-message" class="auth-message" aria-live="polite"></div>
  `);
  const password = app.querySelector('#reset-password');
  const meter = app.querySelector('#reset-password-meter');
  password.addEventListener('input', () => {
    const value = password.value;
    const strong = value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
    meter.className = `auth-password-meter ${strong ? 'good' : value ? 'weak' : ''}`;
    meter.textContent = strong ? '十分な長さです。' : '8文字以上、英字と数字を含めるのがおすすめです。';
  });
  app.querySelector('#reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return message('Supabaseの設定がまだ完了していません。', 'error');
    const data = new FormData(event.currentTarget);
    const next = String(data.get('password') || '');
    const confirm = String(data.get('password_confirm') || '');
    if (next.length < 8) return message('パスワードは8文字以上で入力してください。', 'error');
    if (next !== confirm) return message('パスワードが一致していません。', 'error');
    const button = event.currentTarget.querySelector('button[type="submit"]');
    setBusy(button, true, 'パスワードを更新');
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(button, false, 'パスワードを更新');
    if (error) return message(`更新に失敗しました: ${error.message}`, 'error');
    history.replaceState({}, '', window.location.pathname);
    message('パスワードを更新しました。KON BOARDへ戻ります。', 'success');
    setTimeout(() => { window.location.hash = '/home'; }, 900);
  });
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
}

function renderAuthRoute() {
  if (!app) return;
  if (isResetMode()) {
    renderResetPassword();
    return;
  }
  if (window.location.hash === '#/login') renderLoginSignup();
}

window.addEventListener('hashchange', () => setTimeout(renderAuthRoute, 0));
window.addEventListener('popstate', renderAuthRoute);
setTimeout(renderAuthRoute, 0);
