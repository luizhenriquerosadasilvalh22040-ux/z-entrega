import prisma from '../config/prisma';
import logger from '../config/logger';
import { businessConfig, isSupportedServiceArea } from '../config/business';
import { orderCreationTransactionOptions } from '../config/transactions';
import { ORDER_STATUS, PAYMENT_STATUS, type PaymentStatus } from '../domain/orderStatus';
import { getMerchantPublicationBlockReason } from '../domain/subscriptionStatus';
import { IAddress } from '../types';
import { formatCustomer } from './CustomerService';
import { InventoryService } from './InventoryService';
import { MercadoPagoService } from './MercadoPagoService';
import { NotificationService } from './NotificationService';
import { OrderNotificationService } from './OrderNotificationService';
import { AuditLogService } from './AuditLogService';

type CreateOrderItemInput = {
  productId: string;
  quantity: number;
  chosenOptions?: { groupName: string; optionName: string; price: number }[];
  notes?: string;
};

export type CreateOrderInput = {
  customerId: string;
  merchantId: string;
  itemsData: CreateOrderItemInput[];
  paymentMethod: string;
  deliveryAddress?: IAddress;
  couponCode?: string;
  cardToken?: string;
  paymentMethodId?: string;
  installments?: number;
};

const ORDER_INCLUDE = {
  customer: true,
  merchant: true,
  deliverer: true,
  statusHistory: true,
  items: {
    include: {
      options: true,
      product: true
    }
  }
};

const assertMerchantOpen = (merchant: any): void => {
  const now = new Date();
  const timezone = merchant.timezone || 'America/Sao_Paulo';
  const localTimeStr = now.toLocaleString('en-US', { timeZone: timezone });
  const localDate = new Date(localTimeStr);
  const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();

  const [openH, openM] = merchant.openTime.split(':').map(Number);
  const [closeH, closeM] = merchant.closeTime.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpen = closeMinutes < openMinutes
    ? (currentMinutes >= openMinutes || currentMinutes < closeMinutes)
    : (currentMinutes >= openMinutes && currentMinutes < closeMinutes);

  if (!isOpen) {
    throw new Error('O estabelecimento comercial está fechado no momento e não está aceitando pedidos.');
  }
};

