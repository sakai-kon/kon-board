(() => {
  // Keep authentication and managed-account routes isolated from the normal board router.
  const isIsolatedRoute = () => {
    const hash = window.location.hash.split('?')[0];
    return hash === '#/login' || hash === '#/auth' || hash === '#/managed-login' || hash === '#/admin/accounts';
  };

  let managedModule = null;
  const loadManagedModule = () => managedModule
    ? Promise.resolve(managedModule)
    : import('./managed-accounts-v2.js').then(module => (managedModule = module));

  const dispatchManagedRoute = () => {
    if (!isIsolatedRoute()) return;
    loadManagedModule()
      .then(module => module.handleManagedRoute?.())
      .catch(error => console.error('Failed to load managed account module:', error));
  };

  window.addEventListener('hashchange', event => {
    if (!isIsolatedRoute()) return;
    event.stopImmediatePropagation();
    if (window.location.hash.split('?')[0] === '#/auth') {
      history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/login`);
    }
    dispatchManagedRoute();
  }, true);

  loadManagedModule().then(() => dispatchManagedRoute()).catch(error => {
    console.error('Failed to load managed account module:', error);
  });
})();
