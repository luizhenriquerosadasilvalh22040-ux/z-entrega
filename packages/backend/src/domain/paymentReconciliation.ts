import { ORDER_STATUS, PAYMENT_STATUS } from './orderStatus';

export type PaymentReconciliationAction =
  | 'CONFIRM_APPROVED_PAYMENT'
  | 'CANCEL_REJECTED_PENDING_ORDER'
  | 'MARK_PAYMENT_OVERDUE'
  | 'KEEP_PENDING'
  | 'SKIP_FINAL_OR_REFUNDED_ORDER'
  | 'SKIP_NON_PENDING_ORDER';

const FINAL_OR_REFUND_PAYMENT_STATUSES = new Set<string>([
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.REFUND_PENDING,
  PAYMENT_STATUS.REFUND_FAILED
]);

export const resolvePaymentReconciliationAction = (
  providerStatus: string,
  order: {
    status: string;
    paymentStatus?: string | null;
  }
): PaymentReconciliationAction => {
  if (order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.DELIVERED || FINAL_OR_REFUND_PAYMENT_STATUSES.has(order.paymentStatus || '')) {
    return 'SKIP_FINAL_OR_REFUNDED_ORDER';
  }

  if (order.status !== ORDER_STATUS.PENDING) {
    return 'SKIP_NON_PENDING_ORDER';
  }

  if (providerStatus === 'approved') {
    return 'CONFIRM_APPROVED_PAYMENT';
  }

  if (providerStatus === 'rejected' || providerStatus === 'cancelled') {
    return 'CANCEL_REJECTED_PENDING_ORDER';
  }

  if (providerStatus === 'expired' || providerStatus === 'overdue') {
    return 'MARK_PAYMENT_OVERDUE';
  }

  return 'KEEP_PENDING';
};