export class OrderCreationService {
  public static async createOrder(input: CreateOrderInput): Promise<any> {
    const savedOrder = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        include: { addresses: true }
      });
      if (!customer) throw new Error('Customer not found');

      const merchant = await tx.merchant.findUnique({
        where: { id: input.merchantId }
      });
      if (!merchant) throw new Error('Merchant not found');

      const publicationBlockReason = getMerchantPublicationBlockReason(merchant);
      if (publicationBlockReason) {
        throw new Error(`O estabelecimento não está habilitado para receber pedidos no momento. ${publicationBlockReason}`);
      }

      if (merchant.isForceClosed) {
        throw new Error('O estabelecimento comercial está fechado manualmente pelo proprietário.');
      }

      if (!merchant.paymentMethods.includes(input.paymentMethod)) {
        throw new Error('Método de pagamento não aceito por este estabelecimento.');
      }

      assertMerchantOpen(merchant);

      const now = new Date();
      const items = [];
      let subtotal = 0;

      const activePromotions = await tx.promotion.findMany({
        where: {
          merchantId: input.merchantId,
          expirationDate: { gte: now }
        }
      });

      const productIds = input.itemsData.map(item => item.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const productMap = new Map(dbProducts.map(product => [product.id, product]));

      for (const item of input.itemsData) {
        const product = productMap.get(item.productId);

        if (!product || product.merchantId !== input.merchantId) throw new Error(`Product not found: ${item.productId}`);
        if (!product.isAvailable) throw new Error(`Product is not available: ${product.name}`);

        await InventoryService.reserveProductStock(tx, product, item.quantity);

        const optionsPrice = item.chosenOptions
          ? item.chosenOptions.reduce((sum, opt) => sum + opt.price, 0)
          : 0;

        let baseAndOptionsPrice = product.price + optionsPrice;

        const applicablePromo = activePromotions.find(promo => {
          if (promo.productIds && promo.productIds.length > 0) {
            return promo.productIds.includes(product.id);
          }
          if (promo.categoryApplicable) {
            return promo.categoryApplicable.toLowerCase() === product.category.toLowerCase();
          }
          return true;
        });

        if (applicablePromo) {
          baseAndOptionsPrice = baseAndOptionsPrice * (1 - applicablePromo.discountPercentage / 100);
        }

        const itemTotal = baseAndOptionsPrice * item.quantity;
        subtotal += itemTotal;

        items.push({
          productId: product.id,
          name: product.name,
          price: baseAndOptionsPrice,
          quantity: item.quantity,
          chosenOptions: item.chosenOptions || [],
          notes: item.notes || ''
        });
      }

      let couponDiscount = 0;
      let appliedCouponId = null;

      if (input.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: input.couponCode.toUpperCase() }
        });

        if (!coupon) throw new Error('Cupom de desconto inválido ou não encontrado.');
        if (!coupon.isActive) throw new Error('Este cupom não está mais ativo.');
        if (new Date(coupon.expirationDate) < new Date()) throw new Error('Este cupom já expirou.');
        if (coupon.merchantId && coupon.merchantId !== input.merchantId) throw new Error('Este cupom não é válido para esta loja.');
        if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
          throw new Error(`O valor mínimo do pedido para este cupom é de R$ ${coupon.minOrderValue.toFixed(2)}.`);
        }
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          throw new Error('Este cupom atingiu o limite máximo de utilizações.');
        }

        const usage = await tx.userCouponUsage.findUnique({
          where: {
            userId_couponId: {
              userId: input.customerId,
              couponId: coupon.id
            }
          }
        });

        if (usage) throw new Error('Você já utilizou este cupom anteriormente.');

        couponDiscount = coupon.discountType === 'PERCENTAGE'
          ? subtotal * (coupon.discountValue / 100)
          : coupon.discountValue;

        if (couponDiscount > subtotal) {
          couponDiscount = subtotal;
        }

        appliedCouponId = coupon.id;

        try {
          if (coupon.maxUses !== null) {
            await tx.coupon.update({
              where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
              data: { usedCount: { increment: 1 } }
            });
          } else {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { increment: 1 } }
            });
          }
        } catch (err) {
          throw new Error('Este cupom atingiu o limite máximo de utilizações.');
        }

        await tx.userCouponUsage.create({
          data: {
            userId: input.customerId,
            couponId: coupon.id
          }
        });
      }

      const finalAddress = input.deliveryAddress || formatCustomer(customer)?.address;
      if (!finalAddress) {
        throw new Error('Endereço de entrega não definido.');
      }
      if (!isSupportedServiceArea(finalAddress.city, finalAddress.state)) {
        throw new Error(`No momento atendemos apenas ${businessConfig.serviceCity}-${businessConfig.serviceState}.`);
      }
      if (!isSupportedServiceArea(merchant.city, merchant.state)) {
        throw new Error(`Esta loja está fora da área piloto ${businessConfig.serviceCity}-${businessConfig.serviceState}.`);
      }

      const subtotalWithDiscount = Math.max(0, subtotal - couponDiscount);
      const commission = Number((subtotalWithDiscount * businessConfig.platformCommissionRate).toFixed(2));
      const deliveryFee = businessConfig.platformDeliveryFee;
      const total = subtotalWithDiscount + deliveryFee;

      const createdOrder = await tx.order.create({
        data: {
          customerId: input.customerId,
          merchantId: input.merchantId,
          subtotal: subtotalWithDiscount,
          commission,
          deliveryFee,
          total,
          status: ORDER_STATUS.PENDING,
          paymentMethod: input.paymentMethod,
          deliveryStreet: finalAddress.street,
          deliveryNumber: finalAddress.number,
          deliveryNeighborhood: finalAddress.neighborhood,
          deliveryCity: finalAddress.city,
          deliveryState: finalAddress.state || 'PR',
          deliveryZip: finalAddress.zipCode,
          deliveryComplement: finalAddress.complement || '',
          deliveryReference: finalAddress.referencePoint || '',
          paymentStatus: PAYMENT_STATUS.PENDING,
          couponId: appliedCouponId
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: createdOrder.id,
          status: ORDER_STATUS.PENDING
        }
      });

      for (const item of items) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes
          }
        });

        if (item.chosenOptions && item.chosenOptions.length > 0) {
          await tx.orderItemOption.createMany({
            data: item.chosenOptions.map(opt => ({
              orderItemId: orderItem.id,
              groupName: opt.groupName,
              optionName: opt.optionName,
              price: opt.price
            }))
          });
        }
      }

      await AuditLogService.record(tx, {
        actorType: 'customer',
        actorId: input.customerId,
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: createdOrder.id,
        orderId: createdOrder.id,
        merchantId: input.merchantId,
        metadata: {
          itemCount: items.length,
          paymentMethod: input.paymentMethod,
          subtotal: subtotalWithDiscount,
          deliveryFee,
          total
        }
      });

      const order = await tx.order.findUnique({
        where: { id: createdOrder.id },
        include: ORDER_INCLUDE
      });

      return {
        order,
        merchant,
        customerData: formatCustomer(customer)!,
        paymentCustomer: customer,
        customerEmail: customer.email || 'comprador@trazpraca.com',
        total,
        applicationFee: deliveryFee + commission
      };
    }, orderCreationTransactionOptions);

    if (!savedOrder.order) {
      throw new Error('Order not found after initial creation');
    }

    const createdOrder = savedOrder.order;
    let paymentConfirmedNow = false;

    try {
      if (input.paymentMethod === 'PIX') {
        const mpCustomerId = await MercadoPagoService.getOrCreateCustomer(savedOrder.paymentCustomer);
        const pixPayment = await MercadoPagoService.createPixPayment(
          createdOrder.id,
          savedOrder.total,
          mpCustomerId,
          input.merchantId,
          savedOrder.applicationFee
        );

        await prisma.order.update({
          where: { id: createdOrder.id },
          data: {
            mpPaymentId: pixPayment.mpPaymentId,
            pixQrCode: pixPayment.qrCodeBase64,
            pixCopyAndPaste: pixPayment.copyAndPaste
          }
        });
      } else if (input.paymentMethod === 'Cartão') {
        if (!input.cardToken || !input.paymentMethodId) {
          throw new Error('Dados do cartão de crédito não fornecidos para pagamento.');
        }

        const mpCustomerId = await MercadoPagoService.getOrCreateCustomer(savedOrder.paymentCustomer);
        const cardPaymentResult = await MercadoPagoService.createCardPayment(
          createdOrder.id,
          savedOrder.total,
          mpCustomerId,
          input.cardToken,
          input.paymentMethodId,
          input.installments || 1,
          savedOrder.customerEmail,
          input.merchantId,
          savedOrder.applicationFee
        );

        const paymentStatusMap: Record<string, PaymentStatus> = {
          approved: PAYMENT_STATUS.RECEIVED,
          in_process: PAYMENT_STATUS.PENDING,
          pending: PAYMENT_STATUS.PENDING,
          rejected: PAYMENT_STATUS.REJECTED,
          cancelled: PAYMENT_STATUS.CANCELLED
        };
        const mpStatus = paymentStatusMap[cardPaymentResult.status] || PAYMENT_STATUS.PENDING;
        if (mpStatus === PAYMENT_STATUS.REJECTED || mpStatus === PAYMENT_STATUS.CANCELLED) {
          throw new Error('Pagamento com cartão não aprovado. O pedido não foi criado.');
        }

        paymentConfirmedNow = mpStatus === PAYMENT_STATUS.RECEIVED;

        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: createdOrder.id },
            data: {
              mpPaymentId: String(cardPaymentResult.id),
              paymentStatus: mpStatus,
              status: mpStatus === PAYMENT_STATUS.RECEIVED ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING
            }
          });

          if (mpStatus === PAYMENT_STATUS.RECEIVED) {
            await tx.orderStatusHistory.create({
              data: {
                orderId: createdOrder.id,
                status: ORDER_STATUS.PAID
              }
            });

            await AuditLogService.record(tx, {
              actorType: 'system',
              action: 'PAYMENT_APPROVED_DURING_ORDER_CREATION',
              entityType: 'Order',
              entityId: createdOrder.id,
              orderId: createdOrder.id,
              merchantId: input.merchantId,
              metadata: {
                provider: 'mercadopago',
                paymentMethod: input.paymentMethod
              }
            });
          }
        }, orderCreationTransactionOptions);
      }
    } catch (err) {
      await OrderCreationService.cancelFailedCreation(createdOrder.id);
      throw err;
    }

    const finalizedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: createdOrder.id },
        include: ORDER_INCLUDE
      });

      if (!order) throw new Error('Order not found after creation');

      const notificationIds = await OrderNotificationService.queueOrderCreated({ tx }, {
        customer: order.customer,
        merchant: order.merchant,
        orderId: order.id,
        total: Number(order.total),
        paymentMethod: input.paymentMethod,
        paymentConfirmedNow
      });

      return { order, notificationIds };
    }, orderCreationTransactionOptions);

    try {
      for (const notificationId of finalizedOrder.notificationIds) {
        await NotificationService.addJobToQueue(notificationId);
      }
    } catch (err) {
      logger.error('Erro ao adicionar notificação pós-commit à fila:', err);
    }

    return finalizedOrder.order;
  }

  private static async cancelFailedCreation(orderId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await InventoryService.restoreOrderStock(tx, orderId);

      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          status: { not: ORDER_STATUS.CANCELLED }
        },
        data: {
          status: ORDER_STATUS.CANCELLED,
          paymentStatus: PAYMENT_STATUS.REJECTED
        }
      });

      if (result.count > 0) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: ORDER_STATUS.CANCELLED
          }
        });

        await AuditLogService.record(tx, {
          actorType: 'system',
          action: 'ORDER_CREATION_CANCELLED',
          entityType: 'Order',
          entityId: orderId,
          orderId,
          metadata: {
            reason: 'payment_creation_failed'
          }
        });
      }
    }, orderCreationTransactionOptions);
  }
}
