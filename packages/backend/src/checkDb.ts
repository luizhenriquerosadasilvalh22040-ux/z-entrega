import prisma from './config/prisma';
import logger from './config/logger';

async function check() {
  try {
    logger.info('Tentando se conectar ao Supabase...');
    const admins = await prisma.systemAdmin.count();
    const merchants = await prisma.merchant.count();
    const customers = await prisma.customer.count();
    const products = await prisma.product.count();
    const orders = await prisma.order.count();
    const notifications = await prisma.notification.count();
    
    logger.info('--- STATUS DO BANCO DE DADOS SUPABASE ---');
    logger.info(`Administradores: ${admins}`);
    logger.info(`Lojistas (Merchants): ${merchants}`);
    logger.info(`Clientes (Customers): ${customers}`);
    logger.info(`Produtos: ${products}`);
    logger.info(`Pedidos (Orders): ${orders}`);
    logger.info(`Notificações: ${notifications}`);
    
    if (admins > 0) {
      const allAdmins = await prisma.systemAdmin.findMany({ select: { email: true, isActive: true } });
      logger.info('Emails dos Admins no banco:');
      console.log(allAdmins);
    }
  } catch (error: any) {
    logger.error('Erro ao conectar ao banco de dados Supabase:');
    logger.error(error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
