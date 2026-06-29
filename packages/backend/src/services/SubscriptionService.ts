import prisma from '../config/prisma';
import { mapMercadoPagoSubscriptionStatus } from '../domain/subscriptionStatus';
import { AuditLogService, type AuditRequestContext } from './AuditLogService';
import { MercadoPagoService } from './MercadoPagoService';

export class SubscriptionService {
  public static async createMerchantSubscription(
    merchantId: string,
    cardToken: string,
    email: string,
    auditContext?: AuditRequestContext
  ): Promise<any> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new Error('Lojista não encontrado.');

    const subscription = await MercadoPagoService.createSubscription(merchantId, cardToken, email);
    await this.syncMerchantSubscriptionFromProviderStatus({
      merchantId,
      providerSubscriptionId: String(subscription.id),
      providerStatus: String(subscription.status || 'pending'),
      action: 'MERCHANT_SUBSCRIPTION_CREATED',
      actorType: 'merchant',
      actorId: merchantId,
      auditContext
    });

    return subscription;
  }

  public static async cancelMerchantSubscription(
    merchantId: string,
    auditContext?: AuditRequestContext
  ): Promise<any> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant || !merchant.mpSubscriptionId) {
      throw new Error('Assinatura não encontrada para este lojista.');
    }

    const subscription = await MercadoPagoService.cancelSubscription(merchantId);
    await this.syncMerchantSubscriptionFromProviderStatus({
      merchantId,
      providerSubscriptionId: merchant.mpSubscriptionId,
      providerStatus: String(subscription.status || 'cancelled'),
      action: 'MERCHANT_SUBSCRIPTION_CANCELLED',
      actorType: 'merchant',
      actorId: merchantId,
      auditContext
    });

    return subscription;
  }

  public static async syncMerchantSubscriptionFromProviderStatus(params: {
    merchantId: string;
    providerSubscriptionId?: string | null;
    providerStatus?: string | null;
    action?: string;
    actorType?: 'merchant' | 'admin' | 'system';
    actorId?: string | null;
    auditContext?: AuditRequestContext;
  }): Promise<void> {
    const nextStatus = mapMercadoPagoSubscriptionStatus(params.providerStatus);

    await prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.findUnique({
        where: { id: params.merchantId }
      });
      if (!merchant) throw new Error('Lojista não encontrado.');

      await tx.merchant.update({
        where: { id: params.merchantId },
        data: {
          subscriptionStatus: nextStatus,
          ...(params.providerSubscriptionId ? { mpSubscriptionId: params.providerSubscriptionId } : {})
        }
      });

      await AuditLogService.record(tx, {
        actorType: params.actorType || 'system',
        actorId: params.actorId || null,
        action: params.action || 'MERCHANT_SUBSCRIPTION_SYNCED',
        entityType: 'Merchant',
        entityId: params.merchantId,
        merchantId: params.merchantId,
        metadata: {
          previousStatus: merchant.subscriptionStatus,
          nextStatus,
          provider: 'mercadopago',
          providerStatus: params.providerStatus,
          providerSubscriptionId: params.providerSubscriptionId || merchant.mpSubscriptionId
        },
        context: params.auditContext
      });
    });
  }
}
