const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;

  return parsed;
};

export const orderCreationTransactionOptions = {
  maxWait: parsePositiveInteger(process.env.PRISMA_ORDER_TX_MAX_WAIT_MS, 10000),
  timeout: parsePositiveInteger(process.env.PRISMA_ORDER_TX_TIMEOUT_MS, 20000)
};

export const paymentSyncTransactionOptions = {
  maxWait: parsePositiveInteger(process.env.PRISMA_PAYMENT_TX_MAX_WAIT_MS, 10000),
  timeout: parsePositiveInteger(process.env.PRISMA_PAYMENT_TX_TIMEOUT_MS, 15000)
};

