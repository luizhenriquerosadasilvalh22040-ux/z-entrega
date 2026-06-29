export const DELIVERY_RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;
export const DELIVERY_MAX_ASSIGNMENT_ATTEMPTS = 5;

export const canTryAnotherDeliverer = (
  attemptsCount: number,
  maxAttempts = DELIVERY_MAX_ASSIGNMENT_ATTEMPTS
): boolean => {
  return attemptsCount < maxAttempts;
};
