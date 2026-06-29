import {
  AuditActorType,
  PaymentStatus as PrismaPaymentStatus,
  PaymentRefundStatus,
  PaymentWebhookEventStatus
} from '@prisma/client';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { ORDER_STATUS, PAYMENT_STATUS } from '../domain/orderStatus';
import { resolvePaymentReconciliationAction } from '../domain/paymentReconciliation';
import { InventoryService } from './InventoryService';
import { MercadoPagoService } from './MercadoPagoService';
import { OrderPaymentSyncService } from './OrderPaymentSyncService';
import { PaymentRefundService } from './PaymentRefundService';
import { AuditLogService, type AuditRequestContext } from './AuditLogService';

type ReconciliationActor = {
  actorType: 'admin' | 'system';
  actorId?: string | null;
  context?: AuditRequestContext;
};

type ReconciliationSummary = {
  checked: number;
  updated: number;
  skipped: number;
  failed: number;
  actions: Record<string, number>;
  errors: Array<{ id: string; message: string }>;
};

const incrementAction = (summary: ReconciliationSummary, action: string): void => {
  summary.actions[action] = (summary.actions[action] || 0) + 1;
};

const createSummary = (): ReconciliationSummary => ({
  checked: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  actions: {},
  errors: []
});

const getActor = (actor?: ReconciliationActor): Required<Pick<ReconciliationActor, 'actorType'>> & Omit<ReconciliationActor, 'actorType'> => ({
  actorType: actor?.actorType || 'system',
  actorId: actor?.actorId || null,
  context: actor?.context
});

