(() => {
  const key = 'kon-board-theme';
  const root = document.documentElement;
  const button = document.querySelector('#theme-toggle');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const resolveTheme = (mode) => mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;

  function applyTheme(mode) {
    const resolved = resolveTheme(mode);
    root.dataset.theme = resolved;
    if (!button) return;
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    const icon = resolved === 'dark' ? '☀️' : '🌙';
    button.textContent = icon;
    button.setAttribute('data-mode', mode);
    button.setAttribute('aria-label', `テーマ: ${mode === 'system' ? 'システム' : mode === 'dark' ? 'ダーク' : 'ライト'}。クリックで切り替え`);
    button.title = `現在: ${mode === 'system' ? 'システム' : mode === 'dark' ? 'ダーク' : 'ライト'} / 次: ${next === 'system' ? 'システム' : next === 'dark' ? 'ダーク' : 'ライト'}`;
  }

  let mode = localStorage.getItem(key) || 'system';
  if (!['system', 'light', 'dark'].includes(mode)) mode = 'system';
  applyTheme(mode);

  button?.addEventListener('click', () => {
    mode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    localStorage.setItem(key, mode);
    applyTheme(mode);
  });

  media.addEventListener?.('change', () => {
    if (mode === 'system') applyTheme(mode);
  });
})();
