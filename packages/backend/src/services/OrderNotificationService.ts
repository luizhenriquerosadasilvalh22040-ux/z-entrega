import { ORDER_STATUS } from '../domain/orderStatus';
import { NotificationService } from './NotificationService';
import { WhatsAppTemplateService } from './WhatsAppTemplateService';
import { WhatsAppTemplateType } from '@prisma/client';
import { buildMerchantOrderMessage } from '../domain/merchantOrderMessage';
import { shouldNotifyCustomerForOrderStatus } from '../domain/notificationPolicy';

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
      order: any;
      paymentConfirmedNow: boolean;
    }
  ): Promise<string[]> {
    const notificationIds: string[] = [];
    const { order } = params;

    const customerContent = await WhatsAppTemplateService.render(
      WhatsAppTemplateType.ORDER_CREATED,
      {
        customerName: order.customer.name,
        orderId: order.id,
        merchantName: order.merchant.name,
        total: Number(order.total).toFixed(2),
        paymentMethod: order.paymentMethod
      },
      order.paymentMethod === 'PIX'
        ? 'Olá, *{{customerName}}*! Recebemos o seu pedido nº *{{orderId}}* no estabelecimento *{{merchantName}}*. Total: R$ {{total}}. Aguardando confirmação do pagamento PIX.'
        : 'Olá, *{{customerName}}*! Recebemos o seu pedido nº *{{orderId}}* no estabelecimento *{{merchantName}}*. Total: R$ {{total}}. Aguardando confirmação do lojista!',
      tx
    );

    const customerNotificationId = await NotificationService.queueNotification({
      userId: order.customer.id,
      userType: 'Customer',
      type: 'WhatsApp',
      target: order.customer.phone,
      content: customerContent
    }, tx);
    notificationIds.push(customerNotificationId);

    if (order.paymentMethod === 'Dinheiro' || params.paymentConfirmedNow) {
      const merchantNotificationId = await NotificationService.queueNotification({
        userId: order.merchant.id,
        userType: 'Merchant',
        type: 'WhatsApp',
        target: order.merchant.phone,
        content: buildMerchantOrderMessage(order)
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
      content: buildMerchantOrderMessage(order)
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

    if (shouldNotifyCustomerForOrderStatus(status) && (status === ORDER_STATUS.ACCEPTED || status === ORDER_STATUS.PREPARING)) {
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

      }
    } else if (shouldNotifyCustomerForOrderStatus(status) && (status === ORDER_STATUS.DISPATCHED || status === ORDER_STATUS.IN_TRANSIT)) {
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
    } else if (shouldNotifyCustomerForOrderStatus(status) && status === ORDER_STATUS.DELIVERED) {
      const nId = await NotificationService.queueNotification({
        userId: customer.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
        content: `Olá, *${customer.name}*! Seu pedido nº *${order.id}* foi entregue! Agradecemos a preferência.`
      }, tx);
      notificationIds.push(nId);
    } else if (shouldNotifyCustomerForOrderStatus(status) && status === ORDER_STATUS.CANCELLED) {
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
