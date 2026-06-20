import dotenv from 'dotenv';
dotenv.config();

import prisma from './config/prisma';
import { CustomerService } from './services/CustomerService';
import { OrderService } from './services/OrderService';
import { NotificationService, notificationQueue } from './services/NotificationService';
import { AdminController } from './controllers/AdminController';

async function runTests() {
  console.log('🚀 Iniciando testes de resiliência, otimização e paginação (Rodada 5)...');

  try {
    const merchant = await prisma.merchant.findFirst({ where: { email: 'merchant@example.com' } });
    const customer = await prisma.customer.findFirst({ where: { email: 'customer@example.com' } });
    const pizza = await prisma.product.findFirst({ where: { name: 'Pizza Calabresa Grande' } });

    if (!merchant || !customer || !pizza) {
      throw new Error('Dados de seed ausentes.');
    }

    // Garante que o lojista está aberto no teste
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { openTime: '00:00', closeTime: '23:59' }
    });

    // Limpar pedidos
    await prisma.orderItemOption.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.order.deleteMany({});

    console.log('\n--- Teste 1: Paginação nas Listagens ---');
    // Criamos 5 pedidos de teste para o cliente
    console.log('Criando 5 pedidos para testar paginação...');
    for (let i = 1; i <= 5; i++) {
      await OrderService.createOrder(
        customer.id,
        merchant.id,
        [{ productId: pizza.id, quantity: 1 }],
        'PIX'
      );
    }

    // Listar com limit 2, page 1
    const page1 = await OrderService.listCustomerOrders(customer.id, 1, 2);
    console.log(`Pedidos página 1 (limit 2): ${page1.length} pedidos (Esperado: 2)`);
    
    // Listar com limit 2, page 2
    const page2 = await OrderService.listCustomerOrders(customer.id, 2, 2);
    console.log(`Pedidos página 2 (limit 2): ${page2.length} pedidos (Esperado: 2)`);

    // Listar com limit 2, page 3
    const page3 = await OrderService.listCustomerOrders(customer.id, 3, 2);
    console.log(`Pedidos página 3 (limit 2): ${page3.length} pedidos (Esperado: 1)`);

    if (page1.length !== 2 || page2.length !== 2 || page3.length !== 1) {
      throw new Error('Falha na paginação de listagem de pedidos!');
    }
    console.log('✅ Paginação de pedidos passou no teste!');

    // Testar paginação de listagem de clientes
    // Temos apenas 1 cliente no seed. Vamos listar com limit 1
    const customersList = await CustomerService.listCustomers(1, 1);
    console.log(`Clientes listados com limit 1: ${customersList.length} (Esperado: 1)`);
    if (customersList.length !== 1) {
      throw new Error('Falha na paginação de listagem de clientes!');
    }
    console.log('✅ Paginação de clientes passou no teste!');

    console.log('\n--- Teste 2: Otimização de Relatório Diário de Entregadores (groupBy) ---');
    // Obter um motoboy ativo hoje para testar
    const carlos = await prisma.deliverer.findFirst({ where: { phone: '44999990001' } });
    if (!carlos) {
      throw new Error('Deliverer Carlos não encontrado.');
    }

    // Criar um pedido concluído (DELIVERED) atribuído a ele hoje
    await prisma.order.create({
      data: {
        customerId: customer.id,
        merchantId: merchant.id,
        delivererId: carlos.id,
        subtotal: 45.00,
        commission: 4.50,
        deliveryFee: 5.00,
        total: 50.00,
        status: 'DELIVERED',
        paymentMethod: 'PIX',
        deliveryStreet: 'Rua Principal',
        deliveryNumber: '100',
        deliveryNeighborhood: 'Centro',
        deliveryCity: 'Rondon',
        deliveryState: 'PR',
        deliveryZip: '87800000',
        paymentStatus: 'RECEIVED'
      }
    });

    // Simulando a requisição para getDeliverersDailyReport
    let reportData: any = null;
    const mockRes: any = {
      status: (code: number) => {
        return {
          json: (body: any) => {
            reportData = body;
          }
        };
      }
    };

    await AdminController.getDeliverersDailyReport({} as any, mockRes, (() => {}) as any);
    
    console.log('Relatório de entregadores gerado:');
    console.log(JSON.stringify(reportData, null, 2));

    const carlosReport = reportData.data.report.find((r: any) => r.delivererId === carlos.id);
    if (!carlosReport || carlosReport.completedDeliveries !== 1 || carlosReport.totalPay !== 5.00) {
      throw new Error('Cálculo incorreto no relatório de entregadores!');
    }
    console.log('✅ Relatório diário de entregadores (groupBy) passou no teste!');

    console.log('\n--- Teste 3: Fallback Resiliente a Falhas no Redis ---');
    // Vamos simular a quebra do Redis monkeypatching o método notificationQueue.add para lançar erro
    const originalAdd = notificationQueue.add;
    notificationQueue.add = async () => {
      throw new Error('Redis connection lost (Simulado para Teste de Resiliência)');
    };

    console.log('Simulando envio de notificação sem transação (deve logar o erro, mas NÃO quebrar o fluxo)...');
    const nIdDirect = await NotificationService.queueNotification({
      userId: customer.id,
      userType: 'Customer',
      type: 'WhatsApp',
      target: customer.phone,
      content: 'Teste de resiliência direta'
    });
    console.log(`Notificação direta criada com ID: ${nIdDirect} (Fluxo principal continuou normalmente!)`);

    console.log('Simulando enfileiramento pós-commit de transação (deve logar o erro, mas NÃO lançar exceção)...');
    // addJobToQueue não deve estourar erro
    await NotificationService.addJobToQueue('notif_id_fake');
    console.log('✅ Chamada de addJobToQueue finalizada sem estourar exceções!');

    // Restaurar original
    notificationQueue.add = originalAdd;
    console.log('✅ Fallback resiliente do Redis passou no teste!');

    console.log('\n🎉 TODOS OS TESTES DA RODADA 5 PASSARAM COM SUCESSO! 🎉');

  } catch (err: any) {
    console.error(`❌ Teste falhou: ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
