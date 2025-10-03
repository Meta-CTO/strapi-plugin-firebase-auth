export default {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/",
      handler: "firebaseController.validateToken",
      config: {
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/emailLogin",
      handler: "firebaseController.emailLogin",
      config: {
        policies: [],
      },
    },
  ],
};
