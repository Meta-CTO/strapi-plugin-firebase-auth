export const useFetch = () => {
  const fetchData = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(`/firebase-auth${url}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return response.json();
  };

  return {
    get: (url: string) => fetchData(url),
    put: (url: string, data: any) => fetchData(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  };
}; 