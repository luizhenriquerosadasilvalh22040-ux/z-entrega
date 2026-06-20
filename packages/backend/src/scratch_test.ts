import dotenv from 'dotenv';
dotenv.config();

import prisma from './config/prisma';
import { OrderService } from './services/OrderService';

async function runTest() {
  console.log('🚀 Iniciando testes de lógica de negócios e fluxo de motoboys...');

  try {
    // 1. Obter lojista, cliente e produto
    const merchant = await prisma.merchant.findFirst({
      where: { email: 'merchant@example.com' }
    });
    const customer = await prisma.customer.findFirst({
      where: { email: 'customer@example.com' }
    });
    const product = await prisma.product.findFirst({
      where: { name: 'Pizza Calabresa Grande' }
    });

    if (!merchant || !customer || !product) {
      throw new Error('Dados de seed ausentes no banco. Por favor, execute o seed do banco de dados primeiro.');
    }

    console.log(`\n✅ Lojista: ${merchant.name} (ID: ${merchant.id})`);
    console.log(`✅ Cliente: ${customer.name} (ID: ${customer.id})`);
    console.log(`✅ Produto: ${product.name} (ID: ${product.id})`);

    // Obter os entregadores criados no seed
    const carlos = await prisma.deliverer.findFirst({ where: { phone: '44999990001' } });
    const marcos = await prisma.deliverer.findFirst({ where: { phone: '44999990002' } });

    if (!carlos || !marcos) {
      throw new Error('Entregadores de teste Carlos ou Marcos ausentes.');
    }

    console.log(`✅ Carlos: ${carlos.name} (ID: ${carlos.id})`);
    console.log(`✅ Marcos: ${marcos.name} (ID: ${marcos.id})`);

    // Resetar status de Carlos e Marcos
    await prisma.deliverer.update({
      where: { id: carlos.id },
      data: { deliveryStatus: 'AVAILABLE', isAvailable: true, isActiveToday: true }
    });
    await prisma.deliverer.update({
      where: { id: marcos.id },
      data: { deliveryStatus: 'AVAILABLE', isAvailable: true, isActiveToday: true }
    });

    // Limpar pedidos anteriores
    await prisma.orderItemOption.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.order.deleteMany({});

    console.log('\n--- Teste 1: Atribuição por Menor Carga ---');
    // Criar pedido 1
    const order1 = await OrderService.createOrder(
      customer.id,
      merchant.id,
      [{ productId: product.id, quantity: 1 }],
      'PIX'
    );
    console.log(`Pedido 1 criado. ID: ${order1.id}`);

    // Mudar status para READY
    const readyOrder1 = await OrderService.updateStatus(order1.id, 'READY', merchant.id, 'merchant');
    console.log(`Pedido 1 atualizado para READY. Entregador atribuído: ${readyOrder1.delivererId?.name}`);
    const assignedId = readyOrder1.delivererId?.id;

    // Criar pedido 2
    const order2 = await OrderService.createOrder(
      customer.id,
      merchant.id,
      [{ productId: product.id, quantity: 1 }],
      'PIX'
    );
    console.log(`Pedido 2 criado. ID: ${order2.id}`);

    // Mudar status para READY. Deve ser atribuído ao outro entregador por ter menor carga (carga 0 contra carga 1)
    const readyOrder2 = await OrderService.updateStatus(order2.id, 'READY', merchant.id, 'merchant');
    console.log(`Pedido 2 atualizado para READY. Entregador atribuído: ${readyOrder2.delivererId?.name}`);

    if (readyOrder2.delivererId?.id === assignedId) {
      throw new Error('Falha na distribuição inteligente! O pedido foi atribuído ao mesmo motoboy mesmo o outro estando livre (carga 0).');
    }
    console.log('✅ Distribuição inteligente por menor carga funcionou com sucesso!');

    console.log('\n--- Teste 2: Aceitar Entrega via WhatsApp ---');
    // Carlos aceita o pedido 1
    const acceptRes = await OrderService.processDelivererResponse(order1.id, assignedId, 'accept');
    console.log(`Resposta ao aceitar: ${acceptRes.message}`);
    
    let dbOrder1 = await prisma.order.findUnique({ where: { id: order1.id } });
    let dbDeliverer1 = await prisma.deliverer.findUnique({ where: { id: assignedId } });
    
    console.log(`Status do pedido 1: ${dbOrder1?.status} (Esperado: READY)`);
    console.log(`Status de resposta do entregador: ${dbOrder1?.delivererStatus} (Esperado: ACCEPTED)`);
    console.log(`Status de entrega do motoboy: ${dbDeliverer1?.deliveryStatus} (Esperado: COLLECTING)`);

    if (dbOrder1?.delivererStatus !== 'ACCEPTED' || dbDeliverer1?.deliveryStatus !== 'COLLECTING') {
      throw new Error('Falha ao aceitar a entrega!');
    }
    console.log('✅ Aceite de entrega funcionou com sucesso!');

    console.log('\n--- Teste 3: Recusar Entrega via WhatsApp (Reatribuição Imediata) ---');
    // Pedido 2 foi atribuído ao outro entregador. Vamos recusá-lo.
    const otherDelivererId = readyOrder2.delivererId?.id;
    console.log(`Recusando entrega do Pedido 2 pelo entregador ${readyOrder2.delivererId?.name}...`);
    const rejectRes = await OrderService.processDelivererResponse(order2.id, otherDelivererId, 'reject');
    console.log(`Resposta ao recusar: ${rejectRes.message}`);

    // Aguarda um pequeno delay para a reatribuição assíncrona completar
    await new Promise(resolve => setTimeout(resolve, 500));

    const dbOrder2AfterReject = await prisma.order.findUnique({ where: { id: order2.id } });
    const dbDeliverer2AfterReject = await prisma.deliverer.findUnique({ where: { id: otherDelivererId } });

    console.log(`Após recusa do Pedido 2:`);
    console.log(`Status do entregador recusador: ${dbDeliverer2AfterReject?.deliveryStatus} (Esperado: AVAILABLE)`);
    console.log(`Novo entregador no Pedido 2: ${dbOrder2AfterReject?.delivererId} (Esperado: ${assignedId} pois Carlos agora era o único disponível)`);
    console.log(`Status de resposta do novo entregador no Pedido 2: ${dbOrder2AfterReject?.delivererStatus} (Esperado: PENDING)`);

    if (dbOrder2AfterReject?.delivererId !== assignedId || dbOrder2AfterReject?.delivererStatus !== 'PENDING') {
      throw new Error('Falha na reatribuição imediata pós-rejeição!');
    }
    console.log('✅ Reatribuição imediata pós-rejeição funcionou com sucesso!');

    console.log('\n--- Teste 4: Reatribuição Automática por Timeout ---');
    // Vamos simular o timeout do Carlos que recebeu o pedido 2 reatribuído
    console.log(`Simulando timeout do Carlos no Pedido 2...`);
    await OrderService.autoReassignDeliverer(order2.id, assignedId);

    const dbOrder2AfterTimeout = await prisma.order.findUnique({ where: { id: order2.id } });
    const dbDeliverer1AfterTimeout = await prisma.deliverer.findUnique({ where: { id: assignedId } });

    console.log(`Após timeout no Pedido 2:`);
    console.log(`Status do entregador que sofreu timeout: ${dbDeliverer1AfterTimeout?.deliveryStatus} (Esperado: AVAILABLE)`);
    console.log(`Novo entregador no Pedido 2 após timeout: ${dbOrder2AfterTimeout?.delivererId} (Esperado: ${otherDelivererId} pois Marcos é a única opção restante)`);
    console.log(`Status de resposta do entregador após timeout: ${dbOrder2AfterTimeout?.delivererStatus} (Esperado: PENDING)`);

    if (dbOrder2AfterTimeout?.delivererId !== otherDelivererId || dbOrder2AfterTimeout?.delivererStatus !== 'PENDING') {
      throw new Error('Falha na reatribuição automática por timeout!');
    }
    console.log('✅ Reatribuição automática por timeout funcionou com sucesso!');

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 🎉');

  } catch (error: any) {
    console.error('❌ Teste falhou:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTest();
