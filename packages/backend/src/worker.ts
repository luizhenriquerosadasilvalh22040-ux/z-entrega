import dotenv from 'dotenv';
dotenv.config();

process.env.PROCESS_QUEUES = 'true';

import { connectDatabase, disconnectDatabase } from './config/database';
import logger from './config/logger';
import { OrderService } from './services/OrderService';
import './services/NotificationService';
import './queues/deliveryQueue';

const PIX_SWEEP_INTERVAL_MS = Number(process.env.PIX_SWEEP_INTERVAL_MS || 60 * 1000);

const startWorker = async (): Promise<void> => {
  await connectDatabase();

  logger.info('Worker started: queues enabled and scheduled jobs active.');

  setInterval(async () => {
    try {
      await OrderService.cancelUnpaidPixOrders();
    } catch (err) {
      logger.error('Erro na rotina worker de cancelamento automático de PIX:', err);
    }
  }, PIX_SWEEP_INTERVAL_MS);
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Worker received ${signal}. Shutting down...`);
  await disconnectDatabase();
  process.exit(0);
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    logger.error('Erro ao finalizar worker:', err);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    logger.error('Erro ao finalizar worker:', err);
    process.exit(1);
  });
});

startWorker().catch((error) => {
  logger.error('Failed to start worker: %O', error);
  process.exit(1);
});
