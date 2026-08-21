(() => {
  const managedLoginHash = '#/managed-login';
  const managedLoginUrl = 'managed-login.html';
  const isolatedRoutes = new Set(['#/login', '#/auth', '#/admin/accounts']);
  let managedModule = null;
  let loading = null;

  const currentRoute = () => window.location.hash.split('?')[0] || '#/home';
  const isIsolatedRoute = () => isolatedRoutes.has(currentRoute());

  const redirectManagedLogin = () => {
    if (currentRoute() !== managedLoginHash) return false;
    const suffix = window.location.search;
    window.location.replace(`${managedLoginUrl}${suffix}`);
    return true;
  };

  const loadManagedModule = () => {
    if (managedModule) return Promise.resolve(managedModule);
    if (!loading) {
      loading = import(`./managed-accounts-v2.js?v=20260821-standalone`)
        .then(module => {
          managedModule = module;
          return module;
        })
        .finally(() => { loading = null; });
    }
    return loading;
  };

  const dispatchManagedRoute = async () => {
    if (redirectManagedLogin()) return true;
    if (!isIsolatedRoute()) return false;
    try {
      const module = await loadManagedModule();
      if (typeof module.handleManagedRoute === 'function') return module.handleManagedRoute(currentRoute());
    } catch (error) {
      console.error('Failed to load managed account module:', error);
    }
    return false;
  };

  window.addEventListener('hashchange', event => {
    if (currentRoute() === managedLoginHash) {
      event.stopImmediatePropagation();
      redirectManagedLogin();
      return;
    }
    if (!isIsolatedRoute()) return;
    event.stopImmediatePropagation();
    if (currentRoute() === '#/auth') {
      history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/login`);
    }
    void dispatchManagedRoute();
  }, true);

  if (currentRoute() === managedLoginHash) {
    redirectManagedLogin();
  } else if (isIsolatedRoute()) {
    void dispatchManagedRoute();
  }

  window.openManagedLogin = () => {
    window.location.assign(managedLoginUrl);
  };
})();
