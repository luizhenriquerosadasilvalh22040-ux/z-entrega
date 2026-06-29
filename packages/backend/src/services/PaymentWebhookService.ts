import logger from '../config/logger';
import prisma from '../config/prisma';
import { ORDER_STATUS, PAYMENT_STATUS } from '../domain/orderStatus';
import { MercadoPagoService } from './MercadoPagoService';
import { OrderPaymentSyncService } from './OrderPaymentSyncService';
import { InventoryService } from './InventoryService';
import { AuditLogService } from './AuditLogService';
import { SubscriptionService } from './SubscriptionService';
import {
  buildMercadoPagoEventId,
  resolvePaymentWebhookAction
} from '../domain/paymentWebhookDecision';
import { sanitizeMercadoPagoWebhookPayload } from '../domain/webhookSecurity';

type MercadoPagoWebhookPayload = {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

type WebhookResult = {
  status: 'processed' | 'duplicate' | 'skipped';
  eventId: string;
  orderId?: string;
  reason?: string;
};

const truncateWebhookError = (message?: string): string => {
  return (message || 'Erro ao processar webhook').slice(0, 500);
};

export class PaymentWebhookService {
  public static buildEventId(payload: MercadoPagoWebhookPayload): string {
    return buildMercadoPagoEventId(payload);
  }

  public static resolvePaymentAction(mpStatus: string, order: {
    status: string;
    paymentStatus?: string | null;
  }) {
    return resolvePaymentWebhookAction(mpStatus, order);
  }

  public static async processMercadoPagoWebhook(
    payload: MercadoPagoWebhookPayload,
    io?: any
  ): Promise<WebhookResult> {
    const resourceId = payload.data?.id ? String(payload.data.id) : undefined;
    if (!resourceId) {
      throw new Error('Missing notification data');
    }

    const eventId = this.buildEventId(payload);
    const webhookEvent = await this.acquireWebhookEvent(eventId, payload, resourceId);
    if (webhookEvent.status === 'PROCESSED' || webhookEvent.status === 'SKIPPED') {
      logger.info(`💳 [Mercado Pago Webhook] Evento duplicado ignorado: ${eventId}`);
      return { status: 'duplicate', eventId, reason: webhookEvent.status };
    }

    try {
      let result: WebhookResult;

      if (payload.type === 'payment') {
        result = await this.processPaymentEvent(webhookEvent.id, eventId, resourceId, payload, io);
      } else if (payload.type === 'subscription' || payload.type === 'preapproval') {
        result = await this.processSubscriptionEvent(webhookEvent.id, eventId, resourceId);
      } else {
        result = await this.skip(webhookEvent.id, eventId, 'unsupported_event_type');
      }

      return result;
    } catch (err: any) {
      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'FAILED',
          errorMessage: truncateWebhookError(err.message),
          processedAt: new Date()
        }
      });
      throw err;
    }
  }

  private static async acquireWebhookEvent(
    eventId: string,
    payload: MercadoPagoWebhookPayload,
    resourceId: string
  ): Promise<any> {
    const existingEvent = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: 'mercadopago',
          eventId
        }
      }
    });

    if (existingEvent?.status === 'PROCESSED' || existingEvent?.status === 'SKIPPED') {
      return existingEvent;
    }

    if (existingEvent) {
      return prisma.paymentWebhookEvent.update({
        where: { id: existingEvent.id },
        data: {
          status: 'PROCESSING',
          payload: sanitizeMercadoPagoWebhookPayload(payload) as any,
          errorMessage: null
        }
      });
    }

    try {
      return await prisma.paymentWebhookEvent.create({
        data: {
          provider: 'mercadopago',
          eventId,
          eventType: payload.type || null,
          action: payload.action || null,
          resourceId,
          payload: sanitizeMercadoPagoWebhookPayload(payload) as any,
          status: 'PROCESSING'
        }
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err;

      const concurrentEvent = await prisma.paymentWebhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: 'mercadopago',
            eventId
          }
        }
      });

      if (!concurrentEvent) throw err;
      return concurrentEvent;
    }
  }

  private static async processPaymentEvent(
    webhookEventId: string,
    eventId: string,
    paymentId: string,
    payload: MercadoPagoWebhookPayload,
    io?: any
  ): Promise<WebhookResult> {
    const order = await prisma.order.findFirst({
      where: { mpPaymentId: paymentId }
    });

    if (!order) {
      logger.warn(`⚠️ [Mercado Pago Webhook] Pedido com mpPaymentId ${paymentId} não encontrado.`);
      return this.skip(webhookEventId, eventId, 'payment_not_found');
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { orderId: order.id }
    });

    const mpStatus = await MercadoPagoService.getPaymentStatus(paymentId, order.merchantId);
    logger.info(`💳 [Mercado Pago Webhook] Status do pagamento ${paymentId}: ${mpStatus}`);

    const action = this.resolvePaymentAction(mpStatus, order);

    if (action === 'APPROVE_PAYMENT') {
      const updatedOrder = await OrderPaymentSyncService.confirmPaymentApproved(order.id);

      if (io && updatedOrder) {
        io.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
        io.to(`merchant:${order.merchantId}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
        io.to(`merchant:${order.merchantId}`).emit('newOrder', updatedOrder);
      }

      await this.markProcessed(webhookEventId);
      return { status: 'processed', eventId, orderId: order.id };
    }

    if (action === 'SKIP_FINAL_ORDER') {
      return this.skip(webhookEventId, eventId, 'approved_payment_for_final_order', order.id);
    }

    if (action === 'CANCEL_PENDING_ORDER') {
      await prisma.$transaction(async (tx) => {
        const cancelled = await tx.order.updateMany({
          where: {
            id: order.id,
            status: ORDER_STATUS.PENDING
          },
          data: {
            status: ORDER_STATUS.CANCELLED,
            paymentStatus: mpStatus === 'cancelled' ? PAYMENT_STATUS.CANCELLED : PAYMENT_STATUS.REJECTED
          }
        });

        if (cancelled.count > 0) {
          await InventoryService.restoreOrderStock(tx, order.id);
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: ORDER_STATUS.CANCELLED
            }
          });
          await AuditLogService.record(tx, {
            actorType: 'system',
            action: 'ORDER_CANCELLED_BY_PAYMENT_WEBHOOK',
            entityType: 'Order',
            entityId: order.id,
            orderId: order.id,
            merchantId: order.merchantId,
            metadata: {
              provider: 'mercadopago',
              paymentId,
              paymentStatus: mpStatus,
              webhookType: payload.type,
              webhookAction: payload.action
            }
          });
        }
      });

      if (io) {
        io.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.CANCELLED });
      }

      await this.markProcessed(webhookEventId);
      return { status: 'processed', eventId, orderId: order.id };
    }

    if (action === 'SKIP_NON_PENDING_REJECTION') {
      return this.skip(webhookEventId, eventId, 'rejected_payment_for_non_pending_order', order.id);
    }

    await this.markProcessed(webhookEventId);
    return { status: 'processed', eventId, orderId: order.id, reason: `payment_status_${mpStatus}` };
  }

  private static async processSubscriptionEvent(
    webhookEventId: string,
    eventId: string,
    subscriptionId: string
  ): Promise<WebhookResult> {
    const merchant = await prisma.merchant.findFirst({
      where: { mpSubscriptionId: subscriptionId }
    });

    if (!merchant) {
      return this.skip(webhookEventId, eventId, 'subscription_not_found');
    }

    const providerStatus = await MercadoPagoService.getSubscriptionStatus(subscriptionId);
    await SubscriptionService.syncMerchantSubscriptionFromProviderStatus({
      merchantId: merchant.id,
      providerSubscriptionId: subscriptionId,
      providerStatus,
      action: 'MERCHANT_SUBSCRIPTION_WEBHOOK_SYNCED'
    });

    await this.markProcessed(webhookEventId);
    return { status: 'processed', eventId, reason: `subscription_${providerStatus}` };
  }

  private static async markProcessed(webhookEventId: string): Promise<void> {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date()
      }
    });
  }

  private static async skip(
    webhookEventId: string,
    eventId: string,
    reason: string,
    orderId?: string
  ): Promise<WebhookResult> {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: 'SKIPPED',
        orderId,
        errorMessage: reason,
        processedAt: new Date()
      }
    });

    return { status: 'skipped', eventId, orderId, reason };
  }
}
