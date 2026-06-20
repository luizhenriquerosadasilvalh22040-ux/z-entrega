import { Router, Request, Response } from 'express';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/whatsapp/webhook
 * Verificação do webhook pela Meta — obrigatório para ativar o webhook no painel
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('✅ [WhatsApp Webhook] Verificação aprovada pela Meta.');
    return res.status(200).send(challenge);
  }

  logger.warn('❌ [WhatsApp Webhook] Verificação recusada — token inválido.');
  return res.sendStatus(403);
});

/**
 * POST /api/whatsapp/webhook
 * Recebe eventos da Meta: mensagens recebidas, status de entrega, etc.
 */
router.post('/webhook', (req: Request, res: Response) => {
  const body = req.body;

  // A Meta espera 200 imediatamente, independente do processamento
  res.sendStatus(200);

  if (body.object !== 'whatsapp_business_account') return;

  const changes = body.entry?.[0]?.changes?.[0]?.value;

  // Processar mensagens recebidas
  const messages = changes?.messages;
  if (messages?.length) {
    for (const msg of messages) {
      const from = msg.from;           // número de quem enviou (com DDI)
      const type = msg.type;           // 'text', 'image', 'audio', etc.
      const text = msg.text?.body;     // conteúdo se for texto
      const msgId = msg.id;

      logger.info(`📩 [WhatsApp] Mensagem recebida de ${from} | tipo: ${type} | id: ${msgId}`);

      if (type === 'text') {
        logger.info(`   Texto: "${text}"`);
        // TODO: adicionar lógica de resposta automática aqui se necessário
        // Exemplo: OrderService.handleWhatsAppReply(from, text);
      }
    }
  }

  // Processar atualizações de status de entrega das mensagens enviadas
  const statuses = changes?.statuses;
  if (statuses?.length) {
    for (const status of statuses) {
      logger.info(
        `📊 [WhatsApp] Status atualizado | msgId: ${status.id} | status: ${status.status} | para: ${status.recipient_id}`
      );
      // status.status pode ser: 'sent', 'delivered', 'read', 'failed'
    }
  }
});

export default router;
