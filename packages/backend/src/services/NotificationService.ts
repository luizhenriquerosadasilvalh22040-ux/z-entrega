import Queue from 'bull';
import { getRedisConnectionOptions } from '../config/redis';
import { Notification } from '../models/Notification';
import { WhatsAppService } from './WhatsAppService';
import logger from '../config/logger';
import { Types } from 'mongoose';

const REDIS_OPTIONS = getRedisConnectionOptions();

// Inicializa a fila do Bull
export const notificationQueue = new Queue('notificationQueue', {
  redis: {
    host: REDIS_OPTIONS.host,
    port: REDIS_OPTIONS.port,
  }
});

export class NotificationService {
  /**
   * Envia uma notificação assíncrona colocando-a na fila
   */
  public static async queueNotification(data: {
    userId: string;
    userType: 'Customer' | 'Merchant' | 'Deliverer';
    type: 'WhatsApp' | 'Email' | 'SMS';
    target: string;
    content: string;
  }): Promise<void> {
    // 1. Cria o registro de notificação pendente no MongoDB
    const notification = new Notification({
      userId: new Types.ObjectId(data.userId),
      userType: data.userType,
      type: data.type,
      target: data.target,
      content: data.content,
      status: 'PENDING',
      attempts: 0
    });

    await notification.save();

    // 2. Adiciona o job na fila do Bull com retry exponencial
    await notificationQueue.add(
      { notificationId: notification._id.toString() },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000 // 1s, 2s, 4s, 8s, 16s...
        }
      }
    );
  }
}

// 3. Processador de jobs da fila
notificationQueue.process(async (job) => {
  const { notificationId } = job.data;
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new Error(`Notification not found: ${notificationId}`);
  }

  try {
    notification.attempts += 1;
    await notification.save();

    if (notification.type === 'WhatsApp') {
      await WhatsAppService.sendMessage(notification.target, notification.content);
    } else {
      logger.warn(`Unsupported notification type: ${notification.type}`);
    }

    notification.status = 'SENT';
    await notification.save();
  } catch (error: any) {
    logger.error(`Error processing job for notification ${notificationId}: %s`, error.message);
    
    // Registra o log de erro
    notification.errorLog = notification.errorLog || [];
    notification.errorLog.push(`${new Date().toISOString()} - ${error.message}`);
    
    if (job.attemptsMade === job.opts.attempts) {
      notification.status = 'FAILED';
    }
    
    await notification.save();
    throw error; // Lança o erro para o Bull agendar o retry
  }
});

logger.info('🔔 Bull Queue processor for notifications initialized.');
