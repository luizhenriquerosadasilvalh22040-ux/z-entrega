import crypto from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

const getSecret = (): string => {
  const secret = process.env.MERCADO_PAGO_OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('Segredo do state OAuth do Mercado Pago não configurado.');
  return secret;
};

const sign = (payload: string): string =>
  crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');

export const createMercadoPagoOAuthState = (
  merchantId: string,
  now = Date.now(),
  nonce = crypto.randomBytes(16).toString('base64url')
): string => {
  const payload = Buffer.from(JSON.stringify({
    merchantId,
    expiresAt: now + STATE_TTL_MS,
    nonce
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const verifyMercadoPagoOAuthState = (
  state: string,
  now = Date.now()
): { merchantId: string } => {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) throw new Error('State OAuth inválido.');

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('Assinatura do state OAuth inválida.');
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!decoded.merchantId || !decoded.expiresAt || decoded.expiresAt < now) {
    throw new Error('State OAuth expirado ou inválido.');
  }

  return { merchantId: String(decoded.merchantId) };
};

