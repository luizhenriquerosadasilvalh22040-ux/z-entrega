import Redis from 'ioredis';
import logger from './logger';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Requerido por Bull
};

export const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  logger.info('Redis connected successfully.');
});

redisClient.on('error', (err) => {
  logger.error('Redis error: %O', err);
});

export const getRedisConnectionOptions = () => redisConfig;
export default redisClient;
