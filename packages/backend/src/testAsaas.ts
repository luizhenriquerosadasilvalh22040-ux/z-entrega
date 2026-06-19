import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

import { AsaasService } from './services/AsaasService';

async function test() {
  console.log('🚀 Iniciando teste de comunicação com Asaas Sandbox...');
  console.log(`Chave utilizada: ${process.env.ASAAS_API_KEY ? 'Configurada (OK)' : 'Não configurada!'}`);

  try {
    // Simula um objeto de cliente do Mongoose
    const mockCustomer: any = {
      name: 'João Testador Asaas',
      email: 'joao.testador@trazpraca.com.br',
      phone: '11987654321',
      save: async function() {
        console.log('💾 [Mock save] Salvando asaasCustomerId:', this.asaasCustomerId);
        return this;
      }
    };

    console.log('\n1. Testando criação de cliente...');
    const customerId = await AsaasService.getOrCreateCustomer(mockCustomer);
    console.log(`✅ Cliente resolvido no Asaas! ID: ${customerId}`);

    console.log('\n2. Testando criação de cobrança PIX...');
    const orderId = 'test_order_' + Math.random().toString(36).substr(2, 9);
    const pixPayment = await AsaasService.createPixPayment(
      orderId,
      10.50, // R$ 10,50
      customerId
    );

    console.log('✅ Cobrança PIX criada com sucesso!');
    console.log(`   - ID da Cobrança: ${pixPayment.asaasPaymentId}`);
    console.log(`   - Copia e Cola: ${pixPayment.copyAndPaste.substring(0, 50)}...`);
    console.log(`   - QR Code Base64 (tamanho): ${pixPayment.qrCodeBase64.length} caracteres`);

    console.log('\n🎉 Teste concluído com sucesso!');
  } catch (err: any) {
    console.error('\n❌ Erro durante o teste:', err.message);
  }
}

test();
