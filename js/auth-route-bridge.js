(() => {
  const isolatedRoutes = new Set(['#/login', '#/auth', '#/managed-login', '#/admin/accounts']);
  let managedModule = null;
  let loading = null;

  const currentRoute = () => window.location.hash.split('?')[0] || '#/home';
  const isIsolatedRoute = () => isolatedRoutes.has(currentRoute());

  const loadManagedModule = () => {
    if (managedModule) return Promise.resolve(managedModule);
    if (!loading) {
      loading = import(`./managed-accounts-v2.js?v=20260821-routefix`)
        .then(module => {
          managedModule = module;
          return module;
        })
        .finally(() => { loading = null; });
    }
    return loading;
  };

  const dispatchManagedRoute = async () => {
    if (!isIsolatedRoute()) return false;
    try {
      const module = await loadManagedModule();
      if (typeof module.handleManagedRoute === 'function') {
        return module.handleManagedRoute(currentRoute());
      }
      // Backward-compatible fallback for a module that exposes the older API.
      if (currentRoute() === '#/managed-login' && typeof module.renderManagedLogin === 'function') {
        module.renderManagedLogin();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to open managed account route:', error);
      return false;
    }
  };

  // Capture both user navigation and programmatic hash changes before the normal router.
  window.addEventListener('hashchange', event => {
    if (!isIsolatedRoute()) return;
    event.stopImmediatePropagation();
    if (currentRoute() === '#/auth') {
      history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/login`);
    }
    void dispatchManagedRoute();
  }, true);

  // Initial page load with #/managed-login must also render immediately.
  if (isIsolatedRoute()) void dispatchManagedRoute();

  // Expose a direct, deterministic opener for buttons/links.
  window.openManagedLogin = () => {
    if (currentRoute() !== '#/managed-login') {
      window.location.hash = '/managed-login';
    }
    return dispatchManagedRoute();
  };
})();
