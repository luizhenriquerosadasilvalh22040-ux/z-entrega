import crypto from 'crypto';

type HeaderReader = (name: string) => string | undefined;

const timingSafeEqualString = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const getMercadoPagoWebhookSecretFromHeaders = (getHeader: HeaderReader): string | undefined => {
  return getHeader('x-webhook-secret') || getHeader('x-mercadopago-webhook-secret');
};

export const assertMercadoPagoWebhookAuthorized = (
  getHeader: HeaderReader,
  expectedSecret?: string
): void => {
  if (!expectedSecret) return;

  const receivedSecret = getMercadoPagoWebhookSecretFromHeaders(getHeader);
  if (!receivedSecret || !timingSafeEqualString(receivedSecret, expectedSecret)) {
    const err: any = new Error('Webhook não autorizado.');
    err.statusCode = 401;
    throw err;
  }
};

export const verifyMetaSha256Signature = (
  rawBody: Buffer | undefined,
  appSecret: string | undefined,
  signatureHeader: string | undefined
): boolean => {
  if (!appSecret) return true;
  if (!rawBody || !signatureHeader?.startsWith('sha256=')) return false;

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return timingSafeEqualString(signatureHeader, expected);
};

export const maskWebhookPhone = (value?: string | null): string | null => {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
};

export const sanitizeMercadoPagoWebhookPayload = (payload: any): Record<string, unknown> => ({
  type: payload?.type,
  action: payload?.action,
  data: payload?.data?.id ? { id: String(payload.data.id) } : undefined
});

export const isSupportedMercadoPagoWebhookType = (type?: string): boolean => {
  return type === 'payment' || type === 'subscription' || type === 'preapproval';
};
