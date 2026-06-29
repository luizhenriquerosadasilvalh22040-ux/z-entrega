import { maskNotificationTarget } from './notificationPolicy';

type OperationalSeverity = 'critical' | 'high' | 'medium';

type OperationalIssuePayload = Record<string, any> & {
  severity: OperationalSeverity;
  ageMinutes: number;
  recommendedAction: string;
};

const minutesSince = (date?: Date | string | null): number => {
  if (!date) return 0;
  const value = typeof date === 'string' ? new Date(date) : date;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
};

const maskPhone = (phone?: string | null): string | null => phone ? maskNotificationTarget(phone) : null;

export const serializeOperationalRefundIssue = (refund: any): OperationalIssuePayload => ({
  id: refund.id,
  orderId: refund.orderId,
  paymentId: refund.paymentId,
  amount: Number(refund.amount),
  provider: refund.provider,
  providerRefundId: refund.providerRefundId,
  status: refund.status,
  reason: refund.reason,
  errorMessage: refund.errorMessage,
  createdAt: refund.createdAt,
  updatedAt: refund.updatedAt,
  processedAt: refund.processedAt,
  order: refund.order ? {
    id: refund.order.id,
    total: Number(refund.order.total),
    customer: refund.order.customer ? { name: refund.order.customer.name } : null,
    merchant: refund.order.merchant ? { name: refund.order.merchant.name } : null
  } : null,
  severity: 'critical',
  ageMinutes: minutesSince(refund.updatedAt),
  recommendedAction: 'Retentar estorno. Se falhar novamente, conferir Mercado Pago e tratar manualmente com registro operacional.',
  customerPhoneMasked: maskPhone(refund.order?.customer?.phone),
  merchantPhoneMasked: maskPhone(refund.order?.merchant?.phone)
});

export const serializeInactiveSubscriptionMerchantIssue = (merchant: any): OperationalIssuePayload => ({
  id: merchant.id,
  name: merchant.name,
  subscriptionStatus: merchant.subscriptionStatus,
  updatedAt: merchant.updatedAt,
  severity: 'medium',
  ageMinutes: minutesSince(merchant.updatedAt),
  recommendedAction: 'Verificar assinatura no Mercado Pago. Loja ativa com assinatura inativa não deve aparecer para clientes.',
  phoneMasked: maskPhone(merchant.phone)
});
