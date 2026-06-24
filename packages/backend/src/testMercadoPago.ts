import dotenv from 'dotenv';
dotenv.config();

import { MercadoPagoService } from './services/MercadoPagoService';

async function test() {
  console.log('🚀 Iniciando teste de comunicação com Mercado Pago Sandbox...');
  console.log(`Token utilizado: ${process.env.MERCADO_PAGO_ACCESS_TOKEN ? 'Configurado (OK)' : 'Não configurado! (Modo Simulação Ativo)'}`);

  try {
    const mockCustomer: any = {
      id: 'mock-customer-id-123',
      name: 'João Testador Mercado Pago',
      email: 'joao.testador@trazpraca.com.br',
      phone: '11987654321',
      save: async function() {
        console.log('💾 [Mock save] Salvando mpCustomerId:', this.mpCustomerId);
        return this;
      }
    };

    console.log('\n1. Testando criação de cliente...');
    const customerId = await MercadoPagoService.getOrCreateCustomer(mockCustomer);
    console.log(`✅ Cliente resolvido no Mercado Pago! ID: ${customerId}`);

    console.log('\n2. Testando criação de cobrança PIX com Split...');
    const orderId = 'test_order_' + Math.random().toString(36).substring(2, 11);
    const mockMerchantId = 'merchant-id-abc-123';
    
    // R$ 10,50 total, sendo R$ 2,50 a comissão/repasse do marketplace (applicationFee)
    const pixPayment = await MercadoPagoService.createPixPayment(
      orderId,
      10.50,
      customerId,
      mockMerchantId,
      2.50
    );

    console.log('✅ Cobrança PIX criada com sucesso!');
    console.log(`   - ID da Cobrança: ${pixPayment.mpPaymentId}`);
    console.log(`   - Copia e Cola: ${pixPayment.copyAndPaste.substring(0, 50)}...`);
    console.log(`   - QR Code Base64 (tamanho): ${pixPayment.qrCodeBase64.length} caracteres`);

    console.log('\n🎉 Teste concluído com sucesso!');
  } catch (err: any) {
    console.error('\n❌ Erro durante o teste:', err.message);
  }
}

test();
