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
  | 'CANCEL_ORDER_BY_REFUND'
  | 'UPDATE_PAYMENT_STATUS_ONLY'
  | 'SKIP_FINAL_ORDER'
  | 'SKIP_NON_PENDING_REJECTION'
  | 'NO_STATUS_CHANGE';

export const buildMercadoPagoEventId = (payload: MercadoPagoWebhookPayload): string => {
  const type = payload.type || 'unknown';
  const action = payload.action || 'unknown';
  const resourceId = payload.data?.id ? String(payload.data.id) : 'unknown';
  return `${type}:${action}:${resourceId}`;
};

export const mapMercadoPagoToPaymentStatus = (status: string, statusDetail: string): string => {
  const s = status.toLowerCase();
  const d = statusDetail.toLowerCase();

  if (s === 'approved') {
    if (d === 'partially_refunded') {
      return PAYMENT_STATUS.REFUNDED;
    }
    return PAYMENT_STATUS.RECEIVED; // accredited por padrão
  }

  if (s === 'pending' || s === 'in_process') {
    return PAYMENT_STATUS.PENDING;
  }

  if (s === 'rejected') {
    return PAYMENT_STATUS.REJECTED;
  }

  if (s === 'cancelled') {
    if (d === 'expired') {
      return PAYMENT_STATUS.OVERDUE;
    }
    return PAYMENT_STATUS.CANCELLED; // by_payer, by_collector
  }

  if (s === 'refunded') {
    return PAYMENT_STATUS.REFUNDED;
  }

  if (s === 'charged_back') {
    if (d === 'in_process') {
      return PAYMENT_STATUS.REFUND_PENDING;
    }
    if (d === 'reimbursed' || d === 'settled') {
      return PAYMENT_STATUS.REFUNDED;
    }
    return PAYMENT_STATUS.REFUNDED; // fallback
  }

  if (s === 'in_mediation') {
    if (d === 'pending') {
      return PAYMENT_STATUS.REFUND_PENDING;
    }
    return PAYMENT_STATUS.REFUND_PENDING; // fallback
  }

  return PAYMENT_STATUS.PENDING; // fallback geral seguro
};

export const resolvePaymentWebhookAction = (
  mpStatusOrPaymentStatus: string,
  order: {
    status: string;
    paymentStatus?: string | null;
  }
): PaymentWebhookAction => {
  // Normaliza o status de entrada (caso seja passado em caixa baixa do Mercado Pago direto pelo teste legado)
  let targetPaymentStatus = mpStatusOrPaymentStatus;
  if (mpStatusOrPaymentStatus === 'approved') {
    targetPaymentStatus = PAYMENT_STATUS.RECEIVED;
  } else if (mpStatusOrPaymentStatus === 'rejected') {
    targetPaymentStatus = PAYMENT_STATUS.REJECTED;
  } else if (mpStatusOrPaymentStatus === 'cancelled') {
    targetPaymentStatus = PAYMENT_STATUS.CANCELLED;
  } else if (mpStatusOrPaymentStatus === 'refunded') {
    targetPaymentStatus = PAYMENT_STATUS.REFUNDED;
  } else if (mpStatusOrPaymentStatus === 'pending' || mpStatusOrPaymentStatus === 'in_process') {
    targetPaymentStatus = PAYMENT_STATUS.PENDING;
  }

  // Se o pagamento no banco já estiver no status que queremos aplicar, não precisa alterar mais nada
  if (order.paymentStatus === targetPaymentStatus) {
    return 'NO_STATUS_CHANGE';
  }

  if (targetPaymentStatus === PAYMENT_STATUS.RECEIVED) {
    const FINAL_PAYMENT_ORDER_STATUSES = new Set([
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.DELIVERED
    ]);
    if (FINAL_PAYMENT_ORDER_STATUSES.has(order.status as any) || order.paymentStatus === PAYMENT_STATUS.REFUNDED) {
      return 'SKIP_FINAL_ORDER';
    }
    if (order.status === ORDER_STATUS.PENDING) {
      return 'APPROVE_PAYMENT';
    }
    return 'UPDATE_PAYMENT_STATUS_ONLY';
  }

  if (
    targetPaymentStatus === PAYMENT_STATUS.REJECTED ||
    targetPaymentStatus === PAYMENT_STATUS.CANCELLED ||
    targetPaymentStatus === PAYMENT_STATUS.OVERDUE
  ) {
    if (order.status !== ORDER_STATUS.PENDING) {
      return 'SKIP_NON_PENDING_REJECTION';
    }
    return 'CANCEL_PENDING_ORDER';
  }

  if (
    targetPaymentStatus === PAYMENT_STATUS.REFUND_PENDING ||
    targetPaymentStatus === PAYMENT_STATUS.REFUNDED
  ) {
    const CAN_CANCEL_OPERATIONS = new Set([
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAID,
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY
    ]);

    if (CAN_CANCEL_OPERATIONS.has(order.status as any)) {
      return 'CANCEL_ORDER_BY_REFUND';
    }

    return 'UPDATE_PAYMENT_STATUS_ONLY';
  }

  return 'UPDATE_PAYMENT_STATUS_ONLY';
};


