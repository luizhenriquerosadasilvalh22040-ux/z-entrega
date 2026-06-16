import logger from '../config/logger';

export class WhatsAppService {
  /**
   * Envia uma mensagem de WhatsApp real pelo Twilio ou simula em desenvolvimento
   */
  public static async sendMessage(to: string, message: string): Promise<string> {
    // Limpa caracteres especiais do telefone
    let cleanedPhone = to.replace(/\D/g, '');
    
    // Adiciona o código do país (+55 para Brasil) caso não exista
    let formattedTo = cleanedPhone;
    if (!formattedTo.startsWith('55') && formattedTo.length <= 11) {
      formattedTo = `55${formattedTo}`;
    }
    const finalTo = `+${formattedTo}`;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER || '+14155238886'; // Número Sandbox padrão

    if (accountSid && authToken) {
      logger.info(`📱 [Twilio WhatsApp] Enviando mensagem real para ${finalTo}...`);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const bodyParams = new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${finalTo}`,
        Body: message
      });

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Erro na API do Twilio: ${response.status} - ${errText}`);
        }

        const resData: any = await response.json();
        logger.info(`📱 [Twilio WhatsApp] Mensagem enviada com sucesso! SID: ${resData.sid}`);
        return resData.sid;
      } catch (err: any) {
        logger.error(`❌ [Twilio WhatsApp] Falha ao enviar mensagem real: ${err.message}`);
        throw err;
      }
    } else {
      logger.info('📱 [WhatsApp Twilio Mock] (Credenciais ausentes no .env) Enviando para %s: "%s"', finalTo, message);
      
      // Simula tempo de resposta da API
      await new Promise(resolve => setTimeout(resolve, 800));

      // 5% de chance de falha simulada para testar o Bull
      if (Math.random() < 0.05) {
        throw new Error('Twilio API network timeout (Simulado)');
      }

      const sid = `SMmock_${Math.random().toString(36).substr(2, 9)}`;
      logger.info('📱 [WhatsApp Twilio Mock] Mensagem simulada enviada! SID: %s', sid);
      return sid;
    }
  }
}
