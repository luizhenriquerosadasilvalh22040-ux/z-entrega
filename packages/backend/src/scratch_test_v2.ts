import dotenv from 'dotenv';
dotenv.config();

import prisma from './config/prisma';
import { OrderService } from './services/OrderService';
import { AsaasService } from './services/AsaasService';

async function runTests() {
  console.log('🚀 Iniciando testes de evolução e estabilidade do backend (Rodada 4)...');

  try {
    // 1. Obter dados semeados
    const merchant = await prisma.merchant.findFirst({ where: { email: 'merchant@example.com' } });
    const customer = await prisma.customer.findFirst({ where: { email: 'customer@example.com' } });
    const pizza = await prisma.product.findFirst({ where: { name: 'Pizza Calabresa Grande' } });
    const burger = await prisma.product.findFirst({ where: { name: 'X-Burger Supremo' } });
    const coke = await prisma.product.findFirst({ where: { name: 'Coca-Cola 2 Litros' } });

    if (!merchant || !customer || !pizza || !burger || !coke) {
      throw new Error('Dados de seed ausentes no banco.');
    }

    console.log('✅ Dados de seed carregados com sucesso.');

    // Resetar ordens anteriores
    await prisma.orderItemOption.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.order.deleteMany({});

    console.log('\n--- Teste 1: Validação de Método de Pagamento do Lojista ---');
    try {
      await OrderService.createOrder(
        customer.id,
        merchant.id,
        [{ productId: pizza.id, quantity: 1 }],
        'Bitcoin' // Método inválido/não aceito
      );
      throw new Error('Permitiu criar pedido com método de pagamento não aceito.');
    } catch (err: any) {
      console.log(`✅ Capturou erro esperado: "${err.message}"`);
    }

    console.log('\n--- Teste 2: Verificação de Horário com Timezone Local ---');
    // Forçar a loja a estar fechada no fuso da loja (definindo openTime e closeTime para horários passados)
    // Ex: das 02:00 às 03:00 da manhã
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { openTime: '02:00', closeTime: '03:00', timezone: 'America/Sao_Paulo' }
    });

    try {
      await OrderService.createOrder(
        customer.id,
        merchant.id,
        [{ productId: pizza.id, quantity: 1 }],
        'PIX'
      );
      throw new Error('Permitiu criar pedido com estabelecimento fechado (fuso local).');
    } catch (err: any) {
      console.log(`✅ Capturou erro de estabelecimento fechado no fuso local: "${err.message}"`);
    }

    // Reabrir o lojista
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { openTime: '00:00', closeTime: '23:59' }
    });

    console.log('\n--- Teste 3: Aplicação de Promoções com Escopo Específico ---');
    // Criamos um pedido contendo Pizza Calabresa, X-Burger Supremo e Coca-Cola
    // A Pizza deve ter 10% de desconto (45.00 -> 40.50)
    // O X-Burger deve ter 20% de desconto (25.00 -> 20.00)
    // A Coca-Cola não tem promoção (10.00 -> 10.00)
    // Subtotal esperado: 40.50 + 20.00 + 10.00 = 70.50
    const order = await OrderService.createOrder(
      customer.id,
      merchant.id,
      [
        { productId: pizza.id, quantity: 1 },
        { productId: burger.id, quantity: 1 },
        { productId: coke.id, quantity: 1 }
      ],
      'PIX'
    );

    console.log(`Pedido criado. ID: ${order.id}`);
    console.log(`Subtotal calculado pelo backend: R$ ${order.subtotal.toFixed(2)} (Esperado: R$ 70.50)`);

    if (Math.abs(order.subtotal - 70.50) > 0.01) {
      throw new Error(`Cálculo de subtotal incorreto com promoção! Esperava R$ 70.50, mas obteve R$ ${order.subtotal}`);
    }
    console.log('✅ Cálculo de promoções por escopo passou no teste!');

    console.log('\n--- Teste 4: Cancelamento Concorrente de PIX e Bypass ---');
    // Para testar o bypass do Asaas, vamos simular que o pagamento foi recebido no Asaas
    // Vamos forçar o status de pagamento do Asaas Mock criando uma ordem fictícia e fingindo pagamento
    // Mas no código do AsaasService.getPaymentStatus se o ID começa com pay_mock_ ele retorna PENDING.
    // Vamos monkeypatch o AsaasService.getPaymentStatus temporariamente no teste ou usar uma trapaça
    const originalGetPaymentStatus = AsaasService.getPaymentStatus;
    
    // Forçamos o retorno 'CONFIRMED' para o primeiro pagamento (bypass)
    AsaasService.getPaymentStatus = async (paymentId: string) => {
      if (paymentId === 'pay_confirmed_test') {
        return 'CONFIRMED';
      }
      return 'PENDING';
    };

    // Pedido 1: Pago no Asaas (deve sofrer bypass de cancelamento e virar ACCEPTED)
    const orderPaid = await prisma.order.create({
      data: {
        customerId: customer.id,
        merchantId: merchant.id,
        subtotal: 50.00,
        commission: 5.00,
        deliveryFee: 5.00,
        total: 55.00,
        status: 'PENDING',
        paymentMethod: 'PIX',
        deliveryStreet: 'Rua Principal',
        deliveryNumber: '100',
        deliveryNeighborhood: 'Centro',
        deliveryCity: 'Rondon',
        deliveryState: 'PR',
        deliveryZip: '87800000',
        paymentStatus: 'PENDING',
        asaasPaymentId: 'pay_confirmed_test',
        createdAt: new Date(Date.now() - 15 * 60 * 1000) // Criado há 15 minutos (elegível para cron)
      }
    });

    // Pedido 2: Realmente não pago (deve ser cancelado)
    const orderUnpaid = await prisma.order.create({
      data: {
        customerId: customer.id,
        merchantId: merchant.id,
        subtotal: 50.00,
        commission: 5.00,
        deliveryFee: 5.00,
        total: 55.00,
        status: 'PENDING',
        paymentMethod: 'PIX',
        deliveryStreet: 'Rua Principal',
        deliveryNumber: '100',
        deliveryNeighborhood: 'Centro',
        deliveryCity: 'Rondon',
        deliveryState: 'PR',
        deliveryZip: '87800000',
        paymentStatus: 'PENDING',
        asaasPaymentId: 'pay_unpaid_test',
        createdAt: new Date(Date.now() - 15 * 60 * 1000)
      }
    });

    console.log(`Rodando cancelUnpaidPixOrders...`);
    await OrderService.cancelUnpaidPixOrders();

    const dbOrderPaid = await prisma.order.findUnique({ where: { id: orderPaid.id } });
    const dbOrderUnpaid = await prisma.order.findUnique({ where: { id: orderUnpaid.id } });

    console.log(`Status do Pedido Pago: ${dbOrderPaid?.status} (Esperado: ACCEPTED devido ao bypass)`);
    console.log(`Status do Pedido Não Pago: ${dbOrderUnpaid?.status} (Esperado: CANCELLED)`);

    if (dbOrderPaid?.status !== 'ACCEPTED' || dbOrderUnpaid?.status !== 'CANCELLED') {
      throw new Error('Falha no teste de cancelamento de PIX e bypass de pagamento!');
    }
    console.log('✅ Cancelamento de PIX concorrente e bypass passaram no teste!');

    // Restaurar método original
    AsaasService.getPaymentStatus = originalGetPaymentStatus;

    console.log('\n--- Teste 5: Otimização de Estatísticas do Lojista (getMerchantStats) ---');
    // Temos dois pedidos ativos com valores para calcular estatísticas
    // Pedido 'orderPaid' de total R$ 55 (subtotal R$ 50, commission R$ 5) com status ACCEPTED (contabiliza nas estatísticas)
    // Pedido 'orderUnpaid' com status CANCELLED (não contabiliza)
    // Pedido inicial 'order' com status PIX PENDING (não contabiliza pois é PENDING)
    // Vamos criar outro pedido com status DELIVERED no valor de R$ 30 (subtotal R$ 30, commission R$ 3) com método 'Dinheiro'
    await prisma.order.create({
      data: {
        customerId: customer.id,
        merchantId: merchant.id,
        subtotal: 30.00,
        commission: 3.00,
        deliveryFee: 5.00,
        total: 35.00,
        status: 'DELIVERED',
        paymentMethod: 'Dinheiro',
        deliveryStreet: 'Rua Principal',
        deliveryNumber: '100',
        deliveryNeighborhood: 'Centro',
        deliveryCity: 'Rondon',
        deliveryState: 'PR',
        deliveryZip: '87800000',
        paymentStatus: 'RECEIVED'
      }
    });

    // Estatísticas esperadas:
    // totalOrders: 4 (orderPaid, orderUnpaid, order, pedidoDinheiro)
    // pendingOrders: 1 (order)
    // revenue: 50.00 (orderPaid) + 30.00 (pedidoDinheiro) = 80.00
    // averageTicket: 80.00 / 2 = 40.00
    // totalCommission: 5.00 + 3.00 = 8.00
    // pixRevenue: 50.00
    // cashRevenue: 30.00
    // cardRevenue: 0.00

    const stats = await OrderService.getMerchantStats(merchant.id);
    console.log('Estatísticas calculadas pelo banco:');
    console.log(`- totalOrders: ${stats.totalOrders} (Esperado: 4)`);
    console.log(`- pendingOrders: ${stats.pendingOrders} (Esperado: 1)`);
    console.log(`- revenue: R$ ${stats.revenue.toFixed(2)} (Esperado: R$ 80.00)`);
    console.log(`- averageTicket: R$ ${stats.averageTicket.toFixed(2)} (Esperado: R$ 40.00)`);
    console.log(`- totalCommission: R$ ${stats.totalCommission.toFixed(2)} (Esperado: R$ 8.00)`);
    console.log(`- pixRevenue: R$ ${stats.pixRevenue.toFixed(2)} (Esperado: R$ 50.00)`);
    console.log(`- cashRevenue: R$ ${stats.cashRevenue.toFixed(2)} (Esperado: R$ 30.00)`);
    console.log(`- cardRevenue: R$ ${stats.cardRevenue.toFixed(2)} (Esperado: R$ 0.00)`);

    if (
      stats.totalOrders !== 4 ||
      stats.pendingOrders !== 1 ||
      stats.revenue !== 80.00 ||
      stats.averageTicket !== 40.00 ||
      stats.totalCommission !== 8.00 ||
      stats.pixRevenue !== 50.00 ||
      stats.cashRevenue !== 30.00 ||
      stats.cardRevenue !== 0.00
    ) {
      throw new Error('Estatísticas calculadas incorretamente.');
    }
    console.log('✅ Otimização e cálculos de getMerchantStats passaram no teste!');

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 🎉');

  } catch (err: any) {
    console.error(`❌ Teste falhou: ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
