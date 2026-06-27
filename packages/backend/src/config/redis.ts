import Redis from 'ioredis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const parseRedisUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
};

const baseRedisConfig = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  connectTimeout: REDIS_URL ? 5000 : 2000,
};

const redisConnection = REDIS_URL ? parseRedisUrl(REDIS_URL) : {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

const redisConfig = {
  ...redisConnection,
  ...baseRedisConfig,
};

export const redisClient = new Redis(redisConfig);

export let isRedisConnected = false;

redisClient.on('connect', () => {
  logger.info('Redis socket connected.');
});

redisClient.on('ready', () => {
  isRedisConnected = true;
  logger.info('Redis connected and ready successfully.');
});

redisClient.on('close', () => {
  isRedisConnected = false;
  logger.warn('Redis connection closed.');
});

redisClient.on('end', () => {
  isRedisConnected = false;
  logger.warn('Redis connection ended.');
});

redisClient.on('error', (err) => {
  logger.error('Redis error: %O', err);
});

export const getRedisConnectionOptions = () => redisConfig;
export default redisClient;
