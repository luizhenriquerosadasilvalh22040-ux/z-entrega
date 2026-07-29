import crypto from 'crypto';

export const OTP_TTL_SECONDS = 10 * 60;

export const createNumericOtp = (digits = 6): string => {
  const minimum = 10 ** (digits - 1);
  return crypto.randomInt(minimum, 10 ** digits).toString();
};

export const hashOtp = (scope: string, subject: string, code: string, secret: string): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(`${scope}:${subject}:${code}`)
    .digest('hex');
};

export const verifyOtpHash = (
  expectedHash: string,
  scope: string,
  subject: string,
  code: string,
  secret: string
): boolean => {
  const receivedHash = hashOtp(scope, subject, code, secret);
  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};
