import Redis from 'ioredis';
import logger from './logger';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Requerido por Bull
  enableOfflineQueue: false,  // Rejeita comandos imediatamente se estiver offline
  connectTimeout: 2000,       // Timeout de 2s para conexões
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

