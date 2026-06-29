import { ACTIVE_DELIVERY_ORDER_STATUSES } from '../domain/orderStateMachine';
import { DELIVERY_RESPONSE_TIMEOUT_MS } from '../domain/deliveryDispatchPolicy';

const DELIVERY_ASSIGNMENT_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  TIMED_OUT: 'TIMED_OUT',
  CANCELLED: 'CANCELLED'
} as const;

type DispatchSnapshot = {
  attemptCount: number;
  attemptedDelivererCount: number;
  pendingAssignment: any | null;
  lastAssignment: any | null;
  lastStatus: string | null;
  nextTimeoutAt: Date | null;
};

export class DeliveryDispatchService {
  public static async findBestAvailableDeliverer(
    tx: any,
    options: { excludeDelivererId?: string; excludeDelivererIds?: string[] } = {}
  ): Promise<any | null> {
    const excludedIds = new Set<string>();
    if (options.excludeDelivererId) excludedIds.add(options.excludeDelivererId);
    (options.excludeDelivererIds || []).forEach(id => excludedIds.add(id));

    const activeDeliverers = await tx.deliverer.findMany({
      where: {
        isActiveToday: true,
        isActive: true,
        isAvailable: true,
        ...(excludedIds.size > 0 ? { id: { notIn: [...excludedIds] } } : {})
      }
    });

    if (activeDeliverers.length === 0) {
      return null;
    }

    const delivererIds = activeDeliverers.map((deliverer: any) => deliverer.id);
    const activeDeliveriesCounts = await tx.order.groupBy({
      by: ['delivererId'],
      where: {
        delivererId: { in: delivererIds },
        status: { in: [...ACTIVE_DELIVERY_ORDER_STATUSES] }
      },
      _count: { id: true }
    });

    const countsMap = new Map<string, number>();
    activeDeliveriesCounts.forEach((count: any) => {
      if (count.delivererId) countsMap.set(count.delivererId, count._count.id);
    });

    activeDeliverers.sort((a: any, b: any) => {
      const countA = countsMap.get(a.id) || 0;
      const countB = countsMap.get(b.id) || 0;
      return countA - countB;
    });

    return activeDeliverers[0];
  }

  public static async createPendingAssignment(
    tx: any,
    orderId: string,
    delivererId: string,
    ttlMs = DELIVERY_RESPONSE_TIMEOUT_MS
  ): Promise<any> {
    await tx.deliveryAssignment.updateMany({
      where: {
        orderId,
        status: DELIVERY_ASSIGNMENT_STATUS.PENDING
      },
      data: {
        status: DELIVERY_ASSIGNMENT_STATUS.CANCELLED,
        respondedAt: new Date()
      }
    });

    const previousAttempts = await tx.deliveryAssignment.count({
      where: { orderId }
    });

    return tx.deliveryAssignment.create({
      data: {
        orderId,
        delivererId,
        status: DELIVERY_ASSIGNMENT_STATUS.PENDING,
        attempt: previousAttempts + 1,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMs)
      }
    });
  }

  public static async ensureAssignmentAccepted(
    tx: any,
    orderId: string,
    delivererId: string
  ): Promise<number> {
    const accepted = await this.markAssignmentAccepted(tx, orderId, delivererId);
    if (accepted > 0) return accepted;

    await this.createRespondedAssignment(tx, orderId, delivererId, DELIVERY_ASSIGNMENT_STATUS.ACCEPTED);
    return 1;
  }

  public static async ensureAssignmentRejected(
    tx: any,
    orderId: string,
    delivererId: string
  ): Promise<number> {
    const rejected = await this.markAssignmentRejected(tx, orderId, delivererId);
    if (rejected > 0) return rejected;

    await this.createRespondedAssignment(tx, orderId, delivererId, DELIVERY_ASSIGNMENT_STATUS.REJECTED);
    return 1;
  }

  private static async createRespondedAssignment(
    tx: any,
    orderId: string,
    delivererId: string,
    status: 'ACCEPTED' | 'REJECTED' | 'TIMED_OUT'
  ): Promise<any> {
    const previousAttempts = await tx.deliveryAssignment.count({
      where: { orderId }
    });

    return tx.deliveryAssignment.create({
      data: {
        orderId,
        delivererId,
        status,
        attempt: previousAttempts + 1,
        sentAt: new Date(),
        respondedAt: new Date()
      }
    });
  }

  public static async getAttemptedDelivererIds(tx: any, orderId: string): Promise<string[]> {
    const assignments = await tx.deliveryAssignment.findMany({
      where: { orderId },
      select: { delivererId: true }
    });

    return [...new Set<string>(assignments.map((assignment: any) => String(assignment.delivererId)))];
  }

  public static async getAttemptCount(tx: any, orderId: string): Promise<number> {
    return tx.deliveryAssignment.count({
      where: { orderId }
    });
  }

  public static async getDispatchSnapshot(tx: any, orderId: string): Promise<DispatchSnapshot> {
    const assignments = await tx.deliveryAssignment.findMany({
      where: { orderId },
      orderBy: [
        { attempt: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        deliverer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    });

    const pendingAssignment = assignments.find((assignment: any) => assignment.status === DELIVERY_ASSIGNMENT_STATUS.PENDING) || null;
    const lastAssignment = assignments[0] || null;
    const attemptedDelivererIds = new Set(assignments.map((assignment: any) => String(assignment.delivererId)));

    return {
      attemptCount: assignments.length,
      attemptedDelivererCount: attemptedDelivererIds.size,
      pendingAssignment,
      lastAssignment,
      lastStatus: lastAssignment?.status || null,
      nextTimeoutAt: pendingAssignment?.expiresAt || null
    };
  }

  public static async markAssignmentAccepted(
    tx: any,
    orderId: string,
    delivererId: string
  ): Promise<number> {
    const accepted = await tx.deliveryAssignment.updateMany({
      where: {
        orderId,
        delivererId,
        status: DELIVERY_ASSIGNMENT_STATUS.PENDING
      },
      data: {
        status: DELIVERY_ASSIGNMENT_STATUS.ACCEPTED,
        respondedAt: new Date()
      }
    });

    await tx.deliveryAssignment.updateMany({
      where: {
        orderId,
        delivererId: { not: delivererId },
        status: DELIVERY_ASSIGNMENT_STATUS.PENDING
      },
      data: {
        status: DELIVERY_ASSIGNMENT_STATUS.CANCELLED,
        respondedAt: new Date()
      }
    });

    return accepted.count;
  }

  public static async markAssignmentRejected(
    tx: any,
    orderId: string,
    delivererId: string
  ): Promise<number> {
    const rejected = await tx.deliveryAssignment.updateMany({
      where: {
        orderId,
        delivererId,
        status: DELIVERY_ASSIGNMENT_STATUS.PENDING
      },
      data: {
        status: DELIVERY_ASSIGNMENT_STATUS.REJECTED,
        respondedAt: new Date()
      }
    });

    return rejected.count;
  }

  public static async markAssignmentTimedOut(
    tx: any,
    orderId: string,
    delivererId: string
  ): Promise<number> {
    const timedOut = await tx.deliveryAssignment.updateMany({
      where: {
        orderId,
        delivererId,
        status: DELIVERY_ASSIGNMENT_STATUS.PENDING
      },
      data: {
        status: DELIVERY_ASSIGNMENT_STATUS.TIMED_OUT,
        respondedAt: new Date()
      }
    });

    return timedOut.count;
  }
}
