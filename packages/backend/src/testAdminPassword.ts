import prisma from './config/prisma';
import bcrypt from 'bcrypt';
import logger from './config/logger';

async function testPassword() {
  try {
    const admin = await prisma.systemAdmin.findUnique({
      where: { email: 'admin@trazpraca.com' }
    });

    if (!admin) {
      logger.error('Admin não encontrado no banco!');
      return;
    }

    const testPass = 'admin123';
    const isMatch = await bcrypt.compare(testPass, admin.passwordHash);
    logger.info(`Comparando senha "${testPass}" com hash do banco...`);
    logger.info(`Resultado: ${isMatch ? 'SENHA CORRETA!' : 'SENHA INCORRETA!'}`);
    
    if (!isMatch) {
      logger.info('Atualizando a senha do admin para "admin123"...');
      const newHash = await bcrypt.hash(testPass, 10);
      await prisma.systemAdmin.update({
        where: { id: admin.id },
        data: { passwordHash: newHash }
      });
      logger.info('Senha do admin atualizada com sucesso no banco!');
    }
  } catch (err: any) {
    logger.error(`Erro: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();
