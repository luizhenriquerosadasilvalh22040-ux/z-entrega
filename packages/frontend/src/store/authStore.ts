import { create } from 'zustand';
import { apiClient } from '../services/apiClient';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  category?: string;
  operatingHours?: { open: string; close: string };
  paymentMethods?: string[];
}

interface AuthState {
  user: IUser | null;
  role: 'customer' | 'merchant' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, role: 'customer' | 'merchant') => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password, role) => {
    set({ isLoading: true, error: null });
    try {
      const endpoint = role === 'customer' ? '/auth/customer/login' : '/auth/merchant/login';
      const response = await apiClient.post(endpoint, { email, password });
      
      const { customer, merchant, accessToken, refreshToken } = response.data.data;
      const user = role === 'customer' ? customer : merchant;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('role', role);

      set({
        user,
        role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao realizar login';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch (err) {
        // Ignora falhas no logout do servidor
      }
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');

    set({
      user: null,
      role: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const accessToken = localStorage.getItem('accessToken');
    const role = localStorage.getItem('role') as 'customer' | 'merchant';
    
    if (!accessToken || !role) {
      set({ isAuthenticated: false, user: null, role: null });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await apiClient.get('/auth/me');
      const { user } = response.data.data;
      
      set({
        user,
        role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('role');
      set({ isAuthenticated: false, user: null, role: null, isLoading: false });
    }
  },
}));
