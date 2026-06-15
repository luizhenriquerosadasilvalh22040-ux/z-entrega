export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'trazpraca-jwt-secret-very-secure-key-12345',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h', // Access Token: 24h
  refreshExpirationDays: parseInt(process.env.REFRESH_EXPIRATION_DAYS || '7'), // Refresh Token: 7 dias
};

export default authConfig;
