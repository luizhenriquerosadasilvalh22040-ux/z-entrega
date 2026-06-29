import prisma from '../config/prisma';
import logger from '../config/logger';
import { PAYMENT_STATUS } from '../domain/orderStatus';
import { MercadoPagoService } from './MercadoPagoService';
import { AuditLogService, type AuditRequestContext } from './AuditLogService';
import { PaymentRefundStatus } from '@prisma/client';

const REFUND_PROVIDER = 'mercadopago';

const mapRefundStatus = (status?: string): PaymentRefundStatus => {
  if (status === 'approved') return PaymentRefundStatus.approved;
  if (status === 'rejected') return PaymentRefundStatus.rejected;
  if (status === 'cancelled') return PaymentRefundStatus.cancelled;
  return PaymentRefundStatus.PENDING;
};

const isSuccessfulRefund = (status: PaymentRefundStatus): boolean => status === PaymentRefundStatus.approved;

const isUniqueConstraintError = (err: any): boolean => err?.code === 'P2002';

type RefundOrderInput = {
  id: string;
  merchantId: string;
  mpPaymentId?: string | null;
  total: number;
};

type RefundAuditInput = {
  initiatedByActorType?: 'customer' | 'merchant' | 'deliverer' | 'admin' | 'system';
  initiatedByActorId?: string | null;
  context?: AuditRequestContext;
  retryRefundId?: string;
};

export class PaymentRefundService {
  public static async retryFailedRefund(
    refundId: string,
    actor?: { actorType: 'admin' | 'system'; actorId?: string | null; context?: AuditRequestContext }
  ): Promise<void> {
    const refund = await prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: { order: true }
    });

    if (!refund) throw new Error('Refund não encontrado.');
    if (refund.status !== PaymentRefundStatus.REFUND_FAILED) {
      throw new Error('Apenas refunds com falha podem ser retentados.');
    }
    if (!refund.order.mpPaymentId) {
      throw new Error('Pedido sem identificador de pagamento para estorno.');
    }

    await prisma.$transaction(async (tx) => {
      await AuditLogService.record(tx, {
        actorType: actor?.actorType || 'system',
        actorId: actor?.actorId || null,
        action: 'PAYMENT_REFUND_RETRY_REQUESTED',
        entityType: 'PaymentRefund',
        entityId: refund.id,
        orderId: refund.order.id,
        merchantId: refund.order.merchantId,
        metadata: {
          previousStatus: refund.status,
          paymentId: refund.paymentId,
          amount: Number(refund.amount ?? refund.order.total)
        },
        context: actor?.context
      });
    });

    await this.refundCancelledOrder({
      id: refund.order.id,
      merchantId: refund.order.merchantId,
      mpPaymentId: refund.order.mpPaymentId,
      total: Number(refund.amount ?? refund.order.total)
    }, `Retry administrativo do refund ${refund.id}`, {
      initiatedByActorType: actor?.actorType || 'system',
      initiatedByActorId: actor?.actorId || null,
      context: actor?.context,
      retryRefundId: refund.id
    });
  }

  public static async refundCancelledOrder(
    order: RefundOrderInput,
    reason: string,
    audit?: RefundAuditInput
  ): Promise<void> {
    if (!order.mpPaymentId) {
      return;
    }

    const refundRecord = await this.acquireRefundRecord(order, reason, audit);
    if (!refundRecord) return;

    try {
      const refund = await MercadoPagoService.refundPayment(
        order.mpPaymentId,
        order.merchantId,
        Number(order.total)
      );
      const refundStatus = mapRefundStatus(refund.status);
      const paymentStatus = isSuccessfulRefund(refundStatus)
        ? PAYMENT_STATUS.REFUNDED
        : PAYMENT_STATUS.REFUND_FAILED;
      const auditAction = isSuccessfulRefund(refundStatus)
        ? 'PAYMENT_REFUND_SUCCEEDED'
        : 'PAYMENT_REFUND_FAILED';

      await prisma.$transaction(async (tx) => {
        await tx.paymentRefund.update({
          where: { id: refundRecord.id },
          data: {
            refundId: refund.id || null,
            amount: refund.amount ?? Number(order.total),
            status: refundStatus,
            reason,
            errorMessage: isSuccessfulRefund(refundStatus) ? null : `Mercado Pago retornou status ${refund.status || 'desconhecido'}`
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus }
        });

        await AuditLogService.record(tx, {
          actorType: 'system',
          action: auditAction,
          entityType: 'Order',
          entityId: order.id,
          orderId: order.id,
          merchantId: order.merchantId,
          metadata: {
            provider: REFUND_PROVIDER,
            amount: refund.amount ?? Number(order.total),
            refundId: refund.id,
            refundStatus,
            initiatedByActorType: audit?.initiatedByActorType || 'system',
            initiatedByActorId: audit?.initiatedByActorId || null
          },
          context: audit?.context
        });
      });
    } catch (err: any) {
      logger.error(`❌ [Refund] Falha ao estornar pedido ${order.id}: ${err.message}`);

      await prisma.$transaction(async (tx) => {
        await tx.paymentRefund.update({
          where: { id: refundRecord.id },
          data: {
            amount: Number(order.total),
            status: PaymentRefundStatus.REFUND_FAILED,
            reason,
            errorMessage: err.message
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: PAYMENT_STATUS.REFUND_FAILED }
        });

        await AuditLogService.record(tx, {
          actorType: 'system',
          action: 'PAYMENT_REFUND_FAILED',
          entityType: 'Order',
          entityId: order.id,
          orderId: order.id,
          merchantId: order.merchantId,
          metadata: {
            provider: REFUND_PROVIDER,
            errorMessage: err.message,
            initiatedByActorType: audit?.initiatedByActorType || 'system',
            initiatedByActorId: audit?.initiatedByActorId || null
          },
          context: audit?.context
        });
      });
    }
  }

  private static async acquireRefundRecord(
    order: RefundOrderInput,
    reason: string,
    audit?: RefundAuditInput
  ): Promise<{ id: string } | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        if (audit?.retryRefundId) {
          const retry = await tx.paymentRefund.updateMany({
            where: {
              id: audit.retryRefundId,
              status: PaymentRefundStatus.REFUND_FAILED,
              paymentId: order.mpPaymentId!,
              provider: REFUND_PROVIDER
            },
            data: {
              status: PaymentRefundStatus.PENDING,
              reason,
              errorMessage: null,
              amount: Number(order.total)
            }
          });

          if (retry.count === 0) {
            return null;
          }

          return { id: audit.retryRefundId };
        }

        const existing = await tx.paymentRefund.findFirst({
          where: {
            provider: REFUND_PROVIDER,
            paymentId: order.mpPaymentId!,
            status: {
              in: [PaymentRefundStatus.PENDING, PaymentRefundStatus.approved]
            }
          },
          orderBy: { updatedAt: 'desc' }
        });

        if (existing?.status === PaymentRefundStatus.approved) {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: PAYMENT_STATUS.REFUNDED }
          });
          return null;
        }

        if (existing?.status === PaymentRefundStatus.PENDING) {
          return null;
        }

        const refund = await tx.paymentRefund.create({
          data: {
            provider: REFUND_PROVIDER,
            orderId: order.id,
            paymentId: order.mpPaymentId!,
            amount: Number(order.total),
            status: PaymentRefundStatus.PENDING,
            reason
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: PAYMENT_STATUS.REFUND_PENDING }
        });

        return { id: refund.id };
      });
    } catch (err: any) {
      if (isUniqueConstraintError(err)) {
        return null;
      }
      throw err;
    }
  }
}
