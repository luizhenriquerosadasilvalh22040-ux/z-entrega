import logger from '../config/logger';

export class WhatsAppService {
  /**
   * Simula o envio de uma mensagem de WhatsApp pelo Twilio
   */
  public static async sendMessage(to: string, message: string): Promise<string> {
    logger.info('📱 [WhatsApp Twilio Mock] Sending to %s: "%s"', to, message);
    
    // Simula tempo de resposta da API
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simula falha ocasional para testar retries do Bull (10% de chance)
    if (Math.random() < 0.1) {
      throw new Error('Twilio API network timeout');
    }

    const messageSid = `SM${crypto.randomUUID().replace(/-/g, '')}`;
    logger.info('📱 [WhatsApp Twilio Mock] Sent! SID: %s', messageSid);
    return messageSid;
  }
}
