const profileConfig = window.KON_BOARD_CONFIG || {};

(async () => {
  const profileLink = document.querySelector('#profile-link');
  const headerProfile = document.querySelector('#header-profile');
  const app = document.querySelector('#app');

  if (!profileConfig.supabaseUrl || !profileConfig.supabaseAnonKey) return;

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const client = createClient(profileConfig.supabaseUrl, profileConfig.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const escape = (value = '') => String(value).replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;'
  }[char]));

  async function getUser() {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async function getProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('id,display_name,avatar_url,role,account_status')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  function setSignedInUi(signedIn) {
    profileLink?.classList.toggle('hidden', !signedIn);
    if (headerProfile) {
      headerProfile.style.cursor = signedIn ? 'pointer' : '';
      headerProfile.title = signedIn ? 'プロフィール設定' : '';
      headerProfile.onclick = signedIn ? () => { location.hash = '/profile'; } : null;
    }
  }

  async function renderProfile() {
    const user = await getUser();
    if (!user) {
      location.hash = '/login';
      return;
    }

    const profile = await getProfile(user.id);
    const template = document.querySelector('#profile-template');
    if (!template) return;
    app.replaceChildren(template.content.cloneNode(true));

    const form = app.querySelector('#profile-form');
    const input = app.querySelector('#display-name');
    const message = app.querySelector('#profile-message');
    input.value = profile.display_name || '';

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const displayName = input.value.trim();
      message.className = '';
      message.textContent = '';

      if (!displayName) {
        message.className = 'notice';
        message.textContent = '表示名を入力してください。';
        return;
      }

      if (displayName.length > 32) {
        message.className = 'notice';
        message.textContent = '表示名は32文字以内で入力してください。';
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = '保存中…';

      const { error } = await client
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id);

      button.disabled = false;
      button.textContent = '表示名を保存';

      if (error) {
        message.className = 'notice';
        message.textContent = `保存に失敗しました: ${error.message}`;
        return;
      }

      message.className = 'success';
      message.textContent = '表示名を変更しました。過去の投稿・コメントにも反映されます。';

      if (headerProfile) {
        headerProfile.title = `${escape(displayName)} のプロフィール設定`;
        headerProfile.setAttribute('aria-label', `${displayName}のプロフィール設定`);
      }
    });
  }

  async function route() {
    setSignedInUi(Boolean(await getUser().catch(() => null)));
    const path = location.hash.slice(1).split('?')[0] || '/home';
    if (path === '/profile') await renderProfile();
  }

  await route();
  window.addEventListener('hashchange', () => { void route(); });
  client.auth.onAuthStateChange(() => { void route(); });
})();
