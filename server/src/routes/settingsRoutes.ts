export default [
  {
    method: "POST",
    path: "/settings/token",
    handler: "settingsController.setToken",
    config: { policies: ["admin::isAuthenticatedAdmin"] },
  },
  {
    method: "POST",
    path: "/settings/firebase-config",
    handler: "settingsController.setFirebaseConfigJson",
    config: { policies: ["admin::isAuthenticatedAdmin"] },
  },
  {
    method: "GET",
    path: "/settings/firebase-config",
    handler: "settingsController.getFirebaseConfigJson",
    config: { policies: ["admin::isAuthenticatedAdmin"] },
  },
  {
    method: "DELETE",
    path: "/settings/firebase-config",
    handler: "settingsController.delFirebaseConfigJson",
    config: { policies: ["admin::isAuthenticatedAdmin"] },
  },
  {
    method: "POST",
    path: "/settings/restart",
    handler: "settingsController.restart",
    config: { policies: ["admin::isAuthenticatedAdmin"] },
  },
  {
    method: "POST",
    path: "/settings/password-config",
    handler: "settingsController.savePasswordConfig",
    config: { policies: ["admin::isAuthenticatedAdmin"] },
  },
];
