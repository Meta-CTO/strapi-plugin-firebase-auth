export default {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/",
      handler: "firebaseController.validateToken",
      config: {
        auth: false, // Public endpoint - this IS the authentication endpoint
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/emailLogin",
      handler: "firebaseController.emailLogin",
      config: {
        auth: false, // Public endpoint - email/password login
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/forgotPassword",
      handler: "firebaseController.forgotPassword",
      config: {
        auth: false, // Public endpoint - no authentication required
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/resetPassword",
      handler: "firebaseController.resetPassword",
      config: {
        auth: false, // Public endpoint - uses JWT from Authorization header
        policies: [],
      },
    },
    {
      method: "GET",
      path: "/config",
      handler: "settingsController.getPublicConfig",
      config: {
        auth: false, // Public endpoint - frontend needs this for validation
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/requestMagicLink",
      handler: "firebaseController.requestMagicLink",
      config: {
        auth: false, // Public endpoint - passwordless authentication
        policies: [],
      },
    },
  ],
};
