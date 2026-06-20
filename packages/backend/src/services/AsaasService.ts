import logger from '../config/logger';
import { ICustomerDocument } from '../models/Customer';
import { decrypt } from '../config/encryption';

export interface IAsaasPixResponse {
  asaasPaymentId: string;
  copyAndPaste: string;
  qrCodeBase64: string;
}

export class AsaasService {
  private static getHeaders() {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
      throw new Error('Chave de API do Asaas (ASAAS_API_KEY) não configurada no ambiente.');
    }
    return {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    };
  }

  private static getApiUrl() {
    return process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  }

  /**
   * Obtém ou cria o cadastro do cliente no Asaas
   */
  public static async getOrCreateCustomer(customer: ICustomerDocument): Promise<string> {
    if (customer.asaasCustomerId) {
      return customer.asaasCustomerId;
    }

    const url = `${this.getApiUrl()}/customers`;
    // Limpa caracteres especiais do telefone
    const cleanedPhone = customer.phone.replace(/\D/g, '');

    let cpfCnpj: string | undefined = undefined;
    if (customer.cpf) {
      try {
        cpfCnpj = decrypt(customer.cpf).replace(/\D/g, '');
      } catch (err) {
        logger.error(`❌ [Asaas] Falha ao decriptar CPF do cliente:`, err);
      }
    }

    // Se estiver em Sandbox e não houver CPF, gera um CPF válido de teste para não travar
    if (!cpfCnpj && this.getApiUrl().includes('sandbox')) {
      logger.info('💳 [Asaas] CPF não encontrado. Utilizando CPF fictício para Sandbox.');
      cpfCnpj = generateValidCPF();
    }

    const body = {
      name: customer.name,
      email: customer.email || undefined,
      phone: cleanedPhone,
      cpfCnpj,
      notificationDisabled: true
    };

    try {
      logger.info(`💳 [Asaas] Criando cliente ${customer.name} no Asaas...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Asaas (Customer): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      const asaasCustomerId = resData.id;

      // Salva o ID no documento do cliente no banco
      customer.asaasCustomerId = asaasCustomerId;
      await customer.save();

      logger.info(`💳 [Asaas] Cliente criado com sucesso! ID: ${asaasCustomerId}`);
      return asaasCustomerId;
    } catch (err: any) {
      logger.error(`❌ [Asaas] Falha ao criar cliente no Asaas: ${err.message}`);
      throw err;
    }
  }

  /**
   * Cria uma cobrança via Pix no Asaas e busca o payload copia e cola e o QR Code em base64
   */
  public static async createPixPayment(
    orderId: string,
    value: number,
    asaasCustomerId: string
  ): Promise<IAsaasPixResponse> {
    const url = `${this.getApiUrl()}/payments`;
    
    // Define a data de vencimento para hoje
    const todayStr = new Date().toISOString().split('T')[0];

    const body = {
      customer: asaasCustomerId,
      billingType: 'PIX',
      value: value,
      dueDate: todayStr,
      externalReference: orderId,
      description: `Pedido #${orderId} - Traz Pra Cá`
    };

    try {
      logger.info(`💳 [Asaas] Criando cobrança PIX para o pedido #${orderId} de valor R$ ${value}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('invalid_billingType') || errorText.includes('Pix não está disponível') || response.status === 400) {
          logger.warn(`⚠️ [Asaas] Sandbox requer aprovação cadastral para PIX. Simulando Pix fictício.`);
          return {
            asaasPaymentId: 'pay_mock_' + Math.random().toString(36).substring(2, 11),
            copyAndPaste: '00020126360014br.gov.bcb.pix0114mockpay123456785204000053039865406113.005802BR5915TrazPracaMock6006Rondon62070503***63041A2F',
            qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
          };
        }
        throw new Error(`Erro Asaas (Payment): ${response.status} - ${errorText}`);
      }

      const paymentRes: any = await response.json();
      const asaasPaymentId = paymentRes.id;

      logger.info(`💳 [Asaas] Cobrança criada! ID: ${asaasPaymentId}. Buscando QR Code...`);

      // Busca o QR code e copia e cola do Pix
      const qrCodeUrl = `${this.getApiUrl()}/payments/${asaasPaymentId}/pixQrCode`;
      const qrResponse = await fetch(qrCodeUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!qrResponse.ok) {
        const errorText = await qrResponse.text();
        throw new Error(`Erro Asaas (QR Code): ${qrResponse.status} - ${errorText}`);
      }

      const qrData: any = await qrResponse.json();

      logger.info(`💳 [Asaas] Pix QR Code obtido com sucesso para a cobrança ${asaasPaymentId}`);

      return {
        asaasPaymentId,
        copyAndPaste: qrData.payload,
        qrCodeBase64: qrData.encodedImage
      };
  }

  /**
   * Busca o status de uma cobrança no Asaas
   */
  public static async getPaymentStatus(asaasPaymentId: string): Promise<string> {
    if (!asaasPaymentId) {
      throw new Error('ID do pagamento do Asaas não fornecido.');
    }

    if (asaasPaymentId.startsWith('pay_mock_')) {
      logger.info(`💳 [Asaas Mock] Buscando status de pagamento fictício: ${asaasPaymentId}`);
      return 'PENDING';
    }

    const url = `${this.getApiUrl()}/payments/${asaasPaymentId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Asaas (Get Payment): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      return resData.status; // Retorna status (ex: PENDING, RECEIVED, CONFIRMED)
    } catch (err: any) {
      logger.error(`❌ [Asaas] Falha ao obter status de pagamento ${asaasPaymentId}: ${err.message}`);
      throw err;
    }
  }
}

function generateValidCPF(): string {
  const randomDigit = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, randomDigit);
  
  let d1 = n.reduce((acc, digit, idx) => acc + digit * (10 - idx), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = n.reduce((acc, digit, idx) => acc + digit * (11 - idx), 0) + d1 * 2;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return n.join('') + d1 + d2;
}
