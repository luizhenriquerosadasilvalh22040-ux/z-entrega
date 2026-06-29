import { ORDER_STATUS, PAYMENT_STATUS } from './orderStatus';

type MercadoPagoWebhookPayload = {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

export type PaymentWebhookAction =
  | 'APPROVE_PAYMENT'
  | 'CANCEL_PENDING_ORDER'
  | 'SKIP_FINAL_ORDER'
  | 'SKIP_NON_PENDING_REJECTION'
  | 'NO_STATUS_CHANGE';

const FINAL_PAYMENT_ORDER_STATUSES = new Set([
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.DELIVERED
]);

export const buildMercadoPagoEventId = (payload: MercadoPagoWebhookPayload): string => {
  const type = payload.type || 'unknown';
  const action = payload.action || 'unknown';
  const resourceId = payload.data?.id ? String(payload.data.id) : 'unknown';
  return `${type}:${action}:${resourceId}`;
};

export const resolvePaymentWebhookAction = (
  mpStatus: string,
  order: {
    status: string;
    paymentStatus?: string | null;
  }
): PaymentWebhookAction => {
  if (mpStatus === 'approved') {
    if (FINAL_PAYMENT_ORDER_STATUSES.has(order.status as any) || order.paymentStatus === PAYMENT_STATUS.REFUNDED) {
      return 'SKIP_FINAL_ORDER';
    }
    return 'APPROVE_PAYMENT';
  }

  if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
    if (order.status !== ORDER_STATUS.PENDING) {
      return 'SKIP_NON_PENDING_REJECTION';
    }
    return 'CANCEL_PENDING_ORDER';
  }

  return 'NO_STATUS_CHANGE';
};
