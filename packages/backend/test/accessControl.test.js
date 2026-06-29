const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canAccessCustomerProfile,
  canUploadMedia,
  canManageOwnMerchantCatalog,
  canManageMerchantResource,
  canRunAdminOperation,
  canViewOrder
} = require('../dist/domain/accessControl');

const order = {
  customerId: 'customer-1',
  merchantId: 'merchant-1',
  delivererId: 'deliverer-1'
};

test('customer can only view own order', () => {
  assert.equal(canViewOrder({ userId: 'customer-1', role: 'customer' }, order), true);
  assert.equal(canViewOrder({ userId: 'customer-2', role: 'customer' }, order), false);
});

test('merchant can only view own store order', () => {
  assert.equal(canViewOrder({ userId: 'merchant-1', role: 'merchant' }, order), true);
  assert.equal(canViewOrder({ userId: 'merchant-2', role: 'merchant' }, order), false);
});

test('deliverer can only view assigned order', () => {
  assert.equal(canViewOrder({ userId: 'deliverer-1', role: 'deliverer' }, order), true);
  assert.equal(canViewOrder({ userId: 'deliverer-2', role: 'deliverer' }, order), false);
});

test('admin can view any order', () => {
  assert.equal(canViewOrder({ userId: 'admin-1', role: 'admin' }, order), true);
});

test('customer profile access is limited to owner or admin', () => {
  assert.equal(canAccessCustomerProfile({ userId: 'customer-1', role: 'customer' }, 'customer-1'), true);
  assert.equal(canAccessCustomerProfile({ userId: 'customer-2', role: 'customer' }, 'customer-1'), false);
  assert.equal(canAccessCustomerProfile({ userId: 'merchant-1', role: 'merchant' }, 'customer-1'), false);
  assert.equal(canAccessCustomerProfile({ userId: 'admin-1', role: 'admin' }, 'customer-1'), true);
});

test('merchant resource management is limited to owner or admin', () => {
  assert.equal(canManageMerchantResource({ userId: 'merchant-1', role: 'merchant' }, 'merchant-1'), true);
  assert.equal(canManageMerchantResource({ userId: 'merchant-2', role: 'merchant' }, 'merchant-1'), false);
  assert.equal(canManageMerchantResource({ userId: 'customer-1', role: 'customer' }, 'merchant-1'), false);
  assert.equal(canManageMerchantResource({ userId: 'admin-1', role: 'admin' }, 'merchant-1'), true);
});

test('admin operation is limited to admin role', () => {
  assert.equal(canRunAdminOperation({ userId: 'admin-1', role: 'admin' }), true);
  assert.equal(canRunAdminOperation({ userId: 'merchant-1', role: 'merchant' }), false);
  assert.equal(canRunAdminOperation({ userId: 'customer-1', role: 'customer' }), false);
  assert.equal(canRunAdminOperation(null), false);
});

test('merchant catalog management is limited to merchant role', () => {
  assert.equal(canManageOwnMerchantCatalog({ userId: 'merchant-1', role: 'merchant' }), true);
  assert.equal(canManageOwnMerchantCatalog({ userId: 'admin-1', role: 'admin' }), false);
  assert.equal(canManageOwnMerchantCatalog({ userId: 'customer-1', role: 'customer' }), false);
  assert.equal(canManageOwnMerchantCatalog(undefined), false);
});

test('media uploads are limited to merchants and admins', () => {
  assert.equal(canUploadMedia({ userId: 'merchant-1', role: 'merchant' }), true);
  assert.equal(canUploadMedia({ userId: 'admin-1', role: 'admin' }), true);
  assert.equal(canUploadMedia({ userId: 'customer-1', role: 'customer' }), false);
  assert.equal(canUploadMedia({ userId: 'deliverer-1', role: 'deliverer' }), false);
  assert.equal(canUploadMedia(undefined), false);
});
