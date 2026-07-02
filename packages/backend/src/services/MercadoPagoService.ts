import logger from '../config/logger';
import { decrypt, encrypt } from '../config/encryption';
import prisma from '../config/prisma';
import { assertNonProduction, isProduction } from '../config/runtime';

export interface IMercadoPagoPixResponse {
  mpPaymentId: string;
  copyAndPaste: string;
  qrCodeBase64: string;
}

export const buildMercadoPagoPixPayer = (
  mpCustomerId: string | null | undefined,
  customerEmail: string,
  customerName: string
) => {
  if (mpCustomerId) {
    return { id: mpCustomerId };
  }

  return {
    email: customerEmail,
    first_name: customerName.split(' ')[0] || 'Comprador',
    last_name: customerName.split(' ').slice(1).join(' ') || 'Traz Pra Ca'
  };
};

export const buildMercadoPagoWebhookUrl = (apiPublicUrl: string | undefined): string => {
  const rawUrl = (apiPublicUrl || process.env.BACKEND_URL || 'http://localhost:3000').trim();
  const baseUrl = new URL(rawUrl).origin;
  return `${baseUrl}/api/payments/webhook/mercadopago`;
};

export class MercadoPagoService {
  private static getApiPublicUrl(): string {
    return (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  private static getWebhookUrl(): string {
    return buildMercadoPagoWebhookUrl(this.getApiPublicUrl());
  }

  private static getAccessToken(): string {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token && process.env.NODE_ENV === 'production') {
      throw new Error('Chave de API do Mercado Pago (MERCADO_PAGO_ACCESS_TOKEN) não configurada.');
    }
    return token || 'mock_access_token';
  }

  private static getHeaders(customToken?: string, idempotencyKey?: string) {
    const token = customToken || this.getAccessToken();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    };
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  private static isMockMode(): boolean {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    return !token || token.startsWith('mock_') || process.env.MOCK_PAYMENT === 'true';
  }

  private static assertCanUseMockPayment(): void {
    assertNonProduction('Mercado Pago mock/fallback não pode ser usado em produção.');
  }

  /**
   * Obtém a URL do fluxo OAuth para o Lojista se conectar
   */
  public static getOAuthUrl(merchantId: string): string {
    const clientId = process.env.MERCADO_PAGO_CLIENT_ID || 'mock_client_id';
    const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI || 'http://localhost:3000/api/payments/oauth/callback';
    return `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${merchantId}`;
  }

  /**
   * Processa o callback de OAuth e salva as credenciais do lojista
   */
  public static async handleOAuthCallback(code: string, merchantId: string): Promise<void> {
    logger.info(`💳 [Mercado Pago OAuth] Processando callback para o lojista ${merchantId}...`);

    if (this.isMockMode()) {
      this.assertCanUseMockPayment();
      logger.info('💳 [Mercado Pago OAuth] Modo Simulação ativo. Salvando credenciais mockadas.');
      await prisma.merchant.update({
        where: { id: merchantId },
        data: {
          mpAccessToken: encrypt('mock_merchant_access_token_' + Math.random().toString(36).substring(7)),
          mpRefreshToken: encrypt('mock_merchant_refresh_token_' + Math.random().toString(36).substring(7)),
          mpUserId: 'mp_user_mock_' + Math.random().toString(36).substring(7),
          isVerified: true
        }
      });
      return;
    }

    const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
    const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;
    const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI;

    try {
      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId || '',
          client_secret: clientSecret || '',
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri || ''
        }).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro OAuth Mercado Pago: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      
      // Criptografa os tokens antes de salvar
      const encryptedAccessToken = encrypt(data.access_token);
      const encryptedRefreshToken = encrypt(data.refresh_token);

      await prisma.merchant.update({
        where: { id: merchantId },
        data: {
          mpAccessToken: encryptedAccessToken,
          mpRefreshToken: encryptedRefreshToken,
          mpUserId: String(data.user_id),
          isVerified: true
        }
      });

      logger.info(`✅ [Mercado Pago OAuth] Lojista ${merchantId} conectado com sucesso! MP User ID: ${data.user_id}`);
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago OAuth] Falha ao processar OAuth: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtém ou cria o cadastro do cliente no Mercado Pago
   */
  public static async getOrCreateCustomer(customer: any): Promise<string> {
    if (customer.mpCustomerId) {
      return customer.mpCustomerId;
    }

    if (this.isMockMode()) {
      this.assertCanUseMockPayment();
      const mockCustomerId = 'cust_mock_' + Math.random().toString(36).substring(2, 11);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { mpCustomerId: mockCustomerId }
      });
      return mockCustomerId;
    }

    const url = 'https://api.mercadopago.com/v1/customers';
    const parts = customer.name.split(' ');
    const firstName = parts[0] || 'Cliente';
    const lastName = parts.slice(1).join(' ') || 'Traz Pra Ca';

    const body = {
      email: customer.email || `${customer.phone}@trazpraca.com`,
      first_name: firstName,
      last_name: lastName,
      phone: {
        number: customer.phone.replace(/\D/g, '')
      }
    };

    try {
      logger.info(`💳 [Mercado Pago] Criando cliente ${customer.name} no Mercado Pago...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Mercado Pago (Customer): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      const mpCustomerId = resData.id;

      await prisma.customer.update({
        where: { id: customer.id },
        data: { mpCustomerId }
      });

      logger.info(`💳 [Mercado Pago] Cliente criado com sucesso! ID: ${mpCustomerId}`);
      return mpCustomerId;
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago] Falha ao criar cliente: ${err.message}`);
      throw err;
    }
  }

  /**
   * Cria uma cobrança via Pix no Mercado Pago com Split automático de pagamento (Marketplace)
   */
  public static async createPixPayment(
    orderId: string,
    value: number,
    mpCustomerId: string,
    merchantId: string,
    applicationFee: number // Taxa fixa da plataforma retida no split.
  ): Promise<IMercadoPagoPixResponse> {
    logger.info(`💳 [Mercado Pago] Iniciando checkout Pix para o pedido #${orderId}. Valor: R$ ${value}, Split Plataforma: R$ ${applicationFee}`);

    // Busca as credenciais do lojista
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    let merchantToken: string | undefined = undefined;
    if (merchant && merchant.mpAccessToken) {
      try {
        merchantToken = decrypt(merchant.mpAccessToken);
      } catch (err) {
        logger.error(`❌ [Mercado Pago] Falha ao decriptar token do lojista ${merchantId}:`, err);
      }
    }

    if (isProduction() && !merchantToken) {
      throw new Error('Lojista sem Mercado Pago conectado. O pedido online não pode ser cobrado em produção.');
    }

    // Se estiver em modo simulado ou se o lojista não tiver conectado o Mercado Pago em desenvolvimento, simula.
    if (this.isMockMode() || !merchantToken) {
      this.assertCanUseMockPayment();
      if (!merchantToken) {
        logger.warn(`⚠️ [Mercado Pago] Lojista ${merchantId} não tem Mercado Pago conectado. Simulando cobrança apenas fora de produção.`);
      }
      return {
        mpPaymentId: 'pay_mock_' + Math.random().toString(36).substring(2, 11),
        copyAndPaste: '00020126360014br.gov.bcb.pix0114mockpay123456785204000053039865406113.005802BR5915TrazPracaMock6006Rondon62070503***63041A2F',
        qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
      };
    }

    const url = 'https://api.mercadopago.com/v1/payments';
    
    // Obtém dados do cliente
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });
    const customerEmail = order?.customer.email || 'comprador@trazpraca.com';
    const customerName = order?.customer.name || 'Comprador Traz Pra Ca';

    const body = {
      transaction_amount: value,
      description: `Pedido #${orderId.substring(0, 8)} - Traz Pra Ca`,
      payment_method_id: 'pix',
      payer: buildMercadoPagoPixPayer(mpCustomerId, customerEmail, customerName),
      application_fee: Number(applicationFee.toFixed(2)),
      external_reference: orderId,
      notification_url: this.getWebhookUrl()
    };

    try {
      // O split no Mercado Pago ocorre fazendo a chamada com o ACCESS_TOKEN do lojista (vendedor)
      // E passando o application_fee que é repassado para a conta do Marketplace (nossa conta central)
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(merchantToken, orderId),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Mercado Pago (Pix): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      const mpPaymentId = String(resData.id);
      const transactionPoint = resData.point_of_interaction;
      const copyAndPaste = transactionPoint?.transaction_data?.qr_code || '';
      const qrCodeBase64 = transactionPoint?.transaction_data?.qr_code_base64 || '';

      logger.info(`✅ [Mercado Pago] Cobrança Pix criada com sucesso! ID: ${mpPaymentId}`);

      return {
        mpPaymentId,
        copyAndPaste,
        qrCodeBase64
      };
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago] Falha ao processar Pix: ${err.message}`);
      throw err;
    }
  }

  /**
   * Cria um pagamento via Cartão de Crédito com Split automático de pagamento (Marketplace)
   */
  public static async createCardPayment(
    orderId: string,
    value: number,
    mpCustomerId: string,
    cardToken: string,
    paymentMethodId: string,
    installments: number,
    payerEmail: string,
    merchantId: string,
    applicationFee: number
  ): Promise<any> {
    logger.info(`💳 [Mercado Pago] Iniciando checkout Cartão para o pedido #${orderId}. Valor: R$ ${value}, Split: R$ ${applicationFee}`);

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    let merchantToken: string | undefined = undefined;
    if (merchant && merchant.mpAccessToken) {
      try {
        merchantToken = decrypt(merchant.mpAccessToken);
      } catch (err) {
        logger.error(`❌ [Mercado Pago] Falha ao decriptar token do lojista ${merchantId}:`, err);
      }
    }

    if (isProduction() && !merchantToken) {
      throw new Error('Lojista sem Mercado Pago conectado. O pagamento por cartão não pode ser cobrado em produção.');
    }

    if (this.isMockMode() || !merchantToken) {
      this.assertCanUseMockPayment();
      if (!merchantToken) {
        logger.warn(`⚠️ [Mercado Pago] Lojista ${merchantId} não tem Mercado Pago conectado. Simulando cobrança apenas fora de produção.`);
      }
      return {
        id: 'pay_mock_' + Math.random().toString(36).substring(2, 11),
        status: 'approved',
        status_detail: 'accredited'
      };
    }

    const url = 'https://api.mercadopago.com/v1/payments';

    const body = {
      token: cardToken,
      transaction_amount: value,
      description: `Pedido #${orderId.substring(0, 8)} - Traz Pra Ca`,
      payment_method_id: paymentMethodId,
      installments: installments,
      payer: {
        email: payerEmail,
        id: mpCustomerId || undefined
      },
      application_fee: Number(applicationFee.toFixed(2)),
      external_reference: orderId,
      notification_url: this.getWebhookUrl()
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(merchantToken, orderId),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Mercado Pago (Cartão): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      logger.info(`✅ [Mercado Pago] Pagamento com cartão processado! ID: ${resData.id}, Status: ${resData.status}`);
      return resData;
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago] Falha ao processar pagamento com cartão: ${err.message}`);
      throw err;
    }
  }

  /**
   * Busca o status atual de uma cobrança no Mercado Pago
   */
  public static async getPaymentStatus(mpPaymentId: string, merchantId: string): Promise<string> {
    if (mpPaymentId.startsWith('pay_mock_')) {
      this.assertCanUseMockPayment();
      return 'approved';
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    let merchantToken: string | undefined = undefined;
    if (merchant && merchant.mpAccessToken) {
      try {
        merchantToken = decrypt(merchant.mpAccessToken);
      } catch (err) {
        logger.error(`❌ [Mercado Pago] Falha ao decriptar token do lojista ${merchantId} para obter status:`, err);
      }
    }

    const url = `https://api.mercadopago.com/v1/payments/${mpPaymentId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(merchantToken)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Mercado Pago (Get Payment): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      return resData.status; // approved, in_process, pending, rejected, cancelled, etc.
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago] Falha ao obter status do pagamento ${mpPaymentId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Solicita estorno de um pagamento do Mercado Pago.
   *
   * A chamada deve acontecer fora de transações do banco. Quem chama este método
   * continua responsável por registrar o resultado operacional no pedido.
   */
  public static async refundPayment(
    mpPaymentId: string,
    merchantId: string,
    amount?: number
  ): Promise<{ id: string; status: string; amount?: number }> {
    logger.info(`💳 [Mercado Pago Refund] Solicitando estorno do pagamento ${mpPaymentId}`);

    if (mpPaymentId.startsWith('pay_mock_') || this.isMockMode()) {
      this.assertCanUseMockPayment();
      return {
        id: `refund_mock_${Math.random().toString(36).substring(2, 11)}`,
        status: 'approved',
        amount
      };
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    let merchantToken: string | undefined = undefined;
    if (merchant?.mpAccessToken) {
      try {
        merchantToken = decrypt(merchant.mpAccessToken);
      } catch (err) {
        logger.error(`❌ [Mercado Pago Refund] Falha ao decriptar token do lojista ${merchantId}:`, err);
      }
    }

    if (!merchantToken) {
      throw new Error('Lojista sem Mercado Pago conectado para processar estorno automático.');
    }

    const url = `https://api.mercadopago.com/v1/payments/${mpPaymentId}/refunds`;
    const body = amount ? { amount: Number(amount.toFixed(2)) } : {};

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(merchantToken, `refund-${mpPaymentId}`),
      body: JSON.stringify(body)
    });

    const resData: any = await response.json();
    if (!response.ok) {
      throw new Error(`Erro Mercado Pago (Refund): ${response.status} - ${JSON.stringify(resData)}`);
    }

    logger.info(`✅ [Mercado Pago Refund] Estorno solicitado com sucesso! ID: ${resData.id}, Status: ${resData.status}`);
    return {
      id: String(resData.id),
      status: String(resData.status || 'approved'),
      amount: resData.amount !== undefined ? Number(resData.amount) : amount
    };
  }

  /**
   * Cria uma assinatura recorrente para o lojista
   */
  public static async createSubscription(
    merchantId: string,
    cardToken: string,
    email: string
  ): Promise<any> {
    logger.info(`💳 [Mercado Pago Assinatura] Inscrevendo lojista ${merchantId}...`);

    if (this.isMockMode()) {
      this.assertCanUseMockPayment();
      logger.info('💳 [Mercado Pago Assinatura] Modo Simulação ativo. Salvando assinatura de teste.');
      const mockSubId = 'sub_mock_' + Math.random().toString(36).substring(2, 11);
      await prisma.merchant.update({
        where: { id: merchantId },
        data: {
          mpSubscriptionId: mockSubId,
          subscriptionStatus: 'ACTIVE'
        }
      });
      return { id: mockSubId, status: 'authorized' };
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new Error('Lojista não encontrado.');

    // Valor da assinatura
    const price = merchant.subscriptionPrice || 125.00;

    const url = 'https://api.mercadopago.com/preapproval';

    const body = {
      payer_email: email,
      card_token_id: cardToken,
      back_url: `${process.env.FRONTEND_URL || 'https://z-entrega.vercel.app'}/api/payments/subscription/success`,
      reason: 'Assinatura Mensal Traz Pra Ca Delivery',
      external_reference: merchantId,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: price,
        currency_id: 'BRL',
        free_trial: {
          frequency: 7,
          frequency_type: 'days'
        }
      },
      status: 'authorized'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Mercado Pago (Subscription): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      
      await prisma.merchant.update({
        where: { id: merchantId },
        data: {
          mpSubscriptionId: resData.id,
          subscriptionStatus: resData.status === 'authorized' ? 'ACTIVE' : 'PENDING'
        }
      });

      logger.info(`✅ [Mercado Pago Assinatura] Assinatura criada com sucesso! ID: ${resData.id}, Status: ${resData.status}`);
      return resData;
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago Assinatura] Falha ao criar assinatura: ${err.message}`);
      throw err;
    }
  }

  /**
   * Cancela uma assinatura recorrente de um lojista
   */
  public static async cancelSubscription(merchantId: string): Promise<any> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant || !merchant.mpSubscriptionId) {
      throw new Error('Assinatura não encontrada para este lojista.');
    }

    if (this.isMockMode()) {
      this.assertCanUseMockPayment();
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { subscriptionStatus: 'CANCELLED' }
      });
      return { status: 'cancelled' };
    }

    const url = `https://api.mercadopago.com/preapproval/${merchant.mpSubscriptionId}`;
    const body = { status: 'cancelled' };

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro Mercado Pago (Cancel Subscription): ${response.status} - ${errorText}`);
      }

      const resData: any = await response.json();
      
      await prisma.merchant.update({
        where: { id: merchantId },
        data: {
          subscriptionStatus: 'CANCELLED'
        }
      });

      logger.info(`✅ [Mercado Pago Assinatura] Assinatura ${merchant.mpSubscriptionId} cancelada.`);
      return resData;
    } catch (err: any) {
      logger.error(`❌ [Mercado Pago Assinatura] Falha ao cancelar assinatura: ${err.message}`);
      throw err;
    }
  }

  public static async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    if (subscriptionId.startsWith('sub_mock_') || this.isMockMode()) {
      this.assertCanUseMockPayment();
      return 'authorized';
    }

    const url = `https://api.mercadopago.com/preapproval/${subscriptionId}`;
    const response = await fetch(url, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro Mercado Pago (Subscription Status): ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    return String(data.status || 'pending');
  }
}
