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
    complement?: string;
    referencePoint?: string;
  };
  savedAddresses?: {
    nickname: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    complement?: string;
    referencePoint?: string;
  }[];
  isForceClosed?: boolean;
  category?: string;
  operatingHours?: { open: string; close: string };
  paymentMethods?: string[];
}

interface AuthState {
  user: IUser | null;
  role: 'customer' | 'merchant' | 'admin' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, role: 'customer' | 'merchant' | 'admin') => Promise<void>;
  requestOtp: (phone: string, name?: string, address?: any) => Promise<{ isNewUser: boolean }>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
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
      let endpoint = '';
      if (role === 'customer') endpoint = '/auth/customer/login';
      else if (role === 'merchant') endpoint = '/auth/merchant/login';
      else if (role === 'admin') endpoint = '/auth/admin/login';

      const response = await apiClient.post(endpoint, { email, password });
      
      const { customer, merchant, admin } = response.data.data;
      let user = null;
      if (role === 'customer') user = customer;
      else if (role === 'merchant') user = merchant;
      else if (role === 'admin') user = admin;

      // Armazena apenas flags auxiliares (cookies contêm as chaves criptografadas reais)
      localStorage.setItem('role', role);
      localStorage.setItem('isLogged', 'true');

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

  requestOtp: async (phone, name, address) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res = await apiClient.post('/auth/customer/request-otp', { phone: cleanPhone, name, address });
      set({ isLoading: false });
      return res.data.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao solicitar código';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  verifyOtp: async (phone, code) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res = await apiClient.post('/auth/customer/verify-otp', { phone: cleanPhone, code });
      const { customer } = res.data.data;

      // Armazena apenas flags auxiliares
      localStorage.setItem('role', 'customer');
      localStorage.setItem('isLogged', 'true');

      set({
        user: customer,
        role: 'customer',
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Código inválido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
    } catch (err) {
      // Ignora falhas no logout do servidor
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');
    localStorage.removeItem('isLogged');

    set({
      user: null,
      role: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const isLogged = localStorage.getItem('isLogged') === 'true';
    const role = localStorage.getItem('role') as 'customer' | 'merchant' | 'admin';
    
    if (!isLogged || !role) {
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
      localStorage.removeItem('isLogged');
      set({ isAuthenticated: false, user: null, role: null, isLoading: false });
    }
  },
}));
