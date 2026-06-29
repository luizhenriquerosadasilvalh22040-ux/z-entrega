import {
  MerchantSubscriptionStatus,
  NotificationStatus,
  OrderStatus,
  PaymentWebhookEventStatus,
  PaymentRefundStatus,
  PaymentStatus,
  WhatsAppTemplateType
} from '@prisma/client';
import prisma from '../config/prisma';
import { DELIVERER_RESPONSE_STATUS } from '../domain/orderStatus';
import {
  serializeInactiveSubscriptionMerchantIssue,
  serializeOperationalRefundIssue
} from '../domain/operationalIssueSerialization';
import { serializeOperationalEvent } from '../domain/operationalEventSerialization';
import { scheduleDeliveryTimeout } from '../queues/deliveryQueue';
import { createDeliveryResponseToken } from '../utils/deliveryResponseToken';
import { AuditLogService, type AuditRequestContext } from './AuditLogService';
import { DeliveryDispatchService } from './DeliveryDispatchService';
import { NotificationService } from './NotificationService';
import { PaymentRefundService } from './PaymentRefundService';
import { WhatsAppTemplateService } from './WhatsAppTemplateService';

type OperationalSeverity = 'critical' | 'high' | 'medium';

type OperationalSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  lastCheckedAt: Date;
};

type OperationalIssuePayload = Record<string, any> & {
  severity: OperationalSeverity;
  ageMinutes: number;
  recommendedAction: string;
};

