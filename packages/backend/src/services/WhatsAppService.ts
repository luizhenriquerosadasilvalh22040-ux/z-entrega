import logger from '../config/logger';
import { isProduction } from '../config/runtime';

export class WhatsAppService {
  /**
   * Envia uma mensagem pelo WhatsApp Cloud API Oficial da Meta ou simula em desenvolvimento
   */
  public static async sendMessage(to: string, message: string): Promise<string> {
    // Limpa caracteres especiais do telefone
    const cleanPhone = to.replace(/\D/g, '');

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (phoneNumberId && accessToken) {
      logger.info(`📱 [WhatsApp Meta API] Enviando mensagem real para ${cleanPhone}...`);
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const resData: any = await response.json();

        if (!response.ok) {
          throw new Error(`Erro na API Oficial do WhatsApp: ${JSON.stringify(resData.error)}`);
        }

        logger.info(`📱 [WhatsApp Meta API] Mensagem enviada! ID: ${resData.messages?.[0]?.id}`);
        return resData.messages?.[0]?.id || 'success';
      } catch (err: any) {
        logger.error(`❌ [WhatsApp Meta API] Falha ao enviar mensagem: ${err.message}`);
        throw err;
      }
    } else {
      if (isProduction()) {
        throw new Error('Credenciais do WhatsApp ausentes em produção.');
      }
      logger.info(`📱 [WhatsApp Meta Mock] (Credenciais Meta ausentes no .env) Enviando para ${cleanPhone}: "${message}"`);
      
      // Simula tempo de resposta da API
      await new Promise(resolve => setTimeout(resolve, 800));

      // 5% de chance de falha simulada para testar retry no Bull
      if (Math.random() < 0.05) {
        throw new Error('Meta API network timeout (Simulado)');
      }

      const mockMessageId = `wamid.HBgMNTU0NDk5OTk5ODg4OBUCABEYEkQ0QkU1NzBDRURDM0U0Q0RERAA=`;
      logger.info('📱 [WhatsApp Meta Mock] Mensagem simulada enviada! ID: %s', mockMessageId);
      return mockMessageId;
    }
  }
}
