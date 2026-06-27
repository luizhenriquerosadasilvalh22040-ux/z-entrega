const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLocation = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const businessConfig = {
  serviceCity: process.env.SERVICE_CITY || 'Rondon',
  serviceState: (process.env.SERVICE_STATE || 'PR').toUpperCase(),
  platformDeliveryFee: toNumber(process.env.PLATFORM_DELIVERY_FEE, 5),
  platformCommissionRate: toNumber(process.env.PLATFORM_COMMISSION_RATE, 0),
  delivererPayPerDelivery: toNumber(process.env.DELIVERER_PAY_PER_DELIVERY, 0)
};

export const isSupportedServiceArea = (city: string, state?: string): boolean => {
  const matchesCity = normalizeLocation(city) === normalizeLocation(businessConfig.serviceCity);
  const matchesState = !state || state.toUpperCase() === businessConfig.serviceState;
  return matchesCity && matchesState;
};
