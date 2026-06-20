import Queue from 'bull';
import { getRedisConnectionOptions } from '../config/redis';
import logger from '../config/logger';

const REDIS_OPTIONS = getRedisConnectionOptions();

// Inicializa a fila de timeout para entregadores
export const deliveryTimeoutQueue = new Queue('deliveryTimeoutQueue', {
  redis: {
    host: REDIS_OPTIONS.host,
    port: REDIS_OPTIONS.port,
  }
});

// Processador da fila de timeout de entregadores
deliveryTimeoutQueue.process(async (job) => {
  const { orderId, delivererId } = job.data;
  
  logger.info(`⏳ [Delivery Timeout Queue] Processando job para o pedido ${orderId} (Entregador: ${delivererId})`);

  try {
    // Importa o OrderService dinamicamente para evitar dependência circular
    const { OrderService } = await import('../services/OrderService');
    await OrderService.autoReassignDeliverer(orderId, delivererId);
  } catch (error: any) {
    logger.error(`❌ [Delivery Timeout Queue] Erro ao processar timeout do pedido ${orderId}:`, error);
    throw error;
  }
});

logger.info('🔌 Bull Queue para timeout de entregas inicializada.');
