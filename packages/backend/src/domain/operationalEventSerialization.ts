type OperationalEventSeverity = 'critical' | 'high' | 'medium' | 'info';

type AuditLogRecord = {
  id: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  orderId?: string | null;
  merchantId?: string | null;
  metadata?: any;
  createdAt: Date | string;
};

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Pedido criado',
  ORDER_PAYMENT_APPROVED: 'Pagamento aprovado',
  ORDER_STATUS_CHANGED: 'Status do pedido alterado',
  ORDER_CANCELLED_BY_PAYMENT_WEBHOOK: 'Pedido cancelado pelo webhook de pagamento',
  PAYMENT_RECONCILIATION_APPROVED: 'Pagamento reconciliado como aprovado',
  PAYMENT_RECONCILIATION_CANCELLED: 'Pedido cancelado por reconciliação de pagamento',
  PAYMENT_WEBHOOK_RECONCILED: 'Webhook de pagamento reconciliado',
  PAYMENT_REFUND_RETRY_REQUESTED: 'Retentativa de refund solicitada',
  PAYMENT_REFUND_SUCCEEDED: 'Refund concluído',
  PAYMENT_REFUND_FAILED: 'Refund falhou',
  DELIVERY_ACCEPTED: 'Motoboy aceitou entrega',
  DELIVERY_REJECTED: 'Motoboy recusou entrega',
  DELIVERY_REASSIGNED: 'Entrega reatribuída',
  DELIVERY_UNASSIGNED: 'Pedido ficou sem motoboy',
  DELIVERY_DISPATCH_ATTEMPTS_EXHAUSTED: 'Tentativas de motoboy esgotadas',
  ADMIN_DISPATCH_READY_ORDER: 'Admin despachou pedido pronto',
  ADMIN_NOTIFICATION_REQUEUE_REQUESTED: 'Admin solicitou reenfileirar notificação',
  DELIVERER_CREATED: 'Motoboy criado',
  DELIVERER_UPDATED: 'Motoboy atualizado',
  DELIVERER_DAILY_SCALE_UPDATED: 'Escala diária do motoboy alterada',
  DELIVERER_DELETED: 'Motoboy removido',
  SYSTEM_SETTINGS_UPDATED: 'Configurações do sistema alteradas',
  WHATSAPP_TEMPLATE_UPDATED: 'Template de WhatsApp alterado',
  COUPON_CREATED: 'Cupom criado',
  COUPON_DELETED: 'Cupom removido',
  MERCHANT_SUBSCRIPTION_CREATED: 'Assinatura criada',
  MERCHANT_SUBSCRIPTION_CANCELLED: 'Assinatura cancelada',
  MERCHANT_SUBSCRIPTION_SYNCED: 'Assinatura sincronizada',
  MERCHANT_SUBSCRIPTION_WEBHOOK_SYNCED: 'Assinatura sincronizada por webhook',
  MERCHANT_VERIFICATION_UPDATED: 'Verificação da loja alterada',
  MERCHANT_SUBSCRIPTION_PRICE_UPDATED: 'Preço da assinatura alterado',
  MEDIA_UPLOADED: 'Arquivo enviado'
};

const SEVERITY_BY_ACTION: Record<string, OperationalEventSeverity> = {
  PAYMENT_REFUND_FAILED: 'critical',
  DELIVERY_DISPATCH_ATTEMPTS_EXHAUSTED: 'critical',
  DELIVERY_UNASSIGNED: 'high',
  ORDER_CANCELLED_BY_PAYMENT_WEBHOOK: 'high',
  PAYMENT_RECONCILIATION_APPROVED: 'high',
  PAYMENT_RECONCILIATION_CANCELLED: 'high',
  PAYMENT_WEBHOOK_RECONCILED: 'medium',
  PAYMENT_REFUND_RETRY_REQUESTED: 'high',
  DELIVERY_REJECTED: 'medium',
  DELIVERY_REASSIGNED: 'medium',
  ADMIN_DISPATCH_READY_ORDER: 'medium',
  ADMIN_NOTIFICATION_REQUEUE_REQUESTED: 'medium',
  SYSTEM_SETTINGS_UPDATED: 'medium',
  WHATSAPP_TEMPLATE_UPDATED: 'medium',
  DELIVERER_DELETED: 'medium',
  COUPON_DELETED: 'medium',
  MERCHANT_SUBSCRIPTION_CANCELLED: 'medium',
  MERCHANT_SUBSCRIPTION_WEBHOOK_SYNCED: 'medium'
};

const SAFE_METADATA_KEYS = new Set([
  'fromStatus',
  'toStatus',
  'paymentStatus',
  'previousStatus',
  'nextStatus',
  'provider',
  'providerStatus',
  'amount',
  'reason',
  'attemptsCount',
  'notificationUserType',
  'notificationType',
  'templateKey',
  'locale',
  'vehicleType',
  'discountType',
  'maxUses',
  'previousSubscriptionPrice',
  'nextSubscriptionPrice',
  'storageProvider',
  'contentType',
  'sizeBytes'
]);

const sanitizeMetadata = (metadata: any): Record<string, unknown> => {
  if (!metadata || typeof metadata !== 'object') return {};

  return Object.entries(metadata).reduce((safe, [key, value]) => {
    if (SAFE_METADATA_KEYS.has(key)) {
      safe[key] = value;
    }
    return safe;
  }, {} as Record<string, unknown>);
};

export const getOperationalEventSeverity = (action: string): OperationalEventSeverity => {
  return SEVERITY_BY_ACTION[action] || 'info';
};

export const serializeOperationalEvent = (event: AuditLogRecord) => {
  return {
    id: event.id,
    action: event.action,
    label: EVENT_LABELS[event.action] || event.action,
    severity: getOperationalEventSeverity(event.action),
    actorType: event.actorType,
    entityType: event.entityType,
    entityId: event.entityId || undefined,
    orderId: event.orderId || undefined,
    merchantId: event.merchantId || undefined,
    metadata: sanitizeMetadata(event.metadata),
    createdAt: event.createdAt
  };
};
