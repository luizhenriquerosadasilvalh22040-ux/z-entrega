import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from './config/prisma';
import { encryptDeterministic } from './config/encryption';
import logger from './config/logger';

async function seed() {
  try {
    logger.info('Database connected for seeding...');

    // Limpa dados anteriores para garantir o teste limpo
    // Devido às chaves estrangeiras, limpamos na ordem reversa de dependência
    await prisma.promotion.deleteMany({});
    await prisma.orderItemOption.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.productOption.deleteMany({});
    await prisma.productOptionGroup.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.customerAddress.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.merchant.deleteMany({});
    await prisma.deliverer.deleteMany({});
    await prisma.banner.deleteMany({});
    await prisma.systemAdmin.deleteMany({});
    await prisma.systemConfig.deleteMany({});

    // 1. Cria Lojista Teste
    const passwordHash = await bcrypt.hash('password123', 10);
    const merchant = await prisma.merchant.create({
      data: {
        name: 'Pizzaria Rondon',
        email: 'merchant@example.com',
        passwordHash,
        cnpj: encryptDeterministic('12345678000100'),
        phone: '44997158781',
        category: 'Comida',
        openTime: '18:00',
        closeTime: '23:30',
        paymentMethods: ['PIX', 'Dinheiro', 'Cartão'],
        logoImage: 'https://images.unsplash.com/photo-1590842211124-9676b2253b37?w=200&auto=format&fit=crop&q=80',
        coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80',
        street: 'Avenida Paraná',
        number: '1500',
        neighborhood: 'Centro',
        city: 'Rondon',
        state: 'PR',
        zipCode: '87800000',
        latitude: -23.41,
        longitude: -52.75,
        isVerified: true,
        isActive: true
      }
    });
    logger.info('Test merchant created successfully.');

    // 2. Cria Produtos Teste
    // Pizza Calabresa
    await prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Pizza Calabresa Grande',
        description: 'Molho de tomate artesanal, mussarela, calabresa fatiada, cebola e orégano.',
        price: 45.00,
        category: 'Pizzas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80',
        optionGroups: {
          create: [
            {
              name: 'Borda',
              required: false,
              minSelect: 0,
              maxSelect: 1,
              options: {
                create: [
                  { name: 'Borda de Catupiry', price: 5.00 },
                  { name: 'Borda de Cheddar', price: 6.00 }
                ]
              }
            },
            {
              name: 'Adicionais',
              required: false,
              minSelect: 0,
              maxSelect: 2,
              options: {
                create: [
                  { name: 'Bacon extra', price: 4.00 },
                  { name: 'Queijo extra', price: 5.00 }
                ]
              }
            }
          ]
        }
      }
    });

    // X-Burger Supremo
    await prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'X-Burger Supremo',
        description: 'Blend de costela 150g, queijo prato derretido, alface fresca, tomate e maionese da casa no pão brioche.',
        price: 25.00,
        category: 'Hambúrgueres',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80',
        optionGroups: {
          create: [
            {
              name: 'Ponto da Carne',
              required: true,
              minSelect: 1,
              maxSelect: 1,
              options: {
                create: [
                  { name: 'Ao Ponto', price: 0.00 },
                  { name: 'Bem Passado', price: 0.00 },
                  { name: 'Mal Passado', price: 0.00 }
                ]
              }
            },
            {
              name: 'Adicionais',
              required: false,
              minSelect: 0,
              maxSelect: 3,
              options: {
                create: [
                  { name: 'Bacon extra', price: 3.00 },
                  { name: 'Queijo Cheddar adicional', price: 4.00 },
                  { name: 'Ovo frito', price: 2.00 }
                ]
              }
            }
          ]
        }
      }
    });

    // Coca-Cola
    await prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Coca-Cola 2 Litros',
        description: 'Refrigerante garrafa pet 2L trincando de gelada.',
        price: 10.00,
        category: 'Bebidas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80'
      }
    });

    logger.info('Test products created successfully.');

    // 3. Cria Cliente Teste
    const customer = await prisma.customer.create({
      data: {
        name: 'João Silva',
        email: 'customer@example.com',
        passwordHash,
        cpf: encryptDeterministic('12345678909'),
        phone: '44999998888',
        isActive: true,
        addresses: {
          create: [
            {
              nickname: 'Principal',
              street: 'Rua São Paulo',
              number: '450',
              neighborhood: 'Jardim Planalto',
              city: 'Rondon',
              state: 'PR',
              zipCode: '87800000',
              latitude: -23.415,
              longitude: -52.752,
              isPrimary: true
            }
          ]
        }
      }
    });
    logger.info('Test customer created successfully.');

    // 4. Configuração Padrão do Sistema
    await prisma.systemConfig.create({
      data: {
        defaultSubscriptionPrice: 150.00
      }
    });
    logger.info('System Config created successfully.');

    // 5. Criação Segura do Administrador Geral
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@trazpraca.com';
    const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.systemAdmin.create({
      data: {
        name: 'Administrador Geral',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        isActive: true
      }
    });
    logger.info(`System Admin created successfully. Email: ${adminEmail}, Password: ${process.env.ADMIN_PASSWORD ? '******' : adminPassword}`);

    logger.info('Seeding finished successfully!');
  } catch (error) {
    logger.error('Seeding error: %O', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
