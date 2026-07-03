const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
);

export const SOCKET_URL = API_URL.replace(/\/api$/, '');

export const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || '';

export const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE || '5');

export const isMercadoPagoConfigured = (): boolean => MERCADO_PAGO_PUBLIC_KEY.trim().length > 0;
