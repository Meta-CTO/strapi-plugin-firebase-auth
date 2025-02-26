export default [
  {
    method: 'POST',
    path: '/exchange-token',
    handler: 'firebase.exchangeToken',
    config: {
      auth: false,
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/validate-token',
    handler: 'firebase.validateToken',
    config: {
      auth: false,
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/override-access',
    handler: 'firebase.overrideAccess',
    config: {
      auth: false,
      policies: [],
    },
  },
];
