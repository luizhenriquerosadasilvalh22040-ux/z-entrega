import prisma from './config/prisma';
import { AuthService } from './services/AuthService';
import logger from './config/logger';

async function testRegister() {
  try {
    logger.info('Testando cadastro de lojista via AuthService...');
    const randomSuffix = Math.floor(Math.random() * 100000);
    const mockData = {
      name: `Loja Teste ${randomSuffix}`,
      email: `loja${randomSuffix}@example.com`,
      password: 'password123',
      cnpj: `${Math.floor(10000000000000 + Math.random() * 90000000000000)}`, // 14 digitos
      phone: '44999991111',
      category: 'Comida' as const,
      operatingHours: { open: '18:00', close: '23:30' },
      paymentMethods: ['PIX', 'Dinheiro'],
      address: {
        street: 'Rua Principal',
        number: '123',
        neighborhood: 'Centro',
        city: 'Rondon',
        state: 'PR',
        zipCode: '87800000',
        coordinates: { lat: -23.41, lng: -52.75 }
      }
    };

    const merchant = await AuthService.registerMerchant(mockData);
    logger.info('Lojista cadastrado com sucesso!');
    console.log(merchant);
    
    // Deleta o lojista de teste recém-criado para não poluir o banco
    await prisma.merchant.delete({
      where: { id: merchant.id }
    });
    logger.info('Lojista de teste removido.');
  } catch (error: any) {
    logger.error('Falha no cadastro do lojista:');
    logger.error(error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

testRegister();
