const test = require('node:test');
const assert = require('node:assert/strict');

const { DeliveryDispatchService } = require('../dist/services/DeliveryDispatchService');
const {
  DELIVERY_MAX_ASSIGNMENT_ATTEMPTS,
  canTryAnotherDeliverer
} = require('../dist/domain/deliveryDispatchPolicy');

const createTx = (assignments = []) => ({
  deliveryAssignment: {
    findMany: async ({ where, orderBy }) => {
      const result = assignments.filter(assignment => assignment.orderId === where.orderId);
      if (orderBy) {
        return [...result].sort((a, b) => (b.attempt || 0) - (a.attempt || 0));
      }
      return result;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;

      for (const assignment of assignments) {
        const sameOrder = !where.orderId || assignment.orderId === where.orderId;
        const sameStatus = !where.status || assignment.status === where.status;
        const sameDeliverer = !where.delivererId ||
          (typeof where.delivererId === 'string'
            ? assignment.delivererId === where.delivererId
            : assignment.delivererId !== where.delivererId.not);

        if (sameOrder && sameStatus && sameDeliverer) {
          Object.assign(assignment, data);
          count += 1;
        }
      }

      return { count };
    },
    count: async ({ where }) => assignments.filter(assignment => assignment.orderId === where.orderId).length,
    create: async ({ data }) => {
      const assignment = { id: `assignment-${assignments.length + 1}`, ...data };
      assignments.push(assignment);
      return assignment;
    }
  }
});

test('creating a pending assignment cancels any previous pending attempt for the order', async () => {
  const assignments = [
    { orderId: 'order-1', delivererId: 'driver-1', status: 'PENDING', attempt: 1 },
    { orderId: 'order-2', delivererId: 'driver-9', status: 'PENDING', attempt: 1 }
  ];

  const tx = createTx(assignments);
  const created = await DeliveryDispatchService.createPendingAssignment(tx, 'order-1', 'driver-2', 300000);

  assert.equal(assignments[0].status, 'CANCELLED');
  assert.equal(assignments[1].status, 'PENDING');
  assert.equal(created.status, 'PENDING');
  assert.equal(created.attempt, 2);
  assert.equal(created.delivererId, 'driver-2');
  assert.ok(created.sentAt instanceof Date);
  assert.ok(created.expiresAt instanceof Date);
});

test('accepting an assignment locks the selected deliverer and cancels competing pending attempts', async () => {
  const assignments = [
    { orderId: 'order-1', delivererId: 'driver-1', status: 'PENDING', attempt: 1 },
    { orderId: 'order-1', delivererId: 'driver-2', status: 'PENDING', attempt: 2 },
    { orderId: 'order-2', delivererId: 'driver-3', status: 'PENDING', attempt: 1 }
  ];

  const tx = createTx(assignments);
  const acceptedCount = await DeliveryDispatchService.markAssignmentAccepted(tx, 'order-1', 'driver-2');

  assert.equal(acceptedCount, 1);
  assert.equal(assignments[0].status, 'CANCELLED');
  assert.equal(assignments[1].status, 'ACCEPTED');
  assert.equal(assignments[2].status, 'PENDING');
  assert.ok(assignments[0].respondedAt instanceof Date);
  assert.ok(assignments[1].respondedAt instanceof Date);
});

test('ensureAssignmentAccepted records a final response when pending assignment is missing', async () => {
  const assignments = [
    { orderId: 'order-1', delivererId: 'driver-1', status: 'REJECTED', attempt: 1 }
  ];

  const tx = createTx(assignments);
  const acceptedCount = await DeliveryDispatchService.ensureAssignmentAccepted(tx, 'order-1', 'driver-2');

  assert.equal(acceptedCount, 1);
  assert.equal(assignments.length, 2);
  assert.equal(assignments[1].status, 'ACCEPTED');
  assert.equal(assignments[1].attempt, 2);
  assert.equal(assignments[1].delivererId, 'driver-2');
  assert.ok(assignments[1].respondedAt instanceof Date);
});

test('ensureAssignmentRejected records a final response when pending assignment is missing', async () => {
  const assignments = [
    { orderId: 'order-1', delivererId: 'driver-1', status: 'TIMED_OUT', attempt: 1 }
  ];

  const tx = createTx(assignments);
  const rejectedCount = await DeliveryDispatchService.ensureAssignmentRejected(tx, 'order-1', 'driver-2');

  assert.equal(rejectedCount, 1);
  assert.equal(assignments.length, 2);
  assert.equal(assignments[1].status, 'REJECTED');
  assert.equal(assignments[1].attempt, 2);
  assert.equal(assignments[1].delivererId, 'driver-2');
  assert.ok(assignments[1].respondedAt instanceof Date);
});

test('attempted deliverers are collected to avoid retrying the same driver loop', async () => {
  const assignments = [
    { orderId: 'order-1', delivererId: 'driver-1', status: 'REJECTED', attempt: 1 },
    { orderId: 'order-1', delivererId: 'driver-2', status: 'TIMED_OUT', attempt: 2 },
    { orderId: 'order-1', delivererId: 'driver-1', status: 'REJECTED', attempt: 3 },
    { orderId: 'order-2', delivererId: 'driver-9', status: 'REJECTED', attempt: 1 }
  ];

  const tx = createTx(assignments);
  const attempted = await DeliveryDispatchService.getAttemptedDelivererIds(tx, 'order-1');

  assert.deepEqual(attempted.sort(), ['driver-1', 'driver-2']);
});

test('dispatch snapshot summarizes attempts, pending assignment, and last status', async () => {
  const expiresAt = new Date(Date.now() + 300000);
  const assignments = [
    { orderId: 'order-1', delivererId: 'driver-1', status: 'REJECTED', attempt: 1, createdAt: new Date('2026-01-01T10:00:00Z') },
    {
      orderId: 'order-1',
      delivererId: 'driver-2',
      status: 'PENDING',
      attempt: 2,
      createdAt: new Date('2026-01-01T10:05:00Z'),
      expiresAt,
      deliverer: { id: 'driver-2', name: 'Driver 2', phone: '44999999999' }
    },
    { orderId: 'order-2', delivererId: 'driver-9', status: 'PENDING', attempt: 1, createdAt: new Date('2026-01-01T10:10:00Z') }
  ];

  const tx = createTx(assignments);
  const snapshot = await DeliveryDispatchService.getDispatchSnapshot(tx, 'order-1');

  assert.equal(snapshot.attemptCount, 2);
  assert.equal(snapshot.attemptedDelivererCount, 2);
  assert.equal(snapshot.pendingAssignment.delivererId, 'driver-2');
  assert.equal(snapshot.lastAssignment.delivererId, 'driver-2');
  assert.equal(snapshot.lastStatus, 'PENDING');
  assert.equal(snapshot.nextTimeoutAt, expiresAt);
});

test('delivery dispatch policy stops after max attempts', () => {
  assert.equal(canTryAnotherDeliverer(DELIVERY_MAX_ASSIGNMENT_ATTEMPTS - 1), true);
  assert.equal(canTryAnotherDeliverer(DELIVERY_MAX_ASSIGNMENT_ATTEMPTS), false);
});
