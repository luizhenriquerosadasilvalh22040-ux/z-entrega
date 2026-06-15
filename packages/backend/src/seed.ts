import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Merchant } from './models/Merchant';
import { Product } from './models/Product';
import { Customer } from './models/Customer';
import { encrypt } from './config/encryption';
import logger from './config/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trazpraca?replicaSet=rs0';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Database connected for seeding...');

    // Limpa dados anteriores para garantir o teste limpo
    await Merchant.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});

    // 1. Cria Lojista Teste
    const passwordHash = await bcrypt.hash('password123', 10);
    const merchant = new Merchant({
      name: 'Pizzaria Rondon',
      email: 'merchant@example.com',
      passwordHash,
      cnpj: encrypt('12345678000100'),
      phone: '44997158781',
      category: 'Comida',
      operatingHours: { open: '18:00', close: '23:30' },
      paymentMethods: ['PIX', 'Dinheiro', 'Cartão'],
      address: {
        street: 'Avenida Paraná',
        number: '1500',
        neighborhood: 'Centro',
        city: 'Rondon',
        state: 'PR',
        zipCode: '87800000',
        coordinates: { lat: -23.41, lng: -52.75 }
      },
      isVerified: true,
      isActive: true
    });
    await merchant.save();
    logger.info('Test merchant created successfully.');

    // 2. Cria Produtos Teste
    const products = [
      {
        merchantId: merchant._id,
        name: 'Pizza Calabresa Grande',
        description: 'Molho de tomate artesanal, mussarela, calabresa fatiada, cebola e orégano.',
        price: 45.00,
        category: 'Pizzas',
        isAvailable: true
      },
      {
        merchantId: merchant._id,
        name: 'X-Burger Supremo',
        description: 'Blend de costela 150g, queijo prato derretido, alface fresca, tomate e maionese da casa no pão brioche.',
        price: 25.00,
        category: 'Hambúrgueres',
        isAvailable: true
      },
      {
        merchantId: merchant._id,
        name: 'Coca-Cola 2 Litros',
        description: 'Refrigerante garrafa pet 2L trincando de gelada.',
        price: 10.00,
        category: 'Bebidas',
        isAvailable: true
      }
    ];

    await Product.insertMany(products);
    logger.info('Test products created successfully.');

    // 3. Cria Cliente Teste
    const customer = new Customer({
      name: 'João Silva',
      email: 'customer@example.com',
      passwordHash,
      cpf: encrypt('12345678909'),
      phone: '44999998888',
      address: {
        street: 'Rua São Paulo',
        number: '450',
        neighborhood: 'Jardim Planalto',
        city: 'Rondon',
        state: 'PR',
        zipCode: '87800000',
        coordinates: { lat: -23.415, lng: -52.752 }
      },
      isActive: true
    });
    await customer.save();
    logger.info('Test customer created successfully.');

    logger.info('Seeding finished successfully!');
  } catch (error) {
    logger.error('Seeding error: %O', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
