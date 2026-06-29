const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WHATSAPP_TEMPLATE_DEFINITIONS
} = require('../dist/services/WhatsAppTemplateService');

const getDefinition = (key) => WHATSAPP_TEMPLATE_DEFINITIONS.find((template) => template.key === key);

test('critical WhatsApp templates expose required variables', () => {
  const orderAccepted = getDefinition('ORDER_ACCEPTED');
  assert.ok(orderAccepted);
  assert.ok(orderAccepted.variables.includes('merchantName'));
  assert.ok(orderAccepted.variables.includes('estimatedTime'));

  const deliveryRequest = getDefinition('DELIVERY_REQUEST');
  assert.ok(deliveryRequest);
  assert.ok(deliveryRequest.variables.includes('acceptUrl'));
  assert.ok(deliveryRequest.variables.includes('rejectUrl'));
  assert.match(deliveryRequest.defaultBody, /{{acceptUrl}}/);
  assert.match(deliveryRequest.defaultBody, /{{rejectUrl}}/);
});
