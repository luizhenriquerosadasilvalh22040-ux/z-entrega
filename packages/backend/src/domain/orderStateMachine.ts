import {
  FINAL_ORDER_STATUSES,
  ONLINE_PAYMENT_METHODS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  type OrderStatus
} from './orderStatus';

export type OrderActorRole = 'customer' | 'merchant' | 'deliverer' | 'admin';

export type TransitionableOrder = {
  status: string;
  paymentMethod: string;
  paymentStatus?: string | null;
};

const allowedByRole: Record<OrderActorRole, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  customer: {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.CANCELLED]
  },
  merchant: {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.READY]: [ORDER_STATUS.DISPATCHED, ORDER_STATUS.CANCELLED]
  },
  deliverer: {
    [ORDER_STATUS.READY]: [ORDER_STATUS.DISPATCHED],
    [ORDER_STATUS.DISPATCHED]: [ORDER_STATUS.IN_TRANSIT],
    [ORDER_STATUS.IN_TRANSIT]: [ORDER_STATUS.DELIVERED]
  },
  admin: {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.ACCEPTED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.READY]: [ORDER_STATUS.DISPATCHED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DISPATCHED]: [ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.IN_TRANSIT]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED]
  }
};

export const isKnownOrderStatus = (status: string): status is OrderStatus => {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
};

export const canTransitionOrder = (
  order: TransitionableOrder,
  nextStatus: OrderStatus,
  actorRole: OrderActorRole
): boolean => {
  const currentStatus = order.status;
  if (!isKnownOrderStatus(currentStatus)) return false;
  if (currentStatus === nextStatus) return true;
  if (FINAL_ORDER_STATUSES.has(currentStatus)) return false;

  const merchantCanAcceptUnpaidOfflineOrder =
    currentStatus === ORDER_STATUS.PENDING &&
    nextStatus === ORDER_STATUS.ACCEPTED &&
    actorRole === 'merchant' &&
    (!ONLINE_PAYMENT_METHODS.has(order.paymentMethod) || order.paymentStatus === PAYMENT_STATUS.RECEIVED);

  if (merchantCanAcceptUnpaidOfflineOrder) return true;

  const allowedStatuses = allowedByRole[actorRole][currentStatus] || [];
  return allowedStatuses.includes(nextStatus);
};

export const assertCanTransitionOrder = (
  order: TransitionableOrder,
  nextStatus: OrderStatus,
  actorRole: OrderActorRole
): void => {
  const currentStatus = order.status;

  if (!isKnownOrderStatus(currentStatus)) {
    throw new Error(`Status atual desconhecido: ${currentStatus}`);
  }

  if (!canTransitionOrder(order, nextStatus, actorRole)) {
    if (FINAL_ORDER_STATUSES.has(currentStatus)) {
      throw new Error('Este pedido já foi finalizado e não pode mudar de status.');
    }

    throw new Error(`Transição de status inválida: ${currentStatus} -> ${nextStatus}`);
  }
};

export const ACTIVE_DELIVERY_ORDER_STATUSES = [
  ORDER_STATUS.READY,
  ORDER_STATUS.DISPATCHED,
  ORDER_STATUS.IN_TRANSIT
] as const;

export const MERCHANT_REVENUE_ORDER_EXCLUDED_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PAID,
  ORDER_STATUS.CANCELLED
] as const;