export class PaymentReconciliationService {
  public static async reconcileStalePendingPayments(
    actor?: ReconciliationActor,
    options: { olderThanMinutes?: number; take?: number; io?: any } = {}
  ): Promise<ReconciliationSummary> {
    const threshold = new Date(Date.now() - (options.olderThanMinutes ?? 15) * 60 * 1000);
    const orders = await prisma.order.findMany({
      where: {
        status: ORDER_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        paymentMethod: { in: ['PIX', 'Cartão'] },
        mpPaymentId: { not: null },
        createdAt: { lt: threshold }
      },
      orderBy: { createdAt: 'asc' },
      take: options.take ?? 50
    });

    const summary = createSummary();

    for (const order of orders) {
      summary.checked += 1;
      try {
        const providerStatus = await MercadoPagoService.getPaymentStatus(order.mpPaymentId!, order.merchantId);
        const action = resolvePaymentReconciliationAction(providerStatus, order);
        incrementAction(summary, action);

        if (action === 'CONFIRM_APPROVED_PAYMENT') {
          await OrderPaymentSyncService.confirmPaymentApproved(order.id);
          await this.audit('PAYMENT_RECONCILIATION_APPROVED', order, {
            provider: 'mercadopago',
            providerStatus
          }, actor);
          summary.updated += 1;
          options.io?.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
          options.io?.to(`merchant:${order.merchantId}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
          continue;
        }

        if (action === 'CANCEL_REJECTED_PENDING_ORDER' || action === 'MARK_PAYMENT_OVERDUE') {
          const paymentStatus = action === 'MARK_PAYMENT_OVERDUE'
            ? PAYMENT_STATUS.OVERDUE
            : providerStatus === 'cancelled'
              ? PAYMENT_STATUS.CANCELLED
              : PAYMENT_STATUS.REJECTED;

          const changed = await prisma.$transaction(async (tx) => {
            const result = await tx.order.updateMany({
              where: { id: order.id, status: ORDER_STATUS.PENDING },
              data: {
                status: ORDER_STATUS.CANCELLED,
                paymentStatus
              }
            });

            if (result.count > 0) {
              await InventoryService.restoreOrderStock(tx, order.id);
              await tx.orderStatusHistory.create({
                data: { orderId: order.id, status: ORDER_STATUS.CANCELLED }
              });
              await AuditLogService.record(tx, {
                actorType: getActor(actor).actorType as AuditActorType,
                actorId: actor?.actorId || null,
                action: 'PAYMENT_RECONCILIATION_CANCELLED',
                entityType: 'Order',
                entityId: order.id,
                orderId: order.id,
                merchantId: order.merchantId,
                metadata: {
                  provider: 'mercadopago',
                  providerStatus,
                  paymentStatus,
                  reason: action
                },
                context: actor?.context
              });
            }

            return result.count;
          });

          summary.updated += changed;
          if (changed > 0) {
            options.io?.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.CANCELLED });
          }
          continue;
        }

        summary.skipped += 1;
      } catch (err: any) {
        summary.failed += 1;
        summary.errors.push({ id: order.id, message: err.message });
        logger.error(`[Payment Reconciliation] Falha ao reconciliar pedido ${order.id}: ${err.message}`);
      }
    }

    return summary;
  }

  public static async retryFailedWebhooks(
    actor?: ReconciliationActor,
    options: { take?: number; io?: any } = {}
  ): Promise<ReconciliationSummary> {
    const events = await prisma.paymentWebhookEvent.findMany({
      where: { status: PaymentWebhookEventStatus.FAILED },
      orderBy: { receivedAt: 'asc' },
      take: options.take ?? 25
    });

    const summary = createSummary();

    for (const event of events) {
      summary.checked += 1;
      try {
        if (!event.resourceId) {
          incrementAction(summary, 'SKIP_MISSING_RESOURCE');
          summary.skipped += 1;
          continue;
        }

        const order = await prisma.order.findFirst({
          where: { mpPaymentId: event.resourceId }
        });

        if (!order) {
          incrementAction(summary, 'SKIP_ORDER_NOT_FOUND');
          summary.skipped += 1;
          continue;
        }

        const providerStatus = await MercadoPagoService.getPaymentStatus(event.resourceId, order.merchantId);
        const action = resolvePaymentReconciliationAction(providerStatus, order);
        incrementAction(summary, action);

        if (action === 'CONFIRM_APPROVED_PAYMENT') {
          await OrderPaymentSyncService.confirmPaymentApproved(order.id);
          await this.markWebhookReconciled(event.id, order.id, providerStatus, actor);
          summary.updated += 1;
          options.io?.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
          options.io?.to(`merchant:${order.merchantId}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
          continue;
        }

        if (action === 'CANCEL_REJECTED_PENDING_ORDER' || action === 'MARK_PAYMENT_OVERDUE') {
          const paymentStatus = action === 'MARK_PAYMENT_OVERDUE'
            ? PAYMENT_STATUS.OVERDUE
            : providerStatus === 'cancelled'
              ? PAYMENT_STATUS.CANCELLED
              : PAYMENT_STATUS.REJECTED;

          const changed = await this.cancelPendingOrderFromProviderStatus(order, providerStatus, paymentStatus, action, actor);
          await this.markWebhookReconciled(event.id, order.id, providerStatus, actor);
          summary.updated += changed > 0 ? 1 : 0;
          if (changed > 0) {
            options.io?.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.CANCELLED });
          }
          continue;
        }

        if (action === 'KEEP_PENDING') {
          summary.skipped += 1;
          continue;
        }

        await this.markWebhookReconciled(event.id, order.id, providerStatus, actor);
        summary.updated += 1;
      } catch (err: any) {
        summary.failed += 1;
        summary.errors.push({ id: event.id, message: err.message });
        logger.error(`[Payment Reconciliation] Falha ao reconciliar webhook ${event.id}: ${err.message}`);
      }
    }

