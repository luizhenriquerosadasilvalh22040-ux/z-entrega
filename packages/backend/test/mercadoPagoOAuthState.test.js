const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MERCADO_PAGO_OAUTH_STATE_SECRET = 'test-secret-with-at-least-32-characters';

const {
  createMercadoPagoOAuthState,
  verifyMercadoPagoOAuthState
} = require('../dist/domain/mercadoPagoOAuthState');

test('Mercado Pago OAuth state is signed, scoped and expires', () => {
  const now = Date.now();
  const state = createMercadoPagoOAuthState('merchant-123', now, 'fixed-nonce');
  assert.deepEqual(verifyMercadoPagoOAuthState(state, now + 1000), { merchantId: 'merchant-123' });
  assert.throws(() => verifyMercadoPagoOAuthState(`${state}tampered`, now), /inválida/);
  assert.throws(() => verifyMercadoPagoOAuthState(state, now + 11 * 60 * 1000), /expirado/);
});

