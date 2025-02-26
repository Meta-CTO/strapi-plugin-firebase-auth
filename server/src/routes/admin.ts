export default [
  {
    method: 'GET',
    path: '/config',
    handler: 'admin.getConfig',
    config: {
      policies: [
        'admin::isAuthenticatedAdmin',
        { name: 'admin::hasPermissions', config: { actions: ['plugin::firebase-auth.settings.read'] } },
      ],
    },
  },
  {
    method: 'PUT',
    path: '/config',
    handler: 'admin.updateConfig',
    config: {
      policies: [
        'admin::isAuthenticatedAdmin',
        { name: 'admin::hasPermissions', config: { actions: ['plugin::firebase-auth.settings.read'] } },
      ],
    },
  },
]; 