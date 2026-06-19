import Queue from 'bull';
import prisma from '../config/prisma';
import { getRedisConnectionOptions } from '../config/redis';
import { WhatsAppService } from './WhatsAppService';
import logger from '../config/logger';

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
  public static async queueNotification(
    data: {
      userId: string;
      userType: 'Customer' | 'Merchant' | 'Deliverer';
      type: 'WhatsApp' | 'Email' | 'SMS';
      target: string;
      content: string;
    },
    tx?: any // Aceita transação do Prisma opcional
  ): Promise<string> {
    const db = tx || prisma;

    // 1. Cria o registro de notificação no banco de dados (Supabase)
    const notification = await db.notification.create({
      data: {
        userId: data.userId,
        userType: data.userType,
        type: data.type,
        target: data.target,
        content: data.content,
        status: 'QUEUED'
      }
    });

    // 2. Só enfileira no Bull imediatamente se não houver transação ativa
    if (!tx) {
      await notificationQueue.add(
        { notificationId: notification.id },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      );
    }

    return notification.id;
  }

  /**
   * Adiciona o job de notificação na fila do Bull (utilizado pós-commit de transações)
   */
  public static async addJobToQueue(notificationId: string): Promise<void> {
    await notificationQueue.add(
      { notificationId },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    );
  }
}

// 3. Processador de jobs da fila
notificationQueue.process(async (job) => {
  const { notificationId } = job.data;
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });
  
  if (!notification) {
    throw new Error(`Notification not found: ${notificationId}`);
  }

  try {
    if (notification.type === 'WhatsApp') {
      await WhatsAppService.sendMessage(notification.target, notification.content);
    } else {
      logger.warn(`Unsupported notification type: ${notification.type}`);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });
  } catch (error: any) {
    logger.error(`Error processing job for notification ${notificationId}: %s`, error.message);
    
    const isLastAttempt = job.attemptsMade === job.opts.attempts;
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: isLastAttempt ? 'FAILED' : 'QUEUED',
        errorMessage: error.message
      }
    });
    
    throw error;
  }
});

logger.info('🔔 Bull Queue processor for notifications initialized.');
