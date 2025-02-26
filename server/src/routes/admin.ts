export default [
  {
    method: 'GET',
    path: '/config',
    handler: 'admin.getConfig',
    config: {
      policies: [
        'admin::isAuthenticatedAdmin',
      ],
    },
  },
  {
    method: 'POST',
    path: '/config',
    handler: 'admin.updateConfig',
    config: {
      policies: [
        'admin::isAuthenticatedAdmin',
      ],
    },
  },
]; 