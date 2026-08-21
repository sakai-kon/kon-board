(() => {
  // Keep the authentication routes isolated from the normal board router.
  function isAuthRoute() {
    const hash = window.location.hash.split('?')[0];
    return hash === '#/login' || hash === '#/auth';
  }

  window.addEventListener('hashchange', event => {
    if (!isAuthRoute()) return;
    event.stopImmediatePropagation();
    if (window.location.hash.split('?')[0] === '#/auth') {
      history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/login`);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, true);

  // admin-accounts.js is loaded here so existing index.html files need no extra script tag.
  import('./admin-accounts.js').catch(error => console.error('Failed to load managed account module:', error));
})();