    return summary;
  }

  public static async retryStalePendingRefunds(
    actor?: ReconciliationActor,
    options: { olderThanMinutes?: number; take?: number } = {}
  ): Promise<ReconciliationSummary> {
    const threshold = new Date(Date.now() - (options.olderThanMinutes ?? 10) * 60 * 1000);
    const refunds = await prisma.paymentRefund.findMany({
      where: {
        status: PaymentRefundStatus.PENDING,
        updatedAt: { lt: threshold }
      },
      orderBy: { updatedAt: 'asc' },
      take: options.take ?? 20,
      include: { order: true }
    });

    const summary = createSummary();

    for (const refund of refunds) {
      summary.checked += 1;
      try {
        if (!refund.order?.mpPaymentId) {
          incrementAction(summary, 'SKIP_MISSING_PAYMENT_ID');
          summary.skipped += 1;
          continue;
        }

        await prisma.paymentRefund.update({
          where: { id: refund.id },
          data: {
            status: PaymentRefundStatus.REFUND_FAILED,
            errorMessage: 'Refund pendente expirou e foi enviado para retentativa operacional.'
          }
        });

        await PaymentRefundService.retryFailedRefund(refund.id, actor);
        incrementAction(summary, 'RETRY_PENDING_REFUND');
        summary.updated += 1;
      } catch (err: any) {
        summary.failed += 1;
        summary.errors.push({ id: refund.id, message: err.message });
        logger.error(`[Payment Reconciliation] Falha ao retentar refund pendente ${refund.id}: ${err.message}`);
      }
    }

    return summary;
  }

  public static async runOperationalReconciliation(
    actor?: ReconciliationActor,
    options: { io?: any } = {}
  ): Promise<{
    pendingPayments: ReconciliationSummary;
    failedWebhooks: ReconciliationSummary;
    pendingRefunds: ReconciliationSummary;
  }> {
    const pendingPayments = await this.reconcileStalePendingPayments(actor, { io: options.io });
    const failedWebhooks = await this.retryFailedWebhooks(actor, { io: options.io });
    const pendingRefunds = await this.retryStalePendingRefunds(actor);

    return {
      pendingPayments,
      failedWebhooks,
      pendingRefunds
    };
  }

  private static async audit(
    action: string,
    order: { id: string; merchantId: string },
    metadata: Record<string, unknown>,
    actor?: ReconciliationActor
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await AuditLogService.record(tx, {
        actorType: getActor(actor).actorType as AuditActorType,
        actorId: actor?.actorId || null,
        action,
        entityType: 'Order',
        entityId: order.id,
        orderId: order.id,
        merchantId: order.merchantId,
        metadata,
        context: actor?.context
      });
    });
  }

  private static async cancelPendingOrderFromProviderStatus(
    order: { id: string; merchantId: string },
    providerStatus: string,
    paymentStatus: PrismaPaymentStatus,
    reason: string,
    actor?: ReconciliationActor
  ): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: ORDER_STATUS.PENDING },
        data: {
          status: ORDER_STATUS.CANCELLED,
          paymentStatus
        }
      });

      if (result.count > 0) {
        await InventoryService.restoreOrderStock(tx, order.id);
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, status: ORDER_STATUS.CANCELLED }
        });
        await AuditLogService.record(tx, {
          actorType: getActor(actor).actorType as AuditActorType,
          actorId: actor?.actorId || null,
          action: 'PAYMENT_RECONCILIATION_CANCELLED',
          entityType: 'Order',
          entityId: order.id,
          orderId: order.id,
          merchantId: order.merchantId,
          metadata: {
            provider: 'mercadopago',
            providerStatus,
            paymentStatus,
            reason
          },
          context: actor?.context
        });
      }

      return result.count;
    });
  }

  private static async markWebhookReconciled(
    eventId: string,
    orderId: string,
    providerStatus: string,
    actor?: ReconciliationActor
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.update({
        where: { id: eventId },
        data: {
          orderId,
          status: PaymentWebhookEventStatus.PROCESSED,
          errorMessage: `reconciled_provider_status_${providerStatus}`,
          processedAt: new Date()
        }
      });

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (order) {
        await AuditLogService.record(tx, {
          actorType: getActor(actor).actorType as AuditActorType,
          actorId: actor?.actorId || null,
          action: 'PAYMENT_WEBHOOK_RECONCILED',
          entityType: 'PaymentWebhookEvent',
          entityId: eventId,
          orderId,
          merchantId: order.merchantId,
          metadata: {
            provider: 'mercadopago',
            providerStatus
          },
          context: actor?.context
        });
      }
    });
  }
}
