export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

export const assertNonProduction = (message: string): void => {
  if (isProduction()) {
    throw new Error(message);
  }
};

export const getMissingProductionRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): string[] => {
  if (env.NODE_ENV !== 'production') return [];

  const missing: string[] = [];
  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!env.ENCRYPTION_KEY && !env.ENCRYPTION_SECRET) missing.push('ENCRYPTION_KEY or ENCRYPTION_SECRET');
  return missing;
};

export const assertProductionRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  const missing = getMissingProductionRuntimeConfig(env);
  if (missing.length > 0) {
    throw new Error(`Missing required production runtime config: ${missing.join(', ')}`);
  }
};
