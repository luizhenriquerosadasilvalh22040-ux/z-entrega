import { ORDER_STATUS } from '../domain/orderStatus';
import { NotificationService } from './NotificationService';
import { WhatsAppTemplateService } from './WhatsAppTemplateService';
import { WhatsAppTemplateType } from '@prisma/client';

type QueueContext = {
  tx: any;
};

type DeliveryResponseUrlBuilder = (
  orderId: string,
  delivererId: string,
  action: 'accept' | 'reject'
) => string;

export class OrderNotificationService {
  public static async queueOrderCreated(
    { tx }: QueueContext,
    params: {
      customer: any;
      merchant: any;
      orderId: string;
      total: number;
      paymentMethod: string;
      paymentConfirmedNow: boolean;
    }
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    const customerContent = await WhatsAppTemplateService.render(
      WhatsAppTemplateType.ORDER_CREATED,
      {
        customerName: params.customer.name,
        orderId: params.orderId,
        merchantName: params.merchant.name,
        total: params.total.toFixed(2),
        paymentMethod: params.paymentMethod
      },
      params.paymentMethod === 'PIX'
        ? 'Olá, *{{customerName}}*! Recebemos o seu pedido nº *{{orderId}}* no estabelecimento *{{merchantName}}*. Total: R$ {{total}}. Aguardando confirmação do pagamento PIX.'
        : 'Olá, *{{customerName}}*! Recebemos o seu pedido nº *{{orderId}}* no estabelecimento *{{merchantName}}*. Total: R$ {{total}}. Aguardando confirmação do lojista!',
      tx
    );

    const customerNotificationId = await NotificationService.queueNotification({
      userId: params.customer.id,
      userType: 'Customer',
      type: 'WhatsApp',
      target: params.customer.phone,
      content: customerContent
    }, tx);
    notificationIds.push(customerNotificationId);

    if (params.paymentMethod === 'Dinheiro' || params.paymentConfirmedNow) {
      const merchantContent = await WhatsAppTemplateService.render(
        WhatsAppTemplateType.STORE_ORDER_CREATED,
        {
          customerName: params.customer.name,
          orderId: params.orderId,
          paymentMethod: params.paymentMethod,
          total: params.total.toFixed(2)
        },
        'Novo pedido aguardando aceite.\n\nPedido: *{{orderId}}*\nCliente: *{{customerName}}*\nPagamento: *{{paymentMethod}}*\nTotal: R$ {{total}}\n\nAcesse o painel do lojista para aceitar ou cancelar.',
        tx
      );

      const merchantNotificationId = await NotificationService.queueNotification({
        userId: params.merchant.id,
        userType: 'Merchant',
        type: 'WhatsApp',
        target: params.merchant.phone,
        content: merchantContent
      }, tx);
      notificationIds.push(merchantNotificationId);
    }

    return notificationIds;
  }

  public static async queuePaymentApproved(
    { tx }: QueueContext,
    order: any
  ): Promise<string[]> {
    const customerContent = await WhatsAppTemplateService.render(
      WhatsAppTemplateType.PAYMENT_APPROVED,
      {
        customerName: order.customer.name,
        orderId: order.id,
        merchantName: order.merchant.name
      },
      'Olá, *{{customerName}}*! O pagamento do pedido nº *{{orderId}}* foi confirmado. Agora estamos aguardando o aceite de *{{merchantName}}*.',
      tx
    );

    const customerNotificationId = await NotificationService.queueNotification({
      userId: order.customer.id,
      userType: 'Customer',
      type: 'WhatsApp',
      target: order.customer.phone,
      content: customerContent
    }, tx);

    const merchantNotificationId = await NotificationService.queueNotification({
      userId: order.merchant.id,
      userType: 'Merchant',
      type: 'WhatsApp',
      target: order.merchant.phone,
      content: await WhatsAppTemplateService.render(
        WhatsAppTemplateType.STORE_ORDER_CREATED,
        {
          customerName: order.customer.name,
          orderId: order.id,
          paymentMethod: order.paymentMethod,
          total: Number(order.total).toFixed(2)
        },
        undefined,
        tx
      )
    }, tx);

    return [customerNotificationId, merchantNotificationId];
  }

