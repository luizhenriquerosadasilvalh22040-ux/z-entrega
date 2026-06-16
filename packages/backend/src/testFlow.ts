import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from './config/database';
import { Customer } from './models/Customer';
import { Merchant } from './models/Merchant';
import { Product } from './models/Product';
import { Deliverer } from './models/Deliverer';
import { Order } from './models/Order';
import { Notification } from './models/Notification';
import { OrderService } from './services/OrderService';
import { AuthService } from './services/AuthService';
import logger from './config/logger';

async function runTestFlow() {
  try {
    logger.info('Starting programmatic E2E flow validation...');
    await connectDatabase();

    // 1. Encontra Lojista e Produto semeados
    const merchant = await Merchant.findOne({ email: 'merchant@example.com' });
    if (!merchant) {
      throw new Error('Seed data missing. Please run seed script first.');
    }

    // Assegura que o lojista está com as portas abertas no horário de execução para o teste passar
    merchant.operatingHours = { open: '00:00', close: '23:59' };
    await merchant.save();

    const product = await Product.findOne({ name: 'Pizza Calabresa Grande', merchantId: merchant._id });
    if (!product) {
      throw new Error('Product data missing.');
    }

    // 2. Fluxo OTP do Cliente
    logger.info('--- 2. Testando fluxo OTP do Cliente ---');
    const testPhone = '44999998888';
    
    // Solicita o código OTP
    logger.info(`Solicitando OTP para o telefone ${testPhone}...`);
    const otpReq = await AuthService.requestCustomerOtp(testPhone, 'João Silva', {
      street: 'Rua São Paulo',
      number: '450',
      neighborhood: 'Jardim Planalto',
      city: 'Rondon',
      state: 'PR',
      zipCode: '87800000',
      coordinates: { lat: -23.415, lng: -52.752 }
    });
    logger.info(`OTP solicitado. Novo usuário? ${otpReq.isNewUser}`);

    // Verifica o código OTP
    logger.info('Verificando OTP com o código padrão "1234"...');
    const verifyRes = await AuthService.verifyCustomerOtp(testPhone, '1234');
    const customer = verifyRes.customer;
    logger.info(`Cliente autenticado com sucesso: ${customer.name} (${customer.phone})`);

    // 2. Garante que exista um entregador cadastrado e escalado para hoje
    let deliverer = await Deliverer.findOne({ email: 'carlos@example.com' });
    if (!deliverer) {
      deliverer = await Deliverer.create({
        name: 'Carlos Entregador',
        email: 'carlos@example.com',
        phone: '44998877665',
        vehicle: 'Moto',
        plate: 'XYZ-9988',
        passwordHash: 'dummyhash',
        isActive: true,
        isAvailable: true,
        isActiveToday: true
      });
      logger.info('Created test deliverer Carlos.');
    } else {
      deliverer.isActiveToday = true;
      deliverer.isActive = true;
      await deliverer.save();
      logger.info('Updated Carlos to be active today.');
    }

    // Limpa ordens antigas e notificações para o teste
    await Order.deleteMany({ customerId: customer._id });
    await Notification.deleteMany({});

    // 3. CRIAÇÃO DO PEDIDO (PENDING)
    logger.info('--- 3. Criando Pedido ---');
    const order = await OrderService.createOrder(
      customer._id.toString(),
      merchant._id.toString(),
      [{
        productId: product._id.toString(),
        quantity: 2,
        chosenOptions: [
          { groupName: 'Borda', optionName: 'Borda de Catupiry', price: 5.00 },
          { groupName: 'Adicionais', optionName: 'Bacon extra', price: 4.00 }
        ],
        notes: 'Sem cebola, por favor'
      }],
      'PIX'
    );
    logger.info(`Pedido nº ${order._id} criado com status ${order.status}`);
    logger.info(`Preço base do produto: R$ ${product.price.toFixed(2)}`);
    logger.info(`Subtotal calculado pelo serviço: R$ ${order.subtotal.toFixed(2)}`);
    logger.info(`Total calculado pelo serviço: R$ ${order.total.toFixed(2)}`);

    // Valida o cálculo do subtotal e total
    // Preço item = 45.00 (base) + 5.00 (borda) + 4.00 (bacon) = 54.00. Para Qtd = 2: 108.00.
    // Total = 108.00 (subtotal) + 5.00 (deliveryFee) = 113.00.
    const expectedSubtotal = 108.00;
    const expectedTotal = 113.00;
    if (order.subtotal !== expectedSubtotal || order.total !== expectedTotal) {
      throw new Error(`Cálculo de valores incorreto! Esperado subtotal/total: R$ ${expectedSubtotal}/R$ ${expectedTotal}, mas obteve R$ ${order.subtotal}/R$ ${order.total}`);
    }
    logger.info('✅ Validação de preços e opcionais passou com sucesso!');

    // Verifica se a notificação de criação foi enfileirada
    let notifications = await Notification.find({ userId: customer._id }).sort({ createdAt: -1 });
    logger.info(`Notificações enfileiradas para o cliente: ${notifications.length}`);
    if (notifications.length > 0) {
      logger.info(`Conteúdo: "${notifications[0].content}"`);
    }

    // 4. ACEITE DO PEDIDO (ACCEPTED)
    logger.info('--- 4. Aceitando Pedido ---');
    await OrderService.updateStatus(order._id.toString(), 'ACCEPTED', merchant._id.toString(), 'merchant');
    const acceptedOrder = await Order.findById(order._id);
    logger.info(`Status do pedido atualizado para: ${acceptedOrder?.status}`);

    notifications = await Notification.find({ userId: customer._id }).sort({ createdAt: -1 });
    logger.info(`Notificação de aceite enfileirada: "${notifications[0].content}"`);

    // 5. PRONTO PARA COLETA (READY) - Deve acionar entregador escalado
    logger.info('--- 5. Pedido Pronto (READY) ---');
    await OrderService.updateStatus(order._id.toString(), 'READY', merchant._id.toString(), 'merchant');
    
    const readyOrder = await Order.findById(order._id).populate('delivererId');
    logger.info(`Status do pedido atualizado para: ${readyOrder?.status}`);
    logger.info(`Entregador atribuído: ${(readyOrder?.delivererId as any)?.name || 'NENHUM'}`);

    if (!(readyOrder?.delivererId)) {
      throw new Error('Falha na atribuição automática do entregador escalado para o dia!');
    }

    // Verifica notificações enfileiradas para o entregador e cliente
    const delivererNotif = await Notification.findOne({ userId: deliverer._id });
    logger.info(`Notificação enfileirada para o entregador: "${delivererNotif?.content}"`);

    const clientNotif = await Notification.findOne({ userId: customer._id, content: { $regex: /Carlos/ } });
    logger.info(`Notificação enfileirada para o cliente com motorista: "${clientNotif?.content}"`);

    // 6. CONCLUSÃO
    logger.info('✅ Programmatic E2E Flow validation completed successfully without errors!');
  } catch (error) {
    logger.error('❌ Flow validation failed: %O', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTestFlow();
