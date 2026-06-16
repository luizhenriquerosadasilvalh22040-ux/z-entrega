import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor para adicionar o token de acesso
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta para tratamento de refresh token automático em erro 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      try {
        // Faz a requisição de refresh (se usar cookies, o cookie de refreshToken é enviado automaticamente)
        const res = await axios.post(
          `${API_URL}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        );
        
        if (res.data?.status === 'success') {
          const { accessToken, refreshToken: newRefreshToken } = res.data.data;
          
          // Se retornou tokens no JSON (para testes/clientes CLI), salva
          if (accessToken) {
            localStorage.setItem('accessToken', accessToken);
          }
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }
          
          // Refaz a requisição original
          if (accessToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Se falhar o refresh, força logout local
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('role');
        localStorage.removeItem('isLogged');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