  public static async queueStatusChanged(
    { tx }: QueueContext,
    params: {
      order: any;
      status: string;
      buildDeliveryResponseUrl: DeliveryResponseUrlBuilder;
    }
  ): Promise<string[]> {
    const notificationIds: string[] = [];
    const { order, status } = params;
    const customer = order.customer;
    const merchant = order.merchant;
    const deliverer = order.deliverer;

    if (status === ORDER_STATUS.ACCEPTED || status === ORDER_STATUS.PREPARING) {
      const nId = await NotificationService.queueNotification({
        userId: customer.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
      content: await WhatsAppTemplateService.render(
        WhatsAppTemplateType.ORDER_ACCEPTED,
        {
          customerName: customer.name,
          orderId: order.id,
          merchantName: merchant.name,
          estimatedTime: '15 a 25 minutos'
        },
        undefined,
        tx
      )
      }, tx);
      notificationIds.push(nId);
    } else if (status === ORDER_STATUS.READY) {
      if (deliverer) {
        const pickupAddr = `${merchant.street}, ${merchant.number} - ${merchant.neighborhood}, ${merchant.city}`;
        const delivAddr = `${order.deliveryStreet}, ${order.deliveryNumber} - ${order.deliveryNeighborhood}, ${order.deliveryCity}` +
          (order.deliveryComplement ? `, Complemento: ${order.deliveryComplement}` : '') +
          (order.deliveryReference ? ` (Ref: ${order.deliveryReference})` : '');

        const delivererNotificationId = await NotificationService.queueNotification({
          userId: deliverer.id,
          userType: 'Deliverer',
          type: 'WhatsApp',
          target: deliverer.phone,
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.DELIVERY_REQUEST,
            {
              delivererName: deliverer.name,
              orderId: order.id,
              merchantName: merchant.name,
              pickupAddress: pickupAddr,
              deliveryAddress: delivAddr,
              deliveryFee: Number(order.deliveryFee).toFixed(2),
              acceptUrl: params.buildDeliveryResponseUrl(order.id, deliverer.id, 'accept'),
              rejectUrl: params.buildDeliveryResponseUrl(order.id, deliverer.id, 'reject')
            },
            'Olá, *{{delivererName}}*! Novo pedido pronto para coleta no estabelecimento *{{merchantName}}* (Endereço: {{pickupAddress}}). Destino: {{deliveryAddress}}. Taxa de entrega: R$ {{deliveryFee}}.\n\nResponda a esta entrega:\nAceitar: {{acceptUrl}}\nRecusar: {{rejectUrl}}',
            tx
          )
        }, tx);
        notificationIds.push(delivererNotificationId);

        const customerNotificationId = await NotificationService.queueNotification({
          userId: customer.id,
          userType: 'Customer',
          type: 'WhatsApp',
          target: customer.phone,
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.ORDER_READY,
            {
              customerName: customer.name,
              orderId: order.id,
              merchantName: merchant.name,
              delivererName: `O entregador ${deliverer.name} foi acionado para a entrega.`
            },
            undefined,
            tx
          )
        }, tx);
        notificationIds.push(customerNotificationId);
      } else {
        const nId = await NotificationService.queueNotification({
          userId: customer.id,
          userType: 'Customer',
          type: 'WhatsApp',
          target: customer.phone,
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.ORDER_READY,
            {
              customerName: customer.name,
              orderId: order.id,
              merchantName: merchant.name,
              delivererName: 'Estamos buscando um entregador disponível.'
            },
            undefined,
            tx
          )
        }, tx);
        notificationIds.push(nId);
      }
    } else if (status === ORDER_STATUS.DISPATCHED || status === ORDER_STATUS.IN_TRANSIT) {
      const nId = await NotificationService.queueNotification({
        userId: customer.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
        content: await WhatsAppTemplateService.render(
          WhatsAppTemplateType.ORDER_READY,
          {
            customerName: customer.name,
            orderId: order.id,
            merchantName: merchant.name,
            delivererName: 'Seu pedido saiu para entrega e está a caminho do seu endereço.'
          },
          undefined,
          tx
        )
      }, tx);
      notificationIds.push(nId);
    } else if (status === ORDER_STATUS.DELIVERED) {
      const nId = await NotificationService.queueNotification({
        userId: customer.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
        content: `Olá, *${customer.name}*! Seu pedido nº *${order.id}* foi entregue! Agradecemos a preferência.`
      }, tx);
      notificationIds.push(nId);
    } else if (status === ORDER_STATUS.CANCELLED) {
      const nId = await NotificationService.queueNotification({
        userId: customer.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
        content: await WhatsAppTemplateService.render(
          WhatsAppTemplateType.ORDER_CANCELLED,
          {
            customerName: customer.name,
            orderId: order.id,
            merchantName: merchant.name
          },
          undefined,
          tx
        )
      }, tx);
      notificationIds.push(nId);
    }

    return notificationIds;
  }
}
