import prisma from '../config/prisma';

const ONLINE_METHODS = ['PIX', 'Cartão'];
const OFFLINE_METHODS = ['Dinheiro', 'Cartão na entrega'];
const EXCLUDED_STATUSES = ['PENDING', 'CANCELLED'];

export class MerchantWalletService {
  public static async getSnapshot(merchantId: string) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { mpUserId: true, mpAccessToken: true }
    });
    if (!merchant) throw new Error('Lojista não encontrado.');

    const validOrders = { merchantId, status: { notIn: EXCLUDED_STATUSES as any[] } };
    const [online, offline, recentOrders] = await Promise.all([
      prisma.order.aggregate({
        where: {
          ...validOrders,
          paymentMethod: { in: ONLINE_METHODS },
          paymentStatus: 'RECEIVED'
        },
        _sum: { total: true, commission: true, deliveryFee: true },
        _count: { id: true }
      }),
      prisma.order.aggregate({
        where: { ...validOrders, paymentMethod: { in: OFFLINE_METHODS } },
        _sum: { subtotal: true },
        _count: { id: true }
      }),
      prisma.order.findMany({
        where: validOrders,
        select: {
          id: true,
          createdAt: true,
          paymentMethod: true,
          paymentStatus: true,
          total: true,
          subtotal: true,
          commission: true,
          deliveryFee: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);

    const onlineGross = Number(online._sum.total || 0);
    const marketplaceFees =
      Number(online._sum.commission || 0) + Number(online._sum.deliveryFee || 0);

    return {
      mercadoPagoConnected: Boolean(merchant.mpUserId && merchant.mpAccessToken),
      onlineGross,
      marketplaceFees,
      estimatedSellerTransfer: Math.max(0, onlineGross - marketplaceFees),
      offlineReceivables: Number(offline._sum.subtotal || 0),
      onlineOrders: online._count.id,
      offlineOrders: offline._count.id,
      mercadoPagoAccountUrl: 'https://www.mercadopago.com.br/',
      disclaimer:
        'Estimativa conciliada pelo sistema. O saldo disponível e as tarifas de processamento são confirmados no Mercado Pago.',
      transactions: recentOrders.map((order) => {
        const isOnline = ONLINE_METHODS.includes(order.paymentMethod);
        const platformFee = isOnline
          ? Number(order.commission) + Number(order.deliveryFee)
          : 0;
        return {
          id: order.id,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          gross: isOnline ? Number(order.total) : Number(order.subtotal),
          platformFee,
          estimatedNet: isOnline
            ? Math.max(0, Number(order.total) - platformFee)
            : Number(order.subtotal)
        };
      })
    };
  }
}
