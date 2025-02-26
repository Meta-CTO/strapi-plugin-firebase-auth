export const auth = {
  getToken: () => {
    // Get token from Strapi admin's localStorage
    return window.localStorage.getItem('jwtToken') || '';
  }
}; 