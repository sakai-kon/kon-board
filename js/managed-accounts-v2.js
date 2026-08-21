import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.KON_BOARD_CONFIG || {};
const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const app = document.querySelector('#app');
const validId = id => /^[a-z0-9_-]{3,32}$/.test(id);
// Must exactly match the synthetic email format used by admin-moderation.
const internalEmail = id => `${id.toLowerCase()}@managed.kotohaboard.local`;
const escapeHtml = (v='') => String(v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

const invoke = async body => {
  if (!supabase) throw new Error('Supabaseの設定がまだ完了していません。');
  const { data, error } = await supabase.functions.invoke('admin-moderation', { body });
  if (error) throw error;
  if (data?.ok === false || data?.error) throw new Error(data?.error || '処理に失敗しました。');
  return data;
};
const isAdmin = async () => {
  if (!supabase) return false;
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('role,account_status').eq('id',user.id).maybeSingle();
  return data?.role === 'admin' && data?.account_status === 'active';
};

function renderManagedLogin() {
  if (!app) return;
  app.innerHTML = `<section class="managed-login-page"><div class="managed-login-card"><p class="eyebrow">KOTOHA BOARD</p><h1>発行アカウント専用ログイン</h1><p class="managed-login-lead">管理者から発行されたユーザーIDとパスワードでログインしてください。</p><form id="managed-login-form" class="auth-form"><label class="field"><span class="field-label">ユーザーID</span><input name="managedId" autocomplete="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+" placeholder="ユーザーID"></label><label class="field"><span class="field-label">パスワード</span><input name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="パスワード"></label><button class="button button-primary" type="submit">専用アカウントでログイン</button></form><div id="managed-login-message" class="auth-message" aria-live="polite"></div><a href="#/login" class="button button-secondary">通常のログインへ</a></div></section>`;
  const form = app.querySelector('#managed-login-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, fd = new FormData(f);
    const managedId = String(fd.get('managedId') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const button = f.querySelector('button[type="submit"]');
    const message = app.querySelector('#managed-login-message');
    if (!message || !button || !supabase) return;
    if (!validId(managedId)) { message.className='auth-message error'; message.textContent='ユーザーIDは英数字・_・-の3〜32文字です。'; return; }
    button.disabled = true; message.className='auth-message'; message.textContent='ログインを確認しています…';
    try {
      const {data,error} = await supabase.auth.signInWithPassword({email:internalEmail(managedId),password});
      if (error || !data.user) throw new Error('ユーザーIDまたはパスワードが違います。');
      const meta = data.user.app_metadata || {};
      const returnedId = String(meta.managed_id || '').toLowerCase();
      if (meta.kotoha_managed_account !== true || returnedId !== managedId) {
        await supabase.auth.signOut();
        throw new Error('このアカウントは管理者発行アカウントとして登録されていません。');
      }
      message.className='auth-message success'; message.textContent='ログインしました。移動しています…';
      location.hash='/home';
    } catch(err) { message.className='auth-message error'; message.textContent=err?.message || 'ログインに失敗しました。'; }
    finally { if (button.isConnected) button.disabled=false; }
  });
}

async function renderManagedAccounts() {
  if (!(await isAdmin())) { location.hash='/home'; return; }
  app.innerHTML=`<section class="admin-page managed-accounts-page"><div class="section-heading"><div><p class="eyebrow">ACCOUNT MANAGEMENT</p><h1>発行アカウント管理</h1><p>特別アカウントはユーザーID・表示名・パスワードだけで発行します。権限は一般ユーザーです。</p></div><a href="#/admin" class="button button-secondary">← 管理画面へ</a></div><div class="admin-card"><h2>アカウントを作成</h2><form id="managed-create-form" class="managed-create-form"><label class="field"><span class="field-label">ユーザーID</span><input name="managedId" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+"></label><label class="field"><span class="field-label">表示名</span><input name="displayName" required maxlength="32"></label><label class="field"><span class="field-label">初期パスワード</span><input name="password" type="password" required minlength="8"></label><button class="button button-primary" type="submit">アカウントを発行</button></form><div id="managed-create-message" class="auth-message"></div></div><div class="admin-card"><h2>発行済みアカウント</h2><div id="managed-account-list"></div></div></section>`;
  const list=app.querySelector('#managed-account-list'), message=app.querySelector('#managed-create-message'), form=app.querySelector('#managed-create-form');
  if(!list||!message||!form)return;
  const refresh=async()=>{const {users=[]}=await invoke({action:'list_managed_accounts'}); if(!list.isConnected)return; list.innerHTML=users.length?users.map(u=>`<div class="managed-account-row"><div><strong>${escapeHtml(u.display_name)}</strong><div class="meta">ID: ${escapeHtml(u.managed_id||'')} ・ 権限: 一般</div></div><button class="button button-danger button-small" data-delete-id="${escapeHtml(u.id)}">削除</button></div>`).join(''):'<div class="empty">管理者発行アカウントはまだありません。</div>'; list.querySelectorAll('[data-delete-id]').forEach(b=>b.onclick=async()=>{if(!confirm('削除しますか？'))return; b.disabled=true; try{await invoke({action:'delete_managed_account',targetUserId:b.dataset.deleteId});await refresh();}catch(e){alert(e?.message||'削除に失敗しました。'); if(b.isConnected)b.disabled=false;}});};
  form.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),managedId=String(fd.get('managedId')||'').trim().toLowerCase(),displayName=String(fd.get('displayName')||'').trim(),password=String(fd.get('password')||''),button=f.querySelector('button[type="submit"]');if(!validId(managedId)){message.className='auth-message error';message.textContent='ユーザーIDの形式が正しくありません。';return;}if(!button)return;button.disabled=true;try{const r=await invoke({action:'create_managed_account',managedId,displayName,password});message.className='auth-message success';message.textContent=`${r?.user?.managed_id||managedId} を発行しました。`;if(f.isConnected&&typeof f.reset==='function')f.reset();await refresh();}catch(err){message.className='auth-message error';message.textContent=err?.message||'アカウント発行に失敗しました。';}finally{if(button.isConnected)button.disabled=false;}});await refresh();
}

function addManagedLoginLink(){const host=app?.querySelector('.auth-actions');if(!host||host.querySelector('#managed-login-link'))return;const a=document.createElement('a');a.id='managed-login-link';a.className='managed-login-link';a.href='#/managed-login';a.textContent='管理者発行アカウント専用ログインはこちら';host.appendChild(a);}

export function handleManagedRoute(route=window.location.hash.slice(1).split('?')[0]||'/home'){
  if(route==='#/managed-login'||route==='/managed-login')return renderManagedLogin();
  if(route==='#/admin/accounts'||route==='/admin/accounts')return renderManagedAccounts();
  if(route==='#/login'||route==='#/auth'||route==='/login'||route==='/auth')return addManagedLoginLink();
  return false;
}

window.addEventListener('hashchange', () => handleManagedRoute());
handleManagedRoute();
