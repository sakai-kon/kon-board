(() => {
  function isAuthRoute() {
    const hash = window.location.hash.split('?')[0];
    return hash === '#/login' || hash === '#/auth';
  }

  window.addEventListener('hashchange', event => {
    if (!isAuthRoute()) return;

    // app.js also listens for hashchange. Stop it from redirecting the
    // authentication route into the normal board router.
    event.stopImmediatePropagation();

    if (window.location.hash.split('?')[0] === '#/auth') {
      history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/login`);
    }

    // auth.js listens to popstate and renders the login/sign-up screen.
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, true);
})();
