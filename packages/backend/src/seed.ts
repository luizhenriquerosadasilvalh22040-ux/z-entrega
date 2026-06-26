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
    await prisma.userCouponUsage.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.orderItemOption.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.coupon.deleteMany({});
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

    // ==========================================
    // 1. LOJA 1 — Pizzaria Rondon
    // ==========================================
    const passwordHash = await bcrypt.hash('password123', 10);
    const pizzaria = await prisma.merchant.create({
      data: {
        name: 'Pizzaria Rondon',
        email: 'pizzaria@example.com',
        passwordHash,
        cnpj: encryptDeterministic('12345678000100'),
        phone: '44997158781',
        category: 'Comida',
        openTime: '18:00',
        closeTime: '23:30',
        timezone: 'America/Sao_Paulo',
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
    logger.info('Loja 1 — Pizzaria Rondon criada.');

    // Produtos Pizzaria
    const pizzaCalabresa = await prisma.product.create({
      data: {
        merchantId: pizzaria.id,
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

    await prisma.product.create({
      data: {
        merchantId: pizzaria.id,
        name: 'Pizza Margherita',
        description: 'Molho de tomate fresco, mussarela de búfala, manjericão e azeite extra virgem.',
        price: 42.00,
        category: 'Pizzas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&auto=format&fit=crop&q=80',
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
            }
          ]
        }
      }
    });

    await prisma.product.create({
      data: {
        merchantId: pizzaria.id,
        name: 'Pizza Quatro Queijos',
        description: 'Mussarela, gorgonzola, provolone e parmesão, finalizada com orégano.',
        price: 48.00,
        category: 'Pizzas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: pizzaria.id,
        name: 'Coca-Cola 2 Litros',
        description: 'Refrigerante garrafa pet 2L trincando de gelada.',
        price: 10.00,
        category: 'Bebidas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: pizzaria.id,
        name: 'Guaraná Antarctica 2L',
        description: 'Refrigerante Guaraná Antarctica gelado 2 litros.',
        price: 9.00,
        category: 'Bebidas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&auto=format&fit=crop&q=80'
      }
    });

    // Promoção Pizzaria
    await prisma.promotion.create({
      data: {
        merchantId: pizzaria.id,
        discountPercentage: 10.00,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        categoryApplicable: 'Pizzas'
      }
    });

    logger.info('Produtos e promoções da Pizzaria criados.');

    // ==========================================
    // 2. LOJA 2 — Burger House
    // ==========================================
    const burgerHouse = await prisma.merchant.create({
      data: {
        name: 'Burger House',
        email: 'burgerhouse@example.com',
        passwordHash,
        cnpj: encryptDeterministic('98765432000188'),
        phone: '44997001122',
        category: 'Comida',
        openTime: '11:00',
        closeTime: '23:00',
        timezone: 'America/Sao_Paulo',
        paymentMethods: ['PIX', 'Dinheiro', 'Cartão'],
        logoImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&auto=format&fit=crop&q=80',
        coverImage: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&auto=format&fit=crop&q=80',
        street: 'Rua Marechal Deodoro',
        number: '820',
        neighborhood: 'Centro',
        city: 'Rondon',
        state: 'PR',
        zipCode: '87800000',
        latitude: -23.412,
        longitude: -52.753,
        isVerified: true,
        isActive: true
      }
    });
    logger.info('Loja 2 — Burger House criada.');

    // Produtos Burger House
    const xBurgerSupremo = await prisma.product.create({
      data: {
        merchantId: burgerHouse.id,
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

    await prisma.product.create({
      data: {
        merchantId: burgerHouse.id,
        name: 'X-Bacon Duplo',
        description: 'Dois blends artesanais 120g, cheddar derretido, bacon crocante em camadas, cebola caramelizada e molho barbecue.',
        price: 32.00,
        category: 'Hambúrgueres',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&auto=format&fit=crop&q=80',
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
                  { name: 'Bem Passado', price: 0.00 }
                ]
              }
            }
          ]
        }
      }
    });

    await prisma.product.create({
      data: {
        merchantId: burgerHouse.id,
        name: 'Batata Frita Cheddar & Bacon',
        description: 'Porção generosa de batatas crocantes cobertas com molho cheddar e bacon.',
        price: 18.00,
        category: 'Porções',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: burgerHouse.id,
        name: 'Onion Rings',
        description: 'Anéis de cebola empanados e fritos, crocantes por fora e macios por dentro. Acompanha molho especial.',
        price: 15.00,
        category: 'Porções',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: burgerHouse.id,
        name: 'Milkshake de Nutella',
        description: 'Milkshake cremoso de Nutella com chantilly e calda de chocolate.',
        price: 16.00,
        category: 'Bebidas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: burgerHouse.id,
        name: 'Coca-Cola Lata 350ml',
        description: 'Refrigerante Coca-Cola lata geladíssima.',
        price: 6.00,
        category: 'Bebidas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&auto=format&fit=crop&q=80'
      }
    });

    // Promoção Burger House
    await prisma.promotion.create({
      data: {
        merchantId: burgerHouse.id,
        discountPercentage: 20.00,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        productIds: [xBurgerSupremo.id]
      }
    });

    logger.info('Produtos e promoções do Burger House criados.');

    // ==========================================
    // 3. LOJA 3 — Sushi Express
    // ==========================================
    const sushiExpress = await prisma.merchant.create({
      data: {
        name: 'Sushi Express',
        email: 'sushi@example.com',
        passwordHash,
        cnpj: encryptDeterministic('55566677000199'),
        phone: '44998003344',
        category: 'Comida',
        openTime: '17:00',
        closeTime: '22:30',
        timezone: 'America/Sao_Paulo',
        paymentMethods: ['PIX', 'Cartão'],
        logoImage: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&auto=format&fit=crop&q=80',
        coverImage: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=1200&auto=format&fit=crop&q=80',
        street: 'Rua Sete de Setembro',
        number: '330',
        neighborhood: 'Jardim Planalto',
        city: 'Rondon',
        state: 'PR',
        zipCode: '87800000',
        latitude: -23.414,
        longitude: -52.748,
        isVerified: true,
        isActive: true
      }
    });
    logger.info('Loja 3 — Sushi Express criada.');

    // Produtos Sushi Express
    const comboSalmao = await prisma.product.create({
      data: {
        merchantId: sushiExpress.id,
        name: 'Combo Salmão Premium (30 peças)',
        description: 'Sashimi, niguiri, uramaki e hossomaki de salmão fresco. 30 peças selecionadas.',
        price: 75.00,
        category: 'Combos',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&auto=format&fit=crop&q=80',
        optionGroups: {
          create: [
            {
              name: 'Molhos Extras',
              required: false,
              minSelect: 0,
              maxSelect: 2,
              options: {
                create: [
                  { name: 'Molho Tarê extra', price: 3.00 },
                  { name: 'Molho de Maracujá', price: 4.00 },
                  { name: 'Wasabi extra', price: 2.00 }
                ]
              }
            }
          ]
        }
      }
    });

    await prisma.product.create({
      data: {
        merchantId: sushiExpress.id,
        name: 'Combo Misto (20 peças)',
        description: 'Mix de hot rolls, uramakis de salmão e filadélfia. Ideal para 1-2 pessoas.',
        price: 52.00,
        category: 'Combos',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=400&auto=format&fit=crop&q=80',
        optionGroups: {
          create: [
            {
              name: 'Molhos Extras',
              required: false,
              minSelect: 0,
              maxSelect: 2,
              options: {
                create: [
                  { name: 'Molho Tarê extra', price: 3.00 },
                  { name: 'Cream cheese extra', price: 4.00 }
                ]
              }
            }
          ]
        }
      }
    });

    await prisma.product.create({
      data: {
        merchantId: sushiExpress.id,
        name: 'Hot Roll (10 peças)',
        description: 'Rolinhos empanados e fritos recheados com salmão, cream cheese e cebolinha.',
        price: 28.00,
        category: 'Peças Avulsas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1617196035154-1e7e6e28b0db?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: sushiExpress.id,
        name: 'Temaki de Salmão',
        description: 'Cone de alga nori recheado com arroz, salmão fresco, cream cheese e cebolinha.',
        price: 22.00,
        category: 'Peças Avulsas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: sushiExpress.id,
        name: 'Missoshiru',
        description: 'Sopa japonesa tradicional com tofu, cebolinha e alga wakame.',
        price: 12.00,
        category: 'Acompanhamentos',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?w=400&auto=format&fit=crop&q=80'
      }
    });

    await prisma.product.create({
      data: {
        merchantId: sushiExpress.id,
        name: 'Chá Verde Gelado 500ml',
        description: 'Chá verde natural com toque de limão, refrescante e leve.',
        price: 8.00,
        category: 'Bebidas',
        isAvailable: true,
        image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&auto=format&fit=crop&q=80'
      }
    });

    // Promoção Sushi Express
    await prisma.promotion.create({
      data: {
        merchantId: sushiExpress.id,
        discountPercentage: 15.00,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        productIds: [comboSalmao.id]
      }
    });

    logger.info('Produtos e promoções do Sushi Express criados.');

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
        defaultSubscriptionPrice: 125.00
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

    // 6. Cria Entregadores de Teste
    await prisma.deliverer.create({
      data: {
        name: 'Carlos Motoboy',
        email: 'carlos.motoboy@example.com',
        passwordHash,
        phone: '44999990001',
        vehicleType: 'MOTO',
        licensePlate: 'ABC-1234',
        isActive: true,
        isAvailable: true,
        isActiveToday: true,
        deliveryStatus: 'AVAILABLE'
      }
    });

    await prisma.deliverer.create({
      data: {
        name: 'Marcos Motoboy',
        email: 'marcos.motoboy@example.com',
        passwordHash,
        phone: '44999990002',
        vehicleType: 'MOTO',
        licensePlate: 'DEF-5678',
        isActive: true,
        isAvailable: true,
        isActiveToday: true,
        deliveryStatus: 'AVAILABLE'
      }
    });

    logger.info('Test deliverers created successfully.');

    logger.info('Seeding finished successfully!');
  } catch (error) {
    logger.error('Seeding error: %O', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
