export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

export const assertNonProduction = (message: string): void => {
  if (isProduction()) {
    throw new Error(message);
  }
};

export const getMissingProductionRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): string[] => {
  if (env.NODE_ENV !== 'production') return [];

  const missing: string[] = [];
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'DELIVERY_RESPONSE_SECRET',
    'API_PUBLIC_URL',
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_WEBHOOK_SECRET'
  ];

  for (const key of required) {
    if (!env[key]) missing.push(key);
  }

  if (!env.ENCRYPTION_KEY && !env.ENCRYPTION_SECRET) missing.push('ENCRYPTION_KEY or ENCRYPTION_SECRET');

  const isWorker = env.PROCESS_QUEUES === 'true';
  if (isWorker) {
    const workerRequired = [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN'
    ];
    for (const key of workerRequired) {
      if (!env[key]) missing.push(key);
    }
  } else {
    const apiRequired = [
      'FRONTEND_URL',
      'UPLOADS_PUBLIC_URL',
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET'
    ];
    for (const key of apiRequired) {
      if (!env[key]) missing.push(key);
    }
  }

  return missing;
};

export const assertProductionRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  const missing = getMissingProductionRuntimeConfig(env);
  if (missing.length > 0) {
    throw new Error(`Missing required production runtime config: ${missing.join(', ')}`);
  }
};
