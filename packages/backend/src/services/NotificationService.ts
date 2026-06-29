import { Queue, Worker, type Job } from 'bullmq';
import prisma from '../config/prisma';
import { getRedisConnectionOptions, isRedisConnected } from '../config/redis';
import { WhatsAppService } from './WhatsAppService';
import logger from '../config/logger';
import {
  NOTIFICATION_QUEUE_ATTEMPTS,
  NOTIFICATION_RETRY_BACKOFF_MS,
  maskNotificationTarget
} from '../domain/notificationPolicy';

const REDIS_OPTIONS = getRedisConnectionOptions();
const SHOULD_PROCESS_QUEUES = process.env.PROCESS_QUEUES !== 'false';

// Inicializa a fila do Bull
export const notificationQueue = new Queue('notificationQueue', {
  connection: REDIS_OPTIONS as any
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

    // 2. Só enfileira no Bull imediatamente se não houver transação ativa (tratado com try/catch contra falhas no Redis)
    if (!tx) {
      let enqueued = false;
      if (isRedisConnected) {
        try {
          await notificationQueue.add(
            'sendNotification',
            { notificationId: notification.id },
            {
              attempts: NOTIFICATION_QUEUE_ATTEMPTS,
              backoff: {
                type: 'exponential',
                delay: NOTIFICATION_RETRY_BACKOFF_MS
              }
            }
          );
          enqueued = true;
        } catch (err: any) {
          logger.error(`⚠️ [Redis Queue Notification Error] Falha ao enfileirar notificação no Bull (Notificação salva com ID ${notification.id}): ${err.message}`);
        }
      }

      if (!enqueued) {
        logger.info(`🔔 [Notification Fallback] Redis offline. Processando notificação ${notification.id} em segundo plano...`);
        setTimeout(() => {
          NotificationService.processDirectly(notification.id).catch(err => 
            logger.error(`Erro no processDirectly em background: ${err.message}`)
          );
        }, 100);
      }
    }

    return notification.id;
  }

  /**
   * Adiciona o job de notificação na fila do Bull (utilizado pós-commit de transações)
   */
  public static async addJobToQueue(notificationId: string): Promise<void> {
    let enqueued = false;
    if (isRedisConnected) {
      try {
        await notificationQueue.add(
          'sendNotification',
          { notificationId },
            {
              attempts: NOTIFICATION_QUEUE_ATTEMPTS,
              backoff: {
                type: 'exponential',
                delay: NOTIFICATION_RETRY_BACKOFF_MS
              }
            }
          );
        enqueued = true;
      } catch (err: any) {
        logger.error(`⚠️ [Redis Add Job Error] Falha ao adicionar job de notificação pós-commit para o ID ${notificationId}: ${err.message}`);
      }
    }

    if (!enqueued) {
      logger.info(`🔔 [Notification Fallback] Redis offline no addJobToQueue. Processando notificação ${notificationId} em segundo plano...`);
      setTimeout(() => {
        NotificationService.processDirectly(notificationId).catch(err => 
          logger.error(`Erro no processDirectly em background: ${err.message}`)
        );
      }, 100);
    }
  }

  /**
   * Processa e envia uma notificação diretamente, sem passar pela fila do Bull
   */
  public static async processDirectly(notificationId: string): Promise<void> {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
      });
      
      if (!notification) {
        throw new Error(`Notification not found: ${notificationId}`);
      }

      await this.processNotification(notification, 1, true);
      logger.info(`🔔 [Notification Fallback] Notificação ${notificationId} enviada com sucesso.`);
    } catch (error: any) {
      logger.error(`❌ [Notification Fallback Error] Falha ao processar notificação ${notificationId}: ${error.message}`);
      
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'FAILED',
          errorMessage: error.message
        }
      });
    }
  }

  public static async requeueFailedNotification(notificationId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }
    if (notification.status !== 'FAILED') {
      throw new Error('Apenas notificações com falha podem ser reenfileiradas.');
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'QUEUED',
        errorMessage: null
      }
    });

    await this.addJobToQueue(notificationId);
  }

  public static async processNotification(
    notification: any,
    attemptNumber: number,
    isFinalAttempt: boolean
  ): Promise<void> {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        errorMessage: null
      }
    });

    try {
      let providerMessageId: string | undefined;
      if (notification.type === 'WhatsApp') {
        providerMessageId = await WhatsAppService.sendMessage(notification.target, notification.content);
      } else {
        throw new Error(`Unsupported notification type: ${notification.type}`);
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId,
          errorMessage: null
        }
      });
    } catch (error: any) {
      logger.error(
        `Error processing notification ${notification.id} attempt ${attemptNumber} to ${maskNotificationTarget(notification.target)}: ${error.message}`
      );

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: isFinalAttempt ? 'FAILED' : 'QUEUED',
          errorMessage: error.message
        }
      });

      throw error;
    }
  }
}

if (SHOULD_PROCESS_QUEUES) {
  new Worker('notificationQueue', async (job: Job) => {
    const { notificationId } = job.data;
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    const nextAttempt = job.attemptsMade + 1;
    const maxAttempts = Number(job.opts.attempts || NOTIFICATION_QUEUE_ATTEMPTS);
    await NotificationService.processNotification(notification, nextAttempt, nextAttempt >= maxAttempts);
  }, {
    connection: REDIS_OPTIONS as any
  });

  logger.info('🔔 BullMQ worker for notifications initialized.');
} else {
  logger.info('🔔 Notification queue producer initialized without processing jobs.');
}
