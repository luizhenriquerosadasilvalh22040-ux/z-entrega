const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NOTIFICATION_QUEUE_ATTEMPTS,
  maskNotificationTarget,
  shouldNotifyCustomerForOrderStatus,
  shouldRetryNotification
} = require('../dist/domain/notificationPolicy');

test('notification target masking keeps only final digits visible', () => {
  assert.equal(maskNotificationTarget('+55 (44) 99999-8888'), '*********8888');
  assert.equal(maskNotificationTarget('123'), '****');
});

test('notification retry policy stops at configured max attempts', () => {
  assert.equal(shouldRetryNotification(NOTIFICATION_QUEUE_ATTEMPTS - 1), true);
  assert.equal(shouldRetryNotification(NOTIFICATION_QUEUE_ATTEMPTS), false);
});

test('ready status stays silent for the customer during courier dispatch', () => {
  assert.equal(shouldNotifyCustomerForOrderStatus('READY'), false);
  assert.equal(shouldNotifyCustomerForOrderStatus('IN_TRANSIT'), true);
});