const getApiPublicUrl = (): string => {
  return (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
};

const buildDeliveryResponseUrl = (
  orderId: string,
  delivererId: string,
  action: 'accept' | 'reject'
): string => {
  const token = createDeliveryResponseToken(orderId, delivererId, action);
  return `${getApiPublicUrl()}/api/orders/${orderId}/delivery-response?delivererId=${delivererId}&action=${action}&token=${encodeURIComponent(token)}`;
};

const minutesSince = (date?: Date | string | null): number => {
  if (!date) return 0;
  const value = typeof date === 'string' ? new Date(date) : date;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
};

const buildSummary = (issues: Record<string, OperationalIssuePayload[]>): OperationalSummary => {
  const allIssues = Object.values(issues).flat();
  return {
    total: allIssues.length,
    critical: allIssues.filter((issue) => issue.severity === 'critical').length,
    high: allIssues.filter((issue) => issue.severity === 'high').length,
    medium: allIssues.filter((issue) => issue.severity === 'medium').length,
    lastCheckedAt: new Date()
  };
};

export class AdminOperationalService {
  public static async getOperationalIssues(): Promise<{ issues: any; counts: any; summary: OperationalSummary; recentEvents: any[] }> {
    const pendingPaymentThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const paidOrderAcceptanceThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const pendingRefundThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const deliveryResponseThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const [
      failedRefunds,
      stalePendingRefunds,
      failedNotifications,
      ordersWithoutDeliverer,
      deliveriesAwaitingResponse,
      stalePendingPayments,
      paidOrdersAwaitingMerchant,
      failedPaymentWebhooks,
      inactiveSubscriptionMerchants,
      recentAuditLogs
    ] = await Promise.all([
      prisma.paymentRefund.findMany({
        where: { status: PaymentRefundStatus.REFUND_FAILED },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          order: {
            select: {
              id: true,
              total: true,
              customer: { select: { name: true, phone: true } },
              merchant: { select: { name: true, phone: true } }
            }
          }
        }
      }),
      prisma.paymentRefund.findMany({
        where: {
          status: PaymentRefundStatus.PENDING,
          updatedAt: { lt: pendingRefundThreshold }
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        include: {
          order: {
            select: {
              id: true,
              total: true,
              customer: { select: { name: true, phone: true } },
              merchant: { select: { name: true, phone: true } }
            }
          }
        }
      }),
      prisma.notification.findMany({
        where: { status: NotificationStatus.FAILED },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.order.findMany({
        where: {
          status: OrderStatus.READY,
          delivererId: null
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        include: {
          customer: { select: { name: true } },
          merchant: { select: { name: true } }
        }
      }),
      prisma.order.findMany({
        where: {
          status: OrderStatus.READY,
          delivererId: { not: null },
          delivererStatus: DELIVERER_RESPONSE_STATUS.PENDING,
          updatedAt: { lt: deliveryResponseThreshold }
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        include: {
          customer: { select: { name: true } },
          merchant: { select: { name: true } },
          deliverer: { select: { id: true, name: true } }
        }
      }),
      prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: { in: ['PIX', 'Cartão'] },
          createdAt: { lt: pendingPaymentThreshold }
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          customer: { select: { name: true } },
          merchant: { select: { name: true } }
        }
      }),
      prisma.order.findMany({
        where: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.RECEIVED,
          createdAt: { lt: paidOrderAcceptanceThreshold }
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          customer: { select: { name: true } },
          merchant: { select: { name: true } }
        }
      }),
      prisma.paymentWebhookEvent.findMany({
        where: { status: PaymentWebhookEventStatus.FAILED },
        orderBy: { receivedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          provider: true,
          eventType: true,
          action: true,
          resourceId: true,
          orderId: true,
          status: true,
          errorMessage: true,
          receivedAt: true,
          processedAt: true
        }
      }),
      prisma.merchant.findMany({
        where: {
          isActive: true,
          subscriptionStatus: { in: [
            MerchantSubscriptionStatus.INACTIVE,
            MerchantSubscriptionStatus.PENDING,
            MerchantSubscriptionStatus.PAUSED,
            MerchantSubscriptionStatus.CANCELLED,
            MerchantSubscriptionStatus.FAILED
          ] }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          name: true,
          phone: true,
          subscriptionStatus: true,
          updatedAt: true
        }
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          actorType: true,
          action: true,
          entityType: true,
          entityId: true,
          orderId: true,
          merchantId: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);

    const dispatchSnapshots = new Map<string, any>();
    await Promise.all([...ordersWithoutDeliverer, ...deliveriesAwaitingResponse].map(async (order) => {
      dispatchSnapshots.set(order.id, await DeliveryDispatchService.getDispatchSnapshot(prisma, order.id));
    }));

    const issues = {
      failedRefunds: failedRefunds.map(serializeOperationalRefundIssue),
      stalePendingRefunds: stalePendingRefunds.map((refund) => ({
        ...serializeOperationalRefundIssue(refund),
        severity: minutesSince(refund.updatedAt) >= 30 ? 'critical' as const : 'high' as const,
        recommendedAction: 'Conferir se o Mercado Pago respondeu. Se não houver progresso, retentar com cuidado ou tratar manualmente.'
      })),
      failedNotifications: failedNotifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        userType: notification.userType,
        type: notification.type,
        status: notification.status,
        attempts: notification.attempts,
        errorMessage: notification.errorMessage,
        createdAt: notification.createdAt,
        lastAttemptAt: notification.lastAttemptAt,
        severity: notification.attempts >= 3 ? 'high' as const : 'medium' as const,
        ageMinutes: minutesSince(notification.lastAttemptAt || notification.createdAt),
        recommendedAction: 'Reenfileirar a notificação. Se repetir, validar template, número de destino e credenciais do WhatsApp.'
      })),
      ordersWithoutDeliverer: ordersWithoutDeliverer.map((order) => ({
        ...order,
        severity: minutesSince(order.updatedAt) >= 10 ? 'critical' as const : 'high' as const,
        ageMinutes: minutesSince(order.updatedAt),
        recommendedAction: 'Despachar para motoboy disponível. Se não houver motoboy, acionar atendimento operacional.',
        dispatch: dispatchSnapshots.get(order.id)
      })),
      deliveriesAwaitingResponse: deliveriesAwaitingResponse.map((order) => ({
        ...order,
        severity: minutesSince(order.updatedAt) >= 10 ? 'critical' as const : 'high' as const,
        ageMinutes: minutesSince(order.updatedAt),
        recommendedAction: 'Acompanhar timeout do motoboy. Se passou do prazo, reatribuir ou acionar atendimento.',
        dispatch: dispatchSnapshots.get(order.id)
      })),
      stalePendingPayments: stalePendingPayments.map((order) => ({
        ...order,
        severity: minutesSince(order.createdAt) >= 30 ? 'high' as const : 'medium' as const,
        ageMinutes: minutesSince(order.createdAt),
        recommendedAction: 'Aguardar webhook ou conferir o pagamento no Mercado Pago antes de liberar preparo.'
      })),
      paidOrdersAwaitingMerchant: paidOrdersAwaitingMerchant.map((order) => ({
        ...order,
        severity: minutesSince(order.createdAt) >= 20 ? 'critical' as const : 'high' as const,
        ageMinutes: minutesSince(order.createdAt),
        recommendedAction: 'Contatar lojista ou intervir operacionalmente. Pedido pago não deve ficar parado sem aceite.'
      })),
      failedPaymentWebhooks: failedPaymentWebhooks.map((event) => ({
        id: event.id,
        provider: event.provider,
        eventType: event.eventType,
        action: event.action,
        resourceId: event.resourceId,
        orderId: event.orderId,
        status: event.status,
        errorMessage: event.errorMessage,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
        severity: 'critical' as const,
        ageMinutes: minutesSince(event.processedAt || event.receivedAt),
        recommendedAction: 'Investigar webhook falhado antes de reconciliar pedido/pagamento. Evitar alteração manual sem checar idempotência.'
      })),
      inactiveSubscriptionMerchants: inactiveSubscriptionMerchants.map(serializeInactiveSubscriptionMerchantIssue)
    };

    return {
      issues,
      counts: {
        failedRefunds: issues.failedRefunds.length,
        stalePendingRefunds: issues.stalePendingRefunds.length,
        failedNotifications: issues.failedNotifications.length,
        ordersWithoutDeliverer: issues.ordersWithoutDeliverer.length,
        deliveriesAwaitingResponse: issues.deliveriesAwaitingResponse.length,
        stalePendingPayments: issues.stalePendingPayments.length,
        paidOrdersAwaitingMerchant: issues.paidOrdersAwaitingMerchant.length,
        failedPaymentWebhooks: issues.failedPaymentWebhooks.length,
        inactiveSubscriptionMerchants: issues.inactiveSubscriptionMerchants.length
      },
      summary: buildSummary(issues),
      recentEvents: recentAuditLogs.map(serializeOperationalEvent)
    };
  }

  public static async retryFailedRefund(
    refundId: string,
    adminId: string,
    auditContext?: AuditRequestContext
  ): Promise<void> {
    await PaymentRefundService.retryFailedRefund(refundId, {
      actorType: 'admin',
      actorId: adminId,
      context: auditContext
    });
  }

  public static async dispatchReadyOrder(
    orderId: string,
    adminId: string,
    auditContext?: AuditRequestContext
  ): Promise<{ orderId: string; delivererId: string; notificationId: string; dispatch: any }> {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { merchant: true }
      });

      if (!order) throw new Error('Pedido não encontrado.');
      if (order.status !== OrderStatus.READY) throw new Error('Pedido não está pronto para despacho.');
      if (order.delivererId) throw new Error('Pedido já possui motoboy vinculado.');

      const deliverer = await DeliveryDispatchService.findBestAvailableDeliverer(tx);
      if (!deliverer) throw new Error('Nenhum motoboy disponível para despacho.');

      await tx.order.update({
        where: { id: orderId },
        data: {
          delivererId: deliverer.id,
          delivererStatus: DELIVERER_RESPONSE_STATUS.PENDING
        }
      });

      await DeliveryDispatchService.createPendingAssignment(tx, orderId, deliverer.id);

      const pickupAddress = `${order.merchant.street}, ${order.merchant.number} - ${order.merchant.neighborhood}, ${order.merchant.city}`;
      const deliveryAddress = `${order.deliveryStreet}, ${order.deliveryNumber} - ${order.deliveryNeighborhood}, ${order.deliveryCity}` +
        (order.deliveryComplement ? `, Complemento: ${order.deliveryComplement}` : '') +
        (order.deliveryReference ? ` (Ref: ${order.deliveryReference})` : '');

      const notificationId = await NotificationService.queueNotification({
        userId: deliverer.id,
        userType: 'Deliverer',
        type: 'WhatsApp',
        target: deliverer.phone,
        content: await WhatsAppTemplateService.render(
          WhatsAppTemplateType.DELIVERY_REQUEST,
          {
            delivererName: deliverer.name,
            orderId,
            merchantName: order.merchant.name,
            pickupAddress,
            deliveryAddress,
            deliveryFee: Number(order.deliveryFee).toFixed(2),
            acceptUrl: buildDeliveryResponseUrl(orderId, deliverer.id, 'accept'),
            rejectUrl: buildDeliveryResponseUrl(orderId, deliverer.id, 'reject')
          },
          undefined,
          tx
        )
      }, tx);

      await AuditLogService.record(tx, {
        actorType: 'admin',
        actorId: adminId,
        action: 'ADMIN_DISPATCH_READY_ORDER',
        entityType: 'Order',
        entityId: orderId,
        orderId,
        merchantId: order.merchantId,
          metadata: {
            delivererId: deliverer.id,
            notificationId
          },
          context: auditContext
        });

      const dispatch = await DeliveryDispatchService.getDispatchSnapshot(tx, orderId);
      return { orderId, delivererId: deliverer.id, notificationId, dispatch };
    });

    await NotificationService.addJobToQueue(result.notificationId);
    await scheduleDeliveryTimeout(result.orderId, result.delivererId);
    return result;
  }
}
