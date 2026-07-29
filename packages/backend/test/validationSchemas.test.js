const test = require('node:test');
const assert = require('node:assert/strict');

const { createCouponSchema } = require('../dist/validators/admin');
const {
  customerVerifyOtpSchema,
  merchantRegisterSchema,
  merchantVerifyEmailSchema
} = require('../dist/validators/auth');
const { createBannerSchema } = require('../dist/validators/banner');
const { createOrderSchema } = require('../dist/validators/order');
const { updateProductStockSchema } = require('../dist/validators/product');
const { createReviewSchema } = require('../dist/validators/review');
const { uploadImageSchema } = require('../dist/validators/upload');

test('admin coupon validation rejects impossible percentage discounts', () => {
  const { error } = createCouponSchema.validate({
    code: 'promo10',
    discountType: 'PERCENTAGE',
    discountValue: 150,
    expirationDate: '2027-01-01T00:00:00.000Z'
  });

  assert.ok(error);
});

test('admin coupon validation normalizes coupon code', () => {
  const { error, value } = createCouponSchema.validate({
    code: 'promo10',
    discountType: 'FIXED',
    discountValue: 10,
    expirationDate: '2027-01-01T00:00:00.000Z'
  });

  assert.equal(error, undefined);
  assert.equal(value.code, 'PROMO10');
});

test('product stock validation rejects negative stock and requires a mutable field', () => {
  assert.ok(updateProductStockSchema.validate({ stockQuantity: -1 }).error);
  assert.ok(updateProductStockSchema.validate({}).error);
  assert.equal(updateProductStockSchema.validate({ stockQuantity: 0, isPaused: true }).error, undefined);
});

test('order validation limits item quantity and accepts controlled payment methods only', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  const { error } = createOrderSchema.validate({
    merchantId: validId,
    items: [{ productId: validId, quantity: 100 }],
    paymentMethod: 'Boleto'
  });

  assert.ok(error);
});

test('upload validation accepts only image data URLs under configured shape', () => {
  assert.ok(uploadImageSchema.validate({ image: 'data:text/html;base64,PGgxPk9pPC9oMT4=' }).error);
  assert.equal(uploadImageSchema.validate({ image: 'data:image/png;base64,iVBORw0KGgo=' }).error, undefined);
});

test('OTP validation accepts only six numeric digits', () => {
  assert.ok(customerVerifyOtpSchema.validate({ phone: '5544999999999', code: '1234' }).error);
  assert.equal(customerVerifyOtpSchema.validate({ phone: '5544999999999', code: '123456' }).error, undefined);
  assert.ok(merchantVerifyEmailSchema.validate({ email: 'loja@example.com', code: 'abcdef' }).error);
});

test('merchant quick registration accepts only essential fields', () => {
  const { error } = merchantRegisterSchema.validate({
    name: 'Loja Teste',
    email: 'loja@example.com',
    password: 'senha-segura',
    phone: '5544999999999',
    category: 'Comida',
    termsAccepted: true,
    privacyAccepted: true
  });
  assert.equal(error, undefined);
});

test('banner validation rejects non-url image sources', () => {
  assert.ok(createBannerSchema.validate({ imageUrl: 'javascript:alert(1)' }).error);
  assert.equal(createBannerSchema.validate({ imageUrl: 'https://cdn.example.com/banner.png', title: 'Oferta' }).error, undefined);
});

test('review validation requires controlled rating and bounded comment', () => {
  assert.ok(createReviewSchema.validate({ rating: 6 }).error);
  assert.ok(createReviewSchema.validate({ rating: 5, comment: 'x'.repeat(501) }).error);
  assert.equal(createReviewSchema.validate({ rating: 5, comment: 'Muito bom' }).error, undefined);
});
