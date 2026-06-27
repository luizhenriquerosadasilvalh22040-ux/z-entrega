import crypto from 'crypto';
import { authConfig } from '../config/auth';

const DEFAULT_TTL_SECONDS = 5 * 60;

const getSecret = (): string => {
  return process.env.DELIVERY_RESPONSE_SECRET || authConfig.jwtSecret;
};

const signPayload = (payload: string): string => {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex');
};

export const createDeliveryResponseToken = (
  orderId: string,
  delivererId: string,
  action: 'accept' | 'reject',
  ttlSeconds = DEFAULT_TTL_SECONDS
): string => {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${orderId}.${delivererId}.${action}.${expiresAt}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`, 'utf8').toString('base64url');
};

export const verifyDeliveryResponseToken = (
  token: string,
  expectedOrderId: string,
  expectedDelivererId: string,
  expectedAction: 'accept' | 'reject'
): boolean => {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [orderId, delivererId, action, expiresAtRaw, signature] = decoded.split('.');

    if (!orderId || !delivererId || !action || !expiresAtRaw || !signature) {
      return false;
    }

    if (orderId !== expectedOrderId || delivererId !== expectedDelivererId || action !== expectedAction) {
      return false;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const payload = `${orderId}.${delivererId}.${action}.${expiresAtRaw}`;
    const expectedSignature = signPayload(payload);

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};
