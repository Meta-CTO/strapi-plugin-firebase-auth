const fetchData = async (url: string, options: RequestInit = {}) => {
  const baseUrl = `/admin/plugins/firebase-auth/settings${url}`;
  const token = window.localStorage.getItem('jwtToken');
  
  const response = await fetch(baseUrl, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error('API call failed');
  }

  return response.json();
};

export const api = {
  getConfig: () => 
    fetchData('/firebase-config'),

  saveConfig: (config: any) => 
    fetchData('/firebase-config', {
      method: 'POST',
      body: JSON.stringify({ firebaseConfigJson: config }),
    }),

  deleteConfig: () => 
    fetchData('/firebase-config', {
      method: 'DELETE',
    }),

  restartServer: () =>
    fetchData('/restart', {
      method: 'POST'
    })
}; 