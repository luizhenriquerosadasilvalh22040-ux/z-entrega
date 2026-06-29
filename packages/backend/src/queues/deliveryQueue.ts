import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis';
import logger from '../config/logger';
import { DELIVERY_RESPONSE_TIMEOUT_MS } from '../domain/deliveryDispatchPolicy';

const REDIS_OPTIONS = getRedisConnectionOptions();
const SHOULD_PROCESS_QUEUES = process.env.PROCESS_QUEUES !== 'false';

// Inicializa a fila de timeout para entregadores
export const deliveryTimeoutQueue = new Queue('deliveryTimeoutQueue', {
  connection: REDIS_OPTIONS as any
});

export const scheduleDeliveryTimeout = async (
  orderId: string,
  delivererId: string,
  delay = DELIVERY_RESPONSE_TIMEOUT_MS
): Promise<void> => {
  const jobId = `delivery-timeout:${orderId}:${delivererId}`;
  await deliveryTimeoutQueue.add(
    'deliveryTimeout',
    { orderId, delivererId },
    {
      delay,
      jobId,
      removeOnComplete: true,
      removeOnFail: 100
    }
  );
  logger.info(`⏰ [Timeout Scheduled] Timeout de entrega agendado para o pedido ${orderId} (Entregador: ${delivererId})`);
};

if (SHOULD_PROCESS_QUEUES) {
  // Processador da fila de timeout de entregadores
  new Worker('deliveryTimeoutQueue', async (job: Job) => {
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
  }, {
    connection: REDIS_OPTIONS as any
  });

  logger.info('🔌 BullMQ worker para timeout de entregas inicializado.');
} else {
  logger.info('🔌 Delivery timeout queue producer initialized without processing jobs.');
}
