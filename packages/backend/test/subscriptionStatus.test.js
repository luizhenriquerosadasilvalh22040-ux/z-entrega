const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isMerchantPubliclyVisible,
  isMerchantSubscriptionActive,
  getMerchantPublicationBlockReason,
  mapMercadoPagoSubscriptionStatus,
  MERCHANT_SUBSCRIPTION_STATUS
} = require('../dist/domain/subscriptionStatus');

test('only ACTIVE subscription status is considered active', () => {
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.ACTIVE), true);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.PENDING), false);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.PAUSED), false);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.CANCELLED), false);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.FAILED), false);
});

test('merchant is public only when active and subscription is active', () => {
  const complete = {
    isActive: true, isVerified: true, isEmailVerified: true, subscriptionStatus: 'ACTIVE',
    cnpj: 'encrypted', street: 'Rua A', number: '1', neighborhood: 'Centro', city: 'Rondon', zipCode: '87800000'
  };
  assert.equal(isMerchantPubliclyVisible(complete), true);
  assert.equal(isMerchantPubliclyVisible({ ...complete, isActive: false }), false);
  assert.equal(isMerchantPubliclyVisible({ ...complete, isVerified: false }), false);
  assert.equal(isMerchantPubliclyVisible({ ...complete, isEmailVerified: false }), false);
  assert.equal(isMerchantPubliclyVisible({ ...complete, city: null }), false);
  assert.equal(isMerchantPubliclyVisible({ ...complete, subscriptionStatus: 'PENDING' }), false);
});

test('merchant publication block reason is explicit', () => {
  const complete = {
    isActive: true, isVerified: true, isEmailVerified: true, subscriptionStatus: 'ACTIVE',
    cnpj: 'encrypted', street: 'Rua A', number: '1', neighborhood: 'Centro', city: 'Rondon', zipCode: '87800000'
  };
  assert.equal(getMerchantPublicationBlockReason({ ...complete, isActive: false }), 'Loja inativa.');
  assert.equal(getMerchantPublicationBlockReason({ ...complete, isEmailVerified: false }), 'E-mail da loja ainda não confirmado.');
  assert.equal(getMerchantPublicationBlockReason({ ...complete, city: null }), 'Complete os dados fiscais e o endereço da loja.');
  assert.equal(getMerchantPublicationBlockReason({ ...complete, isVerified: false }), 'Loja ainda não aprovada pelo admin.');
  assert.equal(getMerchantPublicationBlockReason({ ...complete, subscriptionStatus: 'FAILED' }), 'Assinatura do lojista não está ativa.');
  assert.equal(getMerchantPublicationBlockReason(complete), null);
});

test('Mercado Pago subscription status maps to internal controlled status', () => {
  assert.equal(mapMercadoPagoSubscriptionStatus('authorized'), 'ACTIVE');
  assert.equal(mapMercadoPagoSubscriptionStatus('pending'), 'PENDING');
  assert.equal(mapMercadoPagoSubscriptionStatus('paused'), 'PAUSED');
  assert.equal(mapMercadoPagoSubscriptionStatus('cancelled'), 'CANCELLED');
  assert.equal(mapMercadoPagoSubscriptionStatus('rejected'), 'FAILED');
  assert.equal(mapMercadoPagoSubscriptionStatus('unexpected'), 'INACTIVE');
});
