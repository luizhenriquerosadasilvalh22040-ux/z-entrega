const test = require('node:test');
const assert = require('node:assert/strict');

const { AuditLogService } = require('../dist/services/AuditLogService');

test('audit request context captures first forwarded IP and user agent', () => {
  const context = AuditLogService.getRequestContext({
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.1'
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.2' },
    get: (header) => header === 'user-agent' ? 'CodexTest/1.0' : undefined
  });

  assert.deepEqual(context, {
    ipAddress: '203.0.113.10',
    userAgent: 'CodexTest/1.0'
  });
});

test('audit request context falls back to request IP without user agent', () => {
  const context = AuditLogService.getRequestContext({
    headers: {},
    ip: '127.0.0.1',
    socket: {},
    get: () => undefined
  });

  assert.deepEqual(context, {
    ipAddress: '127.0.0.1',
    userAgent: null
  });
});
