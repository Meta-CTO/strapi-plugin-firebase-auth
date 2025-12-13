import settingsRoute from "./settingsRoutes";

export default {
  type: "admin",
  routes: [
    ...settingsRoute,
    // User management routes
    {
      method: "GET",
      path: "/users",
      handler: "userController.list",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "POST",
      path: "/users",
      handler: "userController.create",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "DELETE",
      path: "/users",
      handler: "userController.deleteMany",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "PUT",
      path: "/users/resetPassword/:id",
      handler: "userController.resetPassword",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "PUT",
      path: "/users/sendResetEmail/:id",
      handler: "userController.sendResetEmail",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "PUT",
      path: "/users/sendVerificationEmail/:id",
      handler: "userController.sendVerificationEmail",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/users/:id",
      handler: "userController.get",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "PUT",
      path: "/users/:id",
      handler: "userController.update",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "DELETE",
      path: "/users/:id",
      handler: "userController.delete",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
  ],
};
