export const NOTIFICATION_QUEUE_ATTEMPTS = 5;
export const NOTIFICATION_RETRY_BACKOFF_MS = 1000;

export const maskNotificationTarget = (target: string): string => {
  const clean = target.replace(/\D/g, '');
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
};

export const shouldRetryNotification = (attempts: number): boolean => {
  return attempts < NOTIFICATION_QUEUE_ATTEMPTS;
};
