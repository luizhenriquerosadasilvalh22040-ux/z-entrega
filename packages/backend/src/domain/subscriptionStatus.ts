export const MERCHANT_SUBSCRIPTION_STATUS = {
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
} as const;

export type MerchantSubscriptionStatusValue =
  typeof MERCHANT_SUBSCRIPTION_STATUS[keyof typeof MERCHANT_SUBSCRIPTION_STATUS];

export const isMerchantSubscriptionActive = (status?: string | null): boolean => {
  return status === MERCHANT_SUBSCRIPTION_STATUS.ACTIVE;
};

export const isMerchantPubliclyVisible = (merchant: {
  isActive: boolean;
  isVerified?: boolean | null;
  subscriptionStatus?: string | null;
}): boolean => {
  return merchant.isActive && merchant.isVerified === true && isMerchantSubscriptionActive(merchant.subscriptionStatus);
};

export const getMerchantPublicationBlockReason = (merchant: {
  isActive: boolean;
  isVerified?: boolean | null;
  subscriptionStatus?: string | null;
}): string | null => {
  if (!merchant.isActive) return 'Loja inativa.';
  if (merchant.isVerified !== true) return 'Loja ainda não aprovada pelo admin.';
  if (!isMerchantSubscriptionActive(merchant.subscriptionStatus)) return 'Assinatura do lojista não está ativa.';
  return null;
};

export const mapMercadoPagoSubscriptionStatus = (status?: string | null): MerchantSubscriptionStatusValue => {
  if (status === 'authorized') return MERCHANT_SUBSCRIPTION_STATUS.ACTIVE;
  if (status === 'pending') return MERCHANT_SUBSCRIPTION_STATUS.PENDING;
  if (status === 'paused') return MERCHANT_SUBSCRIPTION_STATUS.PAUSED;
  if (status === 'cancelled') return MERCHANT_SUBSCRIPTION_STATUS.CANCELLED;
  if (status === 'rejected') return MERCHANT_SUBSCRIPTION_STATUS.FAILED;
  return MERCHANT_SUBSCRIPTION_STATUS.INACTIVE;
};
