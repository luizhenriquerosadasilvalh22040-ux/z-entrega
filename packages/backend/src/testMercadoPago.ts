import dotenv from 'dotenv';
dotenv.config();

import { MercadoPagoService } from './services/MercadoPagoService';
import prisma from './config/prisma';

async function test() {
  console.log('🚀 Iniciando teste de comunicação com Mercado Pago Sandbox...');
  console.log(`Token utilizado: ${process.env.MERCADO_PAGO_ACCESS_TOKEN ? 'Configurado (OK)' : 'Não configurado! (Modo Simulação Ativo)'}`);

  let createdCustomer: any = null;
  let createdMerchant: any = null;
  let createdOrder: any = null;

  try {
    // 1. Criar um Merchant temporário de teste
    console.log('🏪 Criando lojista temporário para teste...');
    createdMerchant = await prisma.merchant.create({
      data: {
        name: 'Lojista Teste MP',
        email: 'lojista.teste.mp@trazpraca.com.br',
        passwordHash: 'hash123',
        cnpj: '12345678901234_' + Math.random().toString(36).substring(2, 7), // cnpj precisa ser único
        phone: '11999999999',
        street: 'Rua Teste',
        number: '123',
        neighborhood: 'Bairro Teste',
        city: 'Cidade Teste',
        zipCode: '12345-678',
        isVerified: true,
        paymentMethods: ['pix']
      }
    });

    // 2. Criar um Customer temporário de teste
    console.log('👤 Criando cliente temporário no banco...');
    createdCustomer = await prisma.customer.create({
      data: {
        name: 'João Testador Mercado Pago',
        email: 'joao.testador.' + Math.random().toString(36).substring(2, 7) + '@trazpraca.com.br',
        phone: '1198765' + Math.floor(1000 + Math.random() * 9000), // telefone único
      }
    });

    console.log('\n1. Testando criação de cliente...');
    const customerId = await MercadoPagoService.getOrCreateCustomer(createdCustomer);
    console.log(`✅ Cliente resolvido no Mercado Pago! ID: ${customerId}`);

    // 3. Criar um Order temporário de teste
    console.log('\nCriando pedido temporário no banco...');
    createdOrder = await prisma.order.create({
      data: {
        customerId: createdCustomer.id,
        merchantId: createdMerchant.id,
        subtotal: 10.50,
        commission: 2.50,
        total: 10.50,
        paymentMethod: 'pix',
        deliveryStreet: 'Rua Teste',
        deliveryNumber: '123',
        deliveryNeighborhood: 'Bairro Teste',
        deliveryCity: 'Cidade Teste',
        deliveryState: 'PR',
        deliveryZip: '12345-678'
      }
    });

    console.log('\n2. Testando criação de cobrança PIX com Split...');
    // R$ 10,50 total, sendo R$ 2,50 a comissão/repasse do marketplace (applicationFee)
    const pixPayment = await MercadoPagoService.createPixPayment(
      createdOrder.id,
      10.50,
      customerId,
      createdMerchant.id,
      2.50
    );

    console.log('✅ Cobrança PIX criada com sucesso!');
    console.log(`   - ID da Cobrança: ${pixPayment.mpPaymentId}`);
    console.log(`   - Copia e Cola: ${pixPayment.copyAndPaste.substring(0, 50)}...`);
    console.log(`   - QR Code Base64 (tamanho): ${pixPayment.qrCodeBase64.length} caracteres`);

    console.log('\n🎉 Teste concluído com sucesso!');
  } catch (err: any) {
    console.error('\n❌ Erro durante o teste:', err.message || err);
  } finally {
    // Limpeza dos dados criados
    console.log('\n🧹 Iniciando limpeza dos dados temporários...');
    if (createdOrder) {
      await prisma.order.delete({ where: { id: createdOrder.id } }).catch(() => {});
    }
    if (createdCustomer) {
      await prisma.customer.delete({ where: { id: createdCustomer.id } }).catch(() => {});
    }
    if (createdMerchant) {
      await prisma.merchant.delete({ where: { id: createdMerchant.id } }).catch(() => {});
    }
    console.log('🧹 Limpeza concluída.');
  }
}

test();
