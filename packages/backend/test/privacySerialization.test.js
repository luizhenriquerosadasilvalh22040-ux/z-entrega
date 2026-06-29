const test = require('node:test');
const assert = require('node:assert/strict');

const { formatCustomer } = require('../dist/services/CustomerService');
const { formatDeliverer } = require('../dist/services/DelivererService');
const { formatMerchant } = require('../dist/services/MerchantService');
const {
  serializeOperationalRefundIssue,
  serializeInactiveSubscriptionMerchantIssue
} = require('../dist/domain/operationalIssueSerialization');

test('customer serialization does not expose credentials, document, or OTP fields', () => {
  const formatted = formatCustomer({
    id: 'customer-1',
    name: 'Cliente',
    email: 'cliente@example.com',
    passwordHash: 'hashed-password',
    cpf: 'encrypted-cpf',
    phone: '5544999999999',
    isPhoneVerified: false,
    verificationCode: '1234',
    verificationCodeExpires: new Date(),
    isActive: true,
    termsAcceptedAt: new Date('2026-06-28T10:00:00.000Z'),
    privacyAcceptedAt: new Date('2026-06-28T10:00:00.000Z'),
    marketingConsent: true,
    addresses: []
  });

  assert.equal(formatted.passwordHash, undefined);
  assert.equal(formatted.cpf, undefined);
  assert.equal(formatted.verificationCode, undefined);
  assert.equal(formatted.verificationCodeExpires, undefined);
  assert.equal(formatted.hasPassword, true);
  assert.equal(formatted.hasCpf, true);
  assert.equal(formatted.marketingConsent, true);
});

test('merchant serialization does not expose password hash, encrypted CNPJ, or provider credentials', () => {
  const formatted = formatMerchant({
    id: 'merchant-1',
    name: 'Loja',
    email: 'loja@example.com',
    passwordHash: 'hashed-password',
    cnpj: 'encrypted-cnpj',
    mpAccessToken: 'mp-access-token',
    mpRefreshToken: 'mp-refresh-token',
    passwordResetToken: 'password-reset-token',
    passwordResetExpires: new Date(),
    phone: '5544999999999',
    category: 'Comida',
    paymentMethods: ['PIX'],
    isVerified: true,
    isActive: true,
    isForceClosed: false,
    subscriptionPrice: 125,
    subscriptionStatus: 'ACTIVE',
    openTime: '08:00',
    closeTime: '22:00',
    street: 'Rua A',
    number: '1',
    neighborhood: 'Centro',
    city: 'Rondon',
    state: 'PR',
    zipCode: '87800000',
    termsAcceptedAt: new Date('2026-06-28T10:00:00.000Z'),
    privacyAcceptedAt: new Date('2026-06-28T10:00:00.000Z'),
    marketingConsent: false
  });

  assert.equal(formatted.passwordHash, undefined);
  assert.equal(formatted.cnpj, undefined);
  assert.equal(formatted.mpAccessToken, undefined);
  assert.equal(formatted.mpRefreshToken, undefined);
  assert.equal(formatted.passwordResetToken, undefined);
  assert.equal(formatted.passwordResetExpires, undefined);
  assert.equal(formatted.hasCnpj, true);
  assert.equal(formatted.marketingConsent, false);
});

test('deliverer serialization does not expose password hash', () => {
  const formatted = formatDeliverer({
    id: 'deliverer-1',
    name: 'Motoboy',
    email: 'motoboy@example.com',
    passwordHash: 'hashed-password',
    phone: '5544999999999',
    vehicleType: 'Moto',
    licensePlate: 'ABC1D23',
    isActive: true,
    isAvailable: true,
    isActiveToday: true
  });

  assert.equal(formatted.passwordHash, undefined);
  assert.equal(formatted.email, 'motoboy@example.com');
});

test('operational refund issue serialization masks phones and removes raw customer/merchant phones', () => {
  const formatted = serializeOperationalRefundIssue({
    id: 'refund-1',
    orderId: 'order-1',
    paymentId: 'payment-1',
    amount: 42.5,
    provider: 'Mercado Pago',
    providerRefundId: 'provider-refund-1',
    status: 'REFUND_FAILED',
    reason: 'STORE_REJECTED',
    errorMessage: 'provider unavailable',
    createdAt: new Date('2026-06-28T10:00:00.000Z'),
    updatedAt: new Date('2026-06-28T10:10:00.000Z'),
    processedAt: null,
    order: {
      id: 'order-1',
      total: 42.5,
      customer: { name: 'Cliente', phone: '5544999999999' },
      merchant: { name: 'Loja', phone: '5544888888888' }
    }
  });

  assert.equal(formatted.order.customer.phone, undefined);
  assert.equal(formatted.order.merchant.phone, undefined);
  assert.equal(formatted.customerPhoneMasked.endsWith('9999'), true);
  assert.equal(formatted.customerPhoneMasked.includes('55449999'), false);
  assert.equal(formatted.merchantPhoneMasked.endsWith('8888'), true);
  assert.equal(formatted.merchantPhoneMasked.includes('55448888'), false);
});

test('inactive subscription issue serialization exposes only masked phone', () => {
  const formatted = serializeInactiveSubscriptionMerchantIssue({
    id: 'merchant-1',
    name: 'Loja',
    phone: '5544777777777',
    subscriptionStatus: 'FAILED',
    updatedAt: new Date('2026-06-28T10:00:00.000Z')
  });

  assert.equal(formatted.phone, undefined);
  assert.equal(formatted.phoneMasked.endsWith('7777'), true);
  assert.equal(formatted.phoneMasked.includes('55447777'), false);
});
